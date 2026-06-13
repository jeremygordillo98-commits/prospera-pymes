export interface DocSRI {
  id: string;
  base_12: number;
  base_0: number;
  base_no_objeto?: number;
  monto_iva: number;
  clave_acceso_xml: string;
  es_compra: boolean;
  forma_pago?: string;
  retenciones_aplicadas: any[];
  transacciones: {
    id: string;
    fecha: string;
    concepto: string;
    tipo_comprobante: string;
    numero_comprobante: string;
    entidades?: { 
      id: string;
      nombre: string; 
      razon_social: string;
      ruc_cedula: string; 
      tipo_identificacion?: string; 
      persona_tipo?: string 
    } | null;
  } | null;
}

interface EmpresaInfo {
  nombre_empresa: string;
  ruc_empresa: string;
}

export const getSRIDocumentNumber = (d: DocSRI): string => {
  const concepto = d.transacciones?.concepto || '';
  const numComp = (d.transacciones?.numero_comprobante || '').trim();
  const sriRegex = /\d{3}-\d{3}-\d{9}/;
  
  if (sriRegex.test(numComp)) {
    return numComp;
  }
  const matchConcepto = concepto.match(sriRegex);
  if (matchConcepto) {
    return matchConcepto[0];
  }
  const clave = d.clave_acceso_xml || '';
  if (clave.length >= 39) {
    return `${clave.substring(24,27)}-${clave.substring(27,30)}-${clave.substring(30,39)}`;
  }
  return numComp;
};

const mapIdProv = (tipoId: string | undefined): string => {
  if (!tipoId) return '01';
  if (tipoId === '04') return '01';
  if (tipoId === '05') return '02';
  if (tipoId === '06' || tipoId === '08') return '03';
  return tipoId;
};

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

