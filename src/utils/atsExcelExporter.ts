import type { DocSRI } from './atsXmlBuilder';
import { getSRIDocumentNumber } from './atsXmlBuilder';

interface EmpresaInfo {
  nombre_empresa: string;
  ruc_empresa: string;
}

const formatDateForSRI = (dateString: string | undefined): string => {
  if (!dateString) return '';
  const parts = dateString.split('T')[0].split('-');
  if (parts.length === 3) {
    return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
  }
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

const mapIdProv = (tipoId: string | undefined): string => {
  if (!tipoId) return '01';
  if (tipoId === '04') return '01';
  if (tipoId === '05') return '02';
  if (tipoId === '06' || tipoId === '08') return '03';
  return tipoId;
};

const mapTipoComprobante = (tipo: string | undefined): string => {
  if (!tipo) return '01';
  if (tipo.includes('Factura')) return '01';
  if (tipo.includes('Nota de Crédito') || tipo.includes('Nota de Credito')) return '04';
  if (tipo.includes('Retención') || tipo.includes('Retencion')) return '07';
  if (tipo.includes('Liquidación') || tipo.includes('Liquidacion')) return '03';
  return '01';
};

const escapeHtml = (str: string | undefined | null): string => {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

export const exportATSToExcel = (
  empresa: EmpresaInfo,
  anio: number,
  mes: number,
  docs: DocSRI[]
) => {
  const mesStr = String(mes).padStart(2, '0');

  // Clasificación de datos igual que en atsXmlBuilder
  const compras = docs.filter(d => (d.transacciones?.tipo_comprobante === 'Factura' || d.transacciones?.tipo_comprobante === 'Nota de Crédito') && d.es_compra);
  const ventas = docs.filter(d => (d.transacciones?.tipo_comprobante === 'Factura' || d.transacciones?.tipo_comprobante === 'Nota de Crédito') && !d.es_compra);
  const retencionesRecibidas = docs.filter(d => d.transacciones?.tipo_comprobante === 'Comprobante de Retención' && !d.es_compra);
  const anulados = docs.filter(d => 
    d.transacciones?.concepto?.toLowerCase().includes('anulado') || 
    d.transacciones?.tipo_comprobante === 'Anulado'
  );

  // totalVentasSRI debe deducir Notas de Crédito de Ventas
  const totalBase12Ventas = ventas.reduce((s, d) => {
    const isNC = d.transacciones?.tipo_comprobante === 'Nota de Crédito';
    return s + (isNC ? -(d.base_12 || 0) : (d.base_12 || 0));
  }, 0);
  const totalBase0Ventas = ventas.reduce((s, d) => {
    const isNC = d.transacciones?.tipo_comprobante === 'Nota de Crédito';
    return s + (isNC ? -(d.base_0 || 0) : (d.base_0 || 0));
  }, 0);
  const totalBaseNoObjetoVentas = ventas.reduce((s, d) => {
    const isNC = d.transacciones?.tipo_comprobante === 'Nota de Crédito';
    return s + (isNC ? -(d.base_no_objeto || 0) : (d.base_no_objeto || 0));
  }, 0);
  const totalVentasSRI = Number((totalBase12Ventas + totalBase0Ventas + totalBaseNoObjetoVentas).toFixed(2));

  const estabsUnicos = [...new Set(docs.map(d => {
    const num = getSRIDocumentNumber(d);
    const partes = num.split('-');
    return partes[0]?.padStart(3, '0') || '001';
  }))];
  const numEstabs = String(estabsUnicos.length).padStart(3, '0');

  // Agrupamiento de Ventas por Cliente para el ATS
  const ventasAgrupadasPorClienteYComp = Object.values(
    ventas.reduce((acc, v) => {
      const ent = v.transacciones?.entidades;
      const idCliente = ent?.ruc_cedula || '9999999999999';
      const isNC = v.transacciones?.tipo_comprobante === 'Nota de Crédito';
      const tipoComp = isNC ? '04' : '18';
      const key = `${idCliente}_${tipoComp}`;

      if (!acc[key]) {
        acc[key] = {
          ruc: idCliente,
          razonSocial: ent?.razon_social || ent?.nombre || 'Consumidor Final',
          tipoId: ent?.tipo_identificacion || '07',
          tipoComprobante: tipoComp,
          numeroComprobantes: 0,
          base0: 0,
          base12: 0,
          baseNoObjeto: 0,
          iva: 0,
          total: 0,
          retIva: 0,
          retRenta: 0,
          formaPago: v.forma_pago || '20'
        };
      }
      acc[key].numeroComprobantes += 1;
      acc[key].base0 += v.base_0 || 0;
      acc[key].base12 += v.base_12 || 0;
      acc[key].baseNoObjeto += v.base_no_objeto || 0;
      acc[key].iva += v.monto_iva || 0;
      acc[key].total += (v.base_12 || 0) + (v.base_0 || 0) + (v.base_no_objeto || 0) + (v.monto_iva || 0);
      return acc;
    }, {} as Record<string, any>)
  ).map((v: any) => {
    const retsCliente = retencionesRecibidas.filter(r => r.transacciones?.entidades?.ruc_cedula === v.ruc);
    let totalRetIva = 0;
    let totalRetRenta = 0;
    
    retsCliente.forEach(r => {
      const retsAplicadas = r.retenciones_aplicadas || [];
      retsAplicadas.forEach((ra: any) => {
        if (ra.tipo === 'IVA') {
          totalRetIva += ra.valor || 0;
        } else if (ra.tipo === 'RENTA' || !ra.tipo) {
          totalRetRenta += ra.valor || 0;
        }
      });
    });
    
    return {
      ...v,
      retIva: v.tipoComprobante === '04' ? 0 : totalRetIva,
      retRenta: v.tipoComprobante === '04' ? 0 : totalRetRenta
    };
  });

  const rowsHtml: string[] = [];

  // Metadata base que se repite en todas las filas de datos
  const baseMetadata = [
    'R',
    empresa.ruc_empresa,
    empresa.nombre_empresa,
    anio,
    mesStr,
    numEstabs,
    totalVentasSRI,
    'IVA'
  ];

  const formatCell = (val: any, formatClass = '') => {
    if (val === undefined || val === null || val === '') return '<td></td>';
    
    if (formatClass === 'text') {
      return `<td class="text">${escapeHtml(String(val))}</td>`;
    }
    if (formatClass === 'integer') {
      return `<td class="integer">${Math.round(Number(val))}</td>`;
    }
    if (formatClass === 'number' || (typeof val === 'number' && !formatClass)) {
      return `<td class="number">${Number(val).toFixed(2)}</td>`;
    }
    
    const escaped = escapeHtml(String(val));
    if (formatClass) {
      return `<td class="${formatClass}">${escaped}</td>`;
    }
    return `<td>${escaped}</td>`;
  };

  const renderRow = (cells: any[], formats: string[] = []) => {
    // Rellenar hasta 55 columnas
    const padded = [...cells];
    while (padded.length < 55) {
      padded.push('');
    }
    const innerHtml = padded.map((val, idx) => {
      const fmt = formats[idx] || (typeof val === 'number' ? 'number' : '');
      return formatCell(val, fmt);
    }).join('');
    return `<tr>${innerHtml}</tr>`;
  };

  // 1. SECCIÓN COMPRAS
  rowsHtml.push('<tr><td class="section-title" colspan="55">COMPRAS</td></tr>');
  
  const comprasHeaders = [
    'TipoIdInformante', 'IdInformante', 'razonSocial', 'Anio', 'Mes', 'numEstabRuc', 'totalVentas', 'codigoOperativo',
    'codSustento', 'tpIdProv', 'idProv', 'parteRel', 'tipoComprobante', 'fechaRegistro', 'establecimiento', 'puntoEmision',
    'secuencial', 'fechaEmision', 'autorizacion', 'baseNoGraIva', 'baseImponible', 'baseImpGrav', 'baseImpExe', 'montoIce',
    'montoIva', 'valRetBien10', 'valRetServ20', 'valorRetBienes', 'valRetServ50', 'valorRetServicios', 'valRetServ100',
    'totbasesImpReemb', 'pagoLocExt', 'paisEfecPago', 'aplicConvDobTrib', 'pagExtSujRetNorLeg', 'pagoRegFis', 'formaPago',
    'codRetAir', 'baseImpAir', 'porcentajeAir', 'valRetAir', 'numCajBan', 'precCajBan', 'estabRetencion1', 'ptoEmiRetencion1',
    'secRetencion1', 'autRetencion1', 'fechaEmiRet1', 'docModificado', 'estabModificado', 'ptoEmiModificado', 'secModificado',
    'autModificado', 'DenoProv'
  ];
  rowsHtml.push(`<tr>${comprasHeaders.map(h => `<th>${h}</th>`).join('')}</tr>`);

  compras.forEach(d => {
    const ent = d.transacciones?.entidades;
    const num = getSRIDocumentNumber(d);
    const partes = num.split('-');
    const estab = partes[0]?.padStart(3, '0') || '001';
    const ptoEmi = partes[1]?.padStart(3, '0') || '001';
    const sec    = partes[2]?.padStart(9, '0') || '000000001';
    const fp     = d.forma_pago || '20';
    const fechaFormat = formatDateForSRI(d.transacciones?.fecha);

    const rets = d.retenciones_aplicadas || [];
    const retRenta = rets.filter((r: any) => r.tipo === 'RENTA' || !r.tipo);
    const retIVA = rets.filter((r: any) => r.tipo === 'IVA');

    const metadataObj = rets.find((r: any) => r.cod_sustento || r.numero_retencion);
    const codSustento = metadataObj?.cod_sustento || '01';

    const isNC = d.transacciones?.tipo_comprobante === 'Nota de Crédito';
    const tipoComp = isNC ? '04' : '01';

    const ret10 = retIVA.filter(r => r.porcentaje === 10).reduce((s, r) => s + r.valor, 0);
    const ret20 = retIVA.filter(r => r.porcentaje === 20).reduce((s, r) => s + r.valor, 0);
    const ret30 = retIVA.filter(r => r.porcentaje === 30).reduce((s, r) => s + r.valor, 0);
    const ret50 = retIVA.filter(r => r.porcentaje === 50).reduce((s, r) => s + r.valor, 0);
    const ret70 = retIVA.filter(r => r.porcentaje === 70).reduce((s, r) => s + r.valor, 0);
    const ret100 = retIVA.filter(r => r.porcentaje === 100).reduce((s, r) => s + r.valor, 0);

    const isForeign = mapIdProv(ent?.tipo_identificacion) === '03';

    // Determinar referencias de retención
    const tieneRetencion = retRenta.some(r => r.valor > 0) || retIVA.some(r => r.valor > 0);
    const numRet = metadataObj?.numero_retencion;
    const autRet = metadataObj?.clave_retencion;
    const fechaRet = metadataObj?.fecha_retencion;

    let estabRet = '999';
    let ptoEmiRet = '999';
    let secRet = '999999999';
    let autRetVal = '9999999999';
    let fechaRetFormat = fechaFormat;

    if (tieneRetencion && numRet && numRet !== 'Manual') {
      const partesRet = numRet.split('-');
      if (partesRet.length === 3) {
        estabRet = partesRet[0].padStart(3, '0');
        ptoEmiRet = partesRet[1].padStart(3, '0');
        secRet = partesRet[2].padStart(9, '0');
        autRetVal = autRet || '9999999999999999999999999999999999999999999999999';
        fechaRetFormat = formatDateForSRI(fechaRet);
      }
    }

    // Referencias de documento modificado (en NC)
    let docMod = '0';
    let estabMod = '000';
    let ptoEmiMod = '000';
    let secMod = '0';
    let autMod = '000';

    if (isNC) {
      const concepto = d.transacciones?.concepto || '';
      const regexMod = /(\d{3})-(\d{3})-(\d{9})/;
      const matchMod = concepto.match(regexMod);
      docMod = '01';
      if (matchMod) {
        estabMod = matchMod[1];
        ptoEmiMod = matchMod[2];
        secMod = matchMod[3];
      }
      autMod = d.clave_acceso_xml || '9999999999999999999999999999999999999999999999999';
    }

    const totBases = (d.base_no_objeto || 0) + (d.base_0 || 0) + (d.base_12 || 0);
    const denoProv = ent?.razon_social || ent?.nombre || 'Consumidor Final';

    const rowBase = [
      ...baseMetadata,
      codSustento,
      mapIdProv(ent?.tipo_identificacion),
      ent?.ruc_cedula || '',
      'NO',
      tipoComp,
      fechaFormat,
      estab,
      ptoEmi,
      sec,
      fechaFormat,
      d.clave_acceso_xml || '',
      d.base_no_objeto || 0,
      d.base_0 || 0,
      d.base_12 || 0,
      0.0, // baseImpExe
      0.0, // montoIce
      d.monto_iva || 0,
      ret10,
      ret20,
      ret30,
      ret50,
      ret70,
      ret100,
      totBases, // totbasesImpReemb (suma de bases en el reporte)
      isForeign ? '02' : '01', // pagoLocExt
      isForeign ? '999' : 'NA', // paisEfecPago
      isForeign ? 'NO' : 'NA', // aplicConvDobTrib
      isForeign ? 'NO' : 'NA', // pagExtSujRetNorLeg
      isForeign ? 'NO' : 'NA', // pagoRegFis
      fp
    ];

    // Formatear texto específico
    const formats = [
      'text', 'text', 'text', 'integer', 'text', 'text', 'number', 'text', // baseMetadata
      'text', 'text', 'text', 'text', 'text', 'text', 'text', 'text', 'text', 'text', 'text', // compras fields
      'number', 'number', 'number', 'number', 'number', 'number', // bases e IVA
      'number', 'number', 'number', 'number', 'number', 'number', 'number', // rets
      'text', 'text', 'text', 'text', 'text', 'text' // foreign and payments
    ];

    const airFormats = [
      'text', 'number', 'number', 'number', 'integer', 'text', // AIR
      'text', 'text', 'text', 'text', 'text', // ret refs
      'text', 'text', 'text', 'text', 'text', // mod refs
      'text' // DenoProv
    ];

    if (retRenta.length > 0) {
      const activeRenta = retRenta.filter(r => r.valor > 0 || r.porcentaje > 0);
      if (activeRenta.length > 0) {
        activeRenta.forEach(r => {
          const airCols = [
            r.codigo || '332',
            r.base || d.base_12 || 0,
            r.porcentaje || 0,
            r.valor || 0,
            0.0, // numCajBan
            '0', // precCajBan
            estabRet,
            ptoEmiRet,
            secRet,
            autRetVal,
            fechaRetFormat,
            docMod,
            estabMod,
            ptoEmiMod,
            secMod,
            autMod,
            denoProv
          ];

          rowsHtml.push(renderRow([...rowBase, ...airCols], [...formats, ...airFormats]));
        });
      } else {
        // Renta vacía (se usa 332 de respaldo)
        const airCols = [
          '332', totBases, 0.0, 0.0, 0.0, '0',
          estabRet, ptoEmiRet, secRet, autRetVal, fechaRetFormat,
          docMod, estabMod, ptoEmiMod, secMod, autMod,
          denoProv
        ];
        rowsHtml.push(renderRow([...rowBase, ...airCols], [...formats, ...airFormats]));
      }
    } else {
      // Sin retenciones de renta
      const airCols = [
        '332', totBases, 0.0, 0.0, 0.0, '0',
        estabRet, ptoEmiRet, secRet, autRetVal, fechaRetFormat,
        docMod, estabMod, ptoEmiMod, secMod, autMod,
        denoProv
      ];
      rowsHtml.push(renderRow([...rowBase, ...airCols], [...formats, ...airFormats]));
    }
  });

  // Fila vacía de separación
  rowsHtml.push('<tr><td style="border:none; height: 18px;" colspan="55"></td></tr>');

  // 2. SECCIÓN VENTAS
  rowsHtml.push('<tr><td class="section-title" colspan="55">VENTAS</td></tr>');

  const ventasHeaders = [
    'TipoIdInformante', 'IdInformante', 'razonSocial', 'Anio', 'Mes', 'numEstabRuc', 'totalVentas', 'codigoOperativo',
    'tpIdCliente', 'idCliente', 'tipoComprobante', 'tipoEmision', 'numeroComprobantes', 'baseNoGraIva', 'baseImponible',
    'baseImpGrav', 'montoIva', 'montoIce', 'valorRetIva', 'valorRetRenta'
  ];
  rowsHtml.push(`<tr>${ventasHeaders.map(h => `<th>${h}</th>`).join('')}</tr>`);

  ventasAgrupadasPorClienteYComp.forEach((v: any) => {
    const row = [
      ...baseMetadata,
      v.tipoId,
      v.ruc,
      v.tipoComprobante,
      'E', // tipoEmision (E = Electrónico por defecto)
      v.numeroComprobantes,
      v.baseNoObjeto,
      v.base0,
      v.base12,
      v.iva,
      0.0, // montoIce
      v.retIva,
      v.retRenta
    ];

    const formats = [
      'text', 'text', 'text', 'integer', 'text', 'text', 'number', 'text', // baseMetadata
      'text', 'text', 'text', 'text', 'integer', 'number', 'number', 'number', 'number', 'number', 'number', 'number'
    ];

    rowsHtml.push(renderRow(row, formats));
  });

  // Fila vacía de separación
  rowsHtml.push('<tr><td style="border:none; height: 18px;" colspan="55"></td></tr>');

  // 3. SECCIÓN VENTAS POR ESTABLECIMIENTO
  rowsHtml.push('<tr><td class="section-title" colspan="55">VENTAS POR ESTABLECIMIENTO</td></tr>');

  const estabsHeaders = [
    'TipoIdInformante', 'IdInformante', 'razonSocial', 'Anio', 'Mes', 'numEstabRuc', 'totalVentas', 'codigoOperativo',
    'codEstab', 'ventasEstab', 'ivaComp'
  ];
  rowsHtml.push(`<tr>${estabsHeaders.map(h => `<th>${h}</th>`).join('')}</tr>`);

  estabsUnicos.forEach(est => {
    const totalEstab = ventas.filter(d => {
      const num = getSRIDocumentNumber(d);
      const partes = num.split('-');
      return (partes[0]?.padStart(3, '0') || '001') === est;
    }).reduce((sum, d) => {
      const isNC = d.transacciones?.tipo_comprobante === 'Nota de Crédito';
      const val = (d.base_12 || 0) + (d.base_0 || 0) + (d.monto_iva || 0);
      return sum + (isNC ? -val : val);
    }, 0);

    const row = [
      ...baseMetadata,
      est,
      totalEstab,
      0.0 // ivaComp
    ];

    const formats = [
      'text', 'text', 'text', 'integer', 'text', 'text', 'number', 'text', // baseMetadata
      'text', 'number', 'number'
    ];

    rowsHtml.push(renderRow(row, formats));
  });

  // Fila vacía de separación
  rowsHtml.push('<tr><td style="border:none; height: 18px;" colspan="55"></td></tr>');

  // 4. SECCIÓN COMPROBANTES ANULADOS
  rowsHtml.push('<tr><td class="section-title" colspan="55">COMPROBANTES ANULADOS</td></tr>');

  const anuladosHeaders = [
    'TipoIdInformante', 'IdInformante', 'razonSocial', 'Anio', 'Mes', 'numEstabRuc', 'totalVentas', 'codigoOperativo',
    'tipoComprobante', 'establecimiento', 'puntoEmision', 'secuencialInicio', 'secuencialFin', 'autorizacion'
  ];
  rowsHtml.push(`<tr>${anuladosHeaders.map(h => `<th>${h}</th>`).join('')}</tr>`);

  anulados.forEach(d => {
    const num = getSRIDocumentNumber(d);
    const partes = num.split('-');
    const estab = partes[0]?.padStart(3, '0') || '001';
    const ptoEmi = partes[1]?.padStart(3, '0') || '001';
    const sec    = partes[2]?.padStart(9, '0') || '000000001';

    const row = [
      ...baseMetadata,
      mapTipoComprobante(d.transacciones?.tipo_comprobante),
      estab,
      ptoEmi,
      sec,
      sec,
      d.clave_acceso_xml || ''
    ];

    const formats = [
      'text', 'text', 'text', 'integer', 'text', 'text', 'number', 'text', // baseMetadata
      'text', 'text', 'text', 'text', 'text', 'text'
    ];

    rowsHtml.push(renderRow(row, formats));
  });

  // Construir archivo HTML-Excel completo
  const excelHtml = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta http-equiv="content-type" content="application/vnd.ms-excel; charset=UTF-8">
      <!--[if gte mso 9]>
      <xml>
        <x:ExcelWorkbook>
          <x:ExcelWorksheets>
            <x:ExcelWorksheet>
              <x:Name>ATS</x:Name>
              <x:WorksheetOptions>
                <x:DisplayGridlines/>
              </x:WorksheetOptions>
            </x:ExcelWorksheet>
          </x:ExcelWorksheets>
        </x:ExcelWorkbook>
      </xml>
      <![endif]-->
      <style>
        table { border-collapse: collapse; }
        th, td { font-family: 'Century Gothic', Arial, sans-serif; font-size: 10pt; }
        th { font-weight: bold; }
        .text { mso-number-format:"\\@"; }
        .number { mso-number-format:"0\\.00"; text-align: right; }
        .integer { mso-number-format:"0"; text-align: right; }
        .section-title { font-size: 11pt; font-weight: bold; font-family: 'Century Gothic', Arial, sans-serif; }
      </style>
    </head>
    <body>
      <table>
        ${rowsHtml.join('\n')}
      </table>
    </body>
    </html>
  `;

  const blob = new Blob([excelHtml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `ReporteATS_${mesStr}${anio}.xls`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