export const buildATSXml = (empresa: EmpresaInfo, anio: number, mes: number, docs: DocSRI[]): string => {
  const mesStr = String(mes).padStart(2, '0');
  
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
  const totalVentasSRI = (totalBase12Ventas + totalBase0Ventas + totalBaseNoObjetoVentas).toFixed(2);

  const estabsUnicos = [...new Set(docs.map(d => {
    const num = getSRIDocumentNumber(d);
    const partes = num.split('-');
    return partes[0]?.padStart(3, '0') || '001';
  }))];
  const numEstabs = String(estabsUnicos.length).padStart(3, '0');

  // Agrupamiento de Ventas por Cliente y Tipo de Comprobante para el ATS
  const ventasAgrupadasPorClienteYComp = Object.values(
    ventas.reduce((acc, v) => {
      const ent = v.transacciones?.entidades;
      const idCliente = ent?.ruc_cedula || '9999999999999';
      const isNC = v.transacciones?.tipo_comprobante === 'Nota de Crédito';
      const tipoComp = isNC ? '04' : '01';
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

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<iva>\n`;
  xml += `  <TipoIDInformante>R</TipoIDInformante>\n`;
  xml += `  <IdInformante>${empresa.ruc_empresa}</IdInformante>\n`;
  xml += `  <razonSocial>${empresa.nombre_empresa.replace(/&/g, '&amp;')}</razonSocial>\n`;
  xml += `  <Anio>${anio}</Anio>\n`;
  xml += `  <Mes>${mesStr}</Mes>\n`;
  xml += `  <numEstabRuc>${numEstabs}</numEstabRuc>\n`;
  xml += `  <totalVentas>${totalVentasSRI}</totalVentas>\n`;
  xml += `  <codigoOperativo>IVA</codigoOperativo>\n`;

  // 1. Módulo Compras
  xml += `  <compras>\n`;
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

    // Extraer metadata del primer objeto si existe (cod_sustento, numero_retencion, etc.)
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

    xml += `    <detalleCompras>\n`;
    xml += `      <codSustento>${codSustento}</codSustento>\n`;
    xml += `      <tpIdProv>${mapIdProv(ent?.tipo_identificacion)}</tpIdProv>\n`;
    xml += `      <idProv>${ent?.ruc_cedula || ''}</idProv>\n`;
    xml += `      <tipoComprobante>${tipoComp}</tipoComprobante>\n`;
    xml += `      <parteRel>NO</parteRel>\n`;
    xml += `      <fechaRegistro>${fechaFormat}</fechaRegistro>\n`;
    xml += `      <establecimiento>${estab}</establecimiento>\n`;
    xml += `      <emisionPuntoEmision>${ptoEmi}</emisionPuntoEmision>\n`;
    xml += `      <secuencial>${sec}</secuencial>\n`;
    xml += `      <fechaEmision>${fechaFormat}</fechaEmision>\n`;
    xml += `      <autorizacion>${d.clave_acceso_xml || ''}</autorizacion>\n`;
    xml += `      <baseNoGraIva>${(d.base_no_objeto || 0).toFixed(2)}</baseNoGraIva>\n`;
    xml += `      <baseImponible>${(d.base_0 || 0).toFixed(2)}</baseImponible>\n`;
    xml += `      <baseImpGrav>${(d.base_12 || 0).toFixed(2)}</baseImpGrav>\n`;
    xml += `      <montoIce>0.00</montoIce>\n`;
    xml += `      <montoIva>${(d.monto_iva || 0).toFixed(2)}</montoIva>\n`;
    xml += `      <valRetBien10>${ret10.toFixed(2)}</valRetBien10>\n`;
    xml += `      <valRetServ20>${ret20.toFixed(2)}</valRetServ20>\n`;
    xml += `      <valorRetBienes>${ret30.toFixed(2)}</valorRetBienes>\n`;
    xml += `      <valRetServ50>${ret50.toFixed(2)}</valRetServ50>\n`;
    xml += `      <valorRetServicios>${ret70.toFixed(2)}</valorRetServicios>\n`;
    xml += `      <valRetServ100>${ret100.toFixed(2)}</valRetServ100>\n`;
    xml += `      <totbasesImpReemb>0.00</totbasesImpReemb>\n`;
    xml += `      <pagoExterior>\n        <pagoLocExt>01</pagoLocExt>\n      </pagoExterior>\n`;
    xml += `      <formasDePago>\n        <formaPago>${fp}</formaPago>\n      </formasDePago>\n`;
    
    if (retRenta.length > 0) {
      const activeRenta = retRenta.filter(r => r.valor > 0 || r.porcentaje > 0);
      if (activeRenta.length > 0) {
        xml += `      <air>\n`;
        activeRenta.forEach((r: any) => {
          xml += `        <detalleAir>\n`;
          xml += `          <codRetAir>${r.codigo || '332'}</codRetAir>\n`;
          xml += `          <baseImpAir>${(r.base || d.base_12 || 0).toFixed(2)}</baseImpAir>\n`;
          xml += `          <porcentajeAir>${r.porcentaje || 0}</porcentajeAir>\n`;
          xml += `          <valRetAir>${(r.valor || 0).toFixed(2)}</valRetAir>\n`;
          xml += `        </detalleAir>\n`;
        });
        xml += `      </air>\n`;
      }
    }

    // Inyección de referencias del comprobante de retención emitido en compra
    const tieneRetencion = retRenta.some(r => r.valor > 0) || retIVA.some(r => r.valor > 0);
    const numRet = metadataObj?.numero_retencion;
    const autRet = metadataObj?.clave_retencion;
    const fechaRet = metadataObj?.fecha_retencion;

    if (tieneRetencion && numRet && numRet !== 'Manual') {
      const partesRet = numRet.split('-');
      if (partesRet.length === 3) {
        const estabRet = partesRet[0].padStart(3, '0');
        const ptoEmiRet = partesRet[1].padStart(3, '0');
        const secRet = partesRet[2].padStart(9, '0');
        const fechaRetFormat = formatDateForSRI(fechaRet);

        xml += `      <estabRetencion1>${estabRet}</estabRetencion1>\n`;
        xml += `      <ptoEmiRetencion1>${ptoEmiRet}</ptoEmiRetencion1>\n`;
        xml += `      <secRetencion1>${secRet}</secRetencion1>\n`;
        xml += `      <autRetencion1>${autRet || '9999999999999999999999999999999999999999999999999'}</autRetencion1>\n`;
        xml += `      <fechaEmiRet1>${fechaRetFormat}</fechaEmiRet1>\n`;
      }
    }

    // Inyección de referencias de documento original modificado en Nota de Crédito
    if (isNC) {
      const concepto = d.transacciones?.concepto || '';
      const regexMod = /(\d{3})-(\d{3})-(\d{9})/;
      const matchMod = concepto.match(regexMod);
      let estabMod = '001';
      let ptoEmiMod = '001';
      let secMod = '000000001';
      if (matchMod) {
        estabMod = matchMod[1];
        ptoEmiMod = matchMod[2];
        secMod = matchMod[3];
      }

      xml += `      <docModificado>01</docModificado>\n`;
      xml += `      <estabModificado>${estabMod}</estabModificado>\n`;
      xml += `      <ptoEmiModificado>${ptoEmiMod}</ptoEmiModificado>\n`;
      xml += `      <secModificado>${secMod}</secModificado>\n`;
      xml += `      <autModificado>${d.clave_acceso_xml || '9999999999999999999999999999999999999999999999999'}</autModificado>\n`;
    }

    xml += `    </detalleCompras>\n`;
  });
  xml += `  </compras>\n`;

  // 2. Módulo Ventas
  xml += `  <ventas>\n`;
  ventasAgrupadasPorClienteYComp.forEach((v: any) => {
    xml += `    <detalleVentas>\n`;
    xml += `      <tpIdCliente>${v.tipoId}</tpIdCliente>\n`;
    xml += `      <idCliente>${v.ruc}</idCliente>\n`;
    xml += `      <parteRelVentas>NO</parteRelVentas>\n`;
    xml += `      <tipoComprobante>${v.tipoComprobante}</tipoComprobante>\n`;
    xml += `      <numeroComprobantes>${v.numeroComprobantes}</numeroComprobantes>\n`;
    xml += `      <baseNoGraIva>${v.baseNoObjeto.toFixed(2)}</baseNoGraIva>\n`;
    xml += `      <baseImponible>${v.base0.toFixed(2)}</baseImponible>\n`;
    xml += `      <baseImpGrav>${v.base12.toFixed(2)}</baseImpGrav>\n`;
    xml += `      <montoIva>${v.iva.toFixed(2)}</montoIva>\n`;
    xml += `      <montoIce>0.00</montoIce>\n`;
    xml += `      <valorRetIva>${v.retIva.toFixed(2)}</valorRetIva>\n`;
    xml += `      <valorRetRenta>${v.retRenta.toFixed(2)}</valorRetRenta>\n`;
    xml += `      <formasDePago>\n        <formaPago>${v.formaPago}</formaPago>\n      </formasDePago>\n`;
    xml += `    </detalleVentas>\n`;
  });
  xml += `  </ventas>\n`;

  // 3. Módulo Ventas por Establecimiento
  xml += `  <ventasEstablecimiento>\n`;
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

    xml += `    <ventaEstablecimiento>\n`;
    xml += `      <codEstab>${est}</codEstab>\n`;
    xml += `      <ventasEstab>${totalEstab.toFixed(2)}</ventasEstab>\n`;
    xml += `      <ivaComp>0.00</ivaComp>\n`;
    xml += `    </ventaEstablecimiento>\n`;
  });
  xml += `  </ventasEstablecimiento>\n`;

  // 4. Módulo Anulados
  xml += `  <anulados>\n`;
  anulados.forEach(d => {
    const num = getSRIDocumentNumber(d);
    const partes = num.split('-');
    const estab = partes[0]?.padStart(3, '0') || '001';
    const ptoEmi = partes[1]?.padStart(3, '0') || '001';
    const sec    = partes[2]?.padStart(9, '0') || '000000001';

    xml += `    <detalleAnulados>\n`;
    xml += `      <tipoComprobante>01</tipoComprobante>\n`;
    xml += `      <establecimiento>${estab}</establecimiento>\n`;
    xml += `      <puntoEmision>${ptoEmi}</puntoEmision>\n`;
    xml += `      <secuencialInicio>${sec}</secuencialInicio>\n`;
    xml += `      <secuencialFin>${sec}</secuencialFin>\n`;
    xml += `      <autorizacion>${d.clave_acceso_xml || ''}</autorizacion>\n`;
    xml += `    </detalleAnulados>\n`;
  });
  xml += `  </anulados>\n`;
  xml += `</iva>`;

  return xml;
};

