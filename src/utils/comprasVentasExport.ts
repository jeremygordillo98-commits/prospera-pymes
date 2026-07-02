import { supabase } from '../services/supabase';

// Helper to format date from YYYY-MM-DD to DD/MM/YYYY
const formatDate = (dateStr: string | undefined | null) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
};

// Extract voucher number from clave_acceso_xml
const getInvoiceNumberFromClave = (clave: string | undefined | null, tipoComprobante: string) => {
  if (!clave || clave.length !== 49) return '';
  const establishment = clave.slice(24, 27);
  const emissionPoint = clave.slice(27, 30);
  const sequential = clave.slice(30, 39);
  
  const isNC = tipoComprobante === 'Nota de Crédito';
  const isRet = tipoComprobante === 'Comprobante de Retención';
  const prefix = isNC ? 'NCT' : isRet ? 'RET' : 'FAC';
  
  return `${prefix} ${establishment}-${emissionPoint}-${sequential}`;
};

// Helper to escape HTML characters
const escapeHtml = (str: string | undefined | null) => {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

// Format Cod. Sustento to show with leading zeros if numeric
const formatCodSustento = (val: string | number | undefined | null) => {
  if (val === undefined || val === null || val === '') return '-';
  const str = String(val).trim();
  if (str === '-') return '-';
  if (/^\d+$/.test(str)) {
    return str.padStart(2, '0');
  }
  return str;
};

// Helper to extract raw invoice number for payment matching
const extractRawInvoiceNum = (concepto: string, numComp: string) => {
  const match = concepto.match(/\d{3}-\d{3}-\d{9}/);
  if (match) return match[0];
  const matchNum = numComp.match(/\d{3}-\d{3}-\d{9}/);
  if (matchNum) return matchNum[0];
  return numComp;
};

export const exportComprasVentasExcel = async (empresaId: string, desde: string, hasta: string, sriDocs: any[]) => {
  // Fetch company metadata
  const { data: empresa } = await supabase
    .from('empresas_gestionadas')
    .select('nombre_empresa')
    .eq('id', empresaId)
    .single();

  const empresaNombre = empresa?.nombre_empresa || 'Empresa';

  // Fetch tesoreria documents and movements to match payment/cobro details
  const { data: tesoDocs } = await supabase
    .from('tesoreria_documentos')
    .select('id, referencia')
    .eq('id_empresa', empresaId);

  const { data: tesoMovs } = await supabase
    .from('tesoreria_movimientos')
    .select('id_documento, concepto')
    .eq('id_empresa', empresaId);

  // Format date range string
  let periodText = 'Histórico Completo';
  if (desde && hasta) {
    const dDate = new Date(desde + 'T12:00:00');
    const hDate = new Date(hasta + 'T12:00:00');
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    
    if (dDate.getMonth() === hDate.getMonth() && dDate.getFullYear() === hDate.getFullYear()) {
      periodText = `${months[dDate.getMonth()]} del ${dDate.getFullYear()}`;
    } else {
      periodText = `Desde ${formatDate(desde)} hasta ${formatDate(hasta)}`;
    }
  } else if (desde) {
    periodText = `Desde ${formatDate(desde)}`;
  } else if (hasta) {
    periodText = `Hasta ${formatDate(hasta)}`;
  }

  // Filter documents by date period
  const periodDocs = sriDocs.filter(d => {
    const f = d.transacciones?.fecha || '';
    if (desde && f < desde) return false;
    if (hasta && f > hasta) return false;
    return true;
  });

  const compras = periodDocs.filter(d => d.es_compra);
  const ventas = periodDocs.filter(d => !d.es_compra);

  const headers = [
    'F. Emisión', 'RUC', 'Razón Social', 'Detalle', 'No. Comprobante', 'No. Autorización', 
    'Cod. Sustento', 'Cod. Asiento', 'Centro de Costo', '15%', '5%', 'IVA diferenciado', 
    '0%', 'No objeto', 'Subtotal', 'IVA', 'IVA Gasto', 'ICE', 'Total', 
    '10%', '20%', '30%', '50%', '70%', '100%', 'Subtotal', 
    'Fecha Retención', 'No. Retención', 'No. Autorización', 
    '1%', 'Cod.', '1.75%', 'Cod.', '2%', 'Cod.', '2.75%', 'Cod.', '8%', 'Cod.', '10%', 'Cod.', '0%', 'Cod.', 'Otros %', 'Cod.', 
    'Subtotal', 'Total Retenciones'
  ];

  const buildSectionRowsHtml = (docs: any[]) => {
    const allRowsCells = docs.map(d => {
      const tx = d.transacciones || {};
      const ent = tx.entidades || {};
      
      const subtotal12 = Number(d.base_12 || 0);
      const subtotal0 = Number(d.base_0 || 0);
      const subtotalNoObj = Number(d.base_no_objeto || 0);
      const subtotal = subtotal12 + subtotal0 + subtotalNoObj;
      const montoIva = Number(d.monto_iva || 0);
      
      // Determine if IVA is Gasto
      const isFuel = (tx.concepto || '').toLowerCase().includes('diesel') || (tx.concepto || '').toLowerCase().includes('gasolina') || (tx.concepto || '').toLowerCase().includes('combustible');
      const ivaVal = isFuel && d.es_compra ? 0 : montoIva;
      const ivaGastoVal = isFuel && d.es_compra ? montoIva : 0;
      
      const total = subtotal + ivaVal + ivaGastoVal;

      // Extract withholdings
      let codSustento = '-';
      let retIva10 = 0, retIva20 = 0, retIva30 = 0, retIva50 = 0, retIva70 = 0, retIva100 = 0;
      let retFuente1 = 0, retFuente1_75 = 0, retFuente2 = 0, retFuente2_75 = 0, retFuente8 = 0, retFuente10 = 0, retFuente0 = 0, retFuenteOtros = 0;
      
      let codFuente1 = '', codFuente1_75 = '', codFuente2 = '', codFuente2_75 = '', codFuente8 = '', codFuente10 = '', codFuente0 = '', codFuenteOtros = '';
      
      let fechaRetencion = '';
      let numeroRetencion = '';
      let autorizacionRetencion = '';

      if (Array.isArray(d.retenciones_aplicadas)) {
        const metadata = d.retenciones_aplicadas.find((r: any) => r.cod_sustento || r.numero_retencion || r.fecha_retencion);
        if (metadata) {
          codSustento = metadata.cod_sustento || '-';
          numeroRetencion = metadata.numero_retencion || '';
          fechaRetencion = metadata.fecha_retencion ? formatDate(metadata.fecha_retencion.split('T')[0]) : '';
          autorizacionRetencion = metadata.clave_acceso_retencion || metadata.numero_autorizacion_retencion || '';
        }

        d.retenciones_aplicadas.forEach((r: any) => {
          if (r.tipo === 'METADATA') return;
          
          if (r.tipo === 'IVA') {
            const pct = parseFloat(r.porcentaje);
            const val = Number(r.valor || 0);
            if (pct === 10) retIva10 += val;
            else if (pct === 20) retIva20 += val;
            else if (pct === 30) retIva30 += val;
            else if (pct === 50) retIva50 += val;
            else if (pct === 70) retIva70 += val;
            else if (pct === 100) retIva100 += val;
            
            if (r.fecha_retencion && !fechaRetencion) {
              fechaRetencion = formatDate(r.fecha_retencion.split('T')[0]);
            }
            if (r.numero_retencion && !numeroRetencion) {
              numeroRetencion = r.numero_retencion;
            }
            if ((r.clave_acceso_retencion || r.numero_autorizacion_retencion) && !autorizacionRetencion) {
              autorizacionRetencion = r.clave_acceso_retencion || r.numero_autorizacion_retencion;
            }
          } else { // RENTA / FUENTE
            const pct = parseFloat(r.porcentaje);
            const val = Number(r.valor || 0);
            const code = r.codigo || '';
            
            if (pct === 1) { retFuente1 += val; codFuente1 = code; }
            else if (pct === 1.75) { retFuente1_75 += val; codFuente1_75 = code; }
            else if (pct === 2) { retFuente2 += val; codFuente2 = code; }
            else if (pct === 2.75) { retFuente2_75 += val; codFuente2_75 = code; }
            else if (pct === 8) { retFuente8 += val; codFuente8 = code; }
            else if (pct === 10) { retFuente10 += val; codFuente10 = code; }
            else if (pct === 0) { retFuente0 += val; codFuente0 = code; }
            else { retFuenteOtros += val; codFuenteOtros = code; }

            if (r.fecha_retencion && !fechaRetencion) {
              fechaRetencion = formatDate(r.fecha_retencion.split('T')[0]);
            }
            if (r.numero_retencion && !numeroRetencion) {
              numeroRetencion = r.numero_retencion;
            }
            if ((r.clave_acceso_retencion || r.numero_autorizacion_retencion) && !autorizacionRetencion) {
              autorizacionRetencion = r.clave_acceso_retencion || r.numero_autorizacion_retencion;
            }
          }
        });
      }

      const subtotalIvaRet = retIva10 + retIva20 + retIva30 + retIva50 + retIva70 + retIva100;
      const subtotalFuenteRet = retFuente1 + retFuente1_75 + retFuente2 + retFuente2_75 + retFuente8 + retFuente10 + retFuente0 + retFuenteOtros;
      const totalRetenciones = subtotalIvaRet + subtotalFuenteRet;

      // Extract payment/cobro details
      const rawInvoiceNum = extractRawInvoiceNum(tx.concepto || '', tx.numero_comprobante || '');
      const matchingTesoDoc = tesoDocs?.find(td => {
        if (!td.referencia) return false;
        const cleanRef = td.referencia.replace(/\s+/g, '');
        return cleanRef.includes(rawInvoiceNum) || rawInvoiceNum.includes(cleanRef);
      });

      let detail = tx.concepto || '';
      const isDefaultConcept = /^(factura|nota de cr|nota de dd|liquidaci|retenci):/i.test(detail);
      if (isDefaultConcept && matchingTesoDoc) {
        const matchingMovs = tesoMovs?.filter(tm => tm.id_documento === matchingTesoDoc.id) || [];
        const paymentDetails = matchingMovs.map(m => m.concepto).filter(Boolean).join(' | ');
        if (paymentDetails) {
          detail = paymentDetails;
        }
      }

      return [
        { val: formatDate(tx.fecha), isText: true },
        { val: ent.ruc_cedula || '', isText: true },
        { val: ent.razon_social || '', isText: false },
        { val: detail, isText: false },
        { val: getInvoiceNumberFromClave(d.clave_acceso_xml, tx.tipo_comprobante || ''), isText: true },
        { val: d.clave_acceso_xml || '', isText: true },
        { val: formatCodSustento(codSustento), isText: true },
        { val: tx.numero_comprobante || '', isText: true },
        { val: '', isText: true }, // Centro Costo
        { val: subtotal12, isNumber: true },
        { val: 0, isNumber: true }, // 5%
        { val: 0, isNumber: true }, // IVA dif
        { val: subtotal0, isNumber: true },
        { val: subtotalNoObj, isNumber: true },
        { val: subtotal, isNumber: true },
        { val: ivaVal, isNumber: true },
        { val: ivaGastoVal, isNumber: true },
        { val: 0, isNumber: true }, // ICE
        { val: total, isNumber: true },
        { val: retIva10, isNumber: true },
        { val: retIva20, isNumber: true },
        { val: retIva30, isNumber: true },
        { val: retIva50, isNumber: true },
        { val: retIva70, isNumber: true },
        { val: retIva100, isNumber: true },
        { val: subtotalIvaRet, isNumber: true },
        { val: fechaRetencion, isText: true },
        { val: numeroRetencion, isText: true },
        { val: autorizacionRetencion, isText: true },
        { val: retFuente1, isNumber: true },
        { val: codFuente1, isText: true },
        { val: retFuente1_75, isNumber: true },
        { val: codFuente1_75, isText: true },
        { val: retFuente2, isNumber: true },
        { val: codFuente2, isText: true },
        { val: retFuente2_75, isNumber: true },
        { val: codFuente2_75, isText: true },
        { val: retFuente8, isNumber: true },
        { val: codFuente8, isText: true },
        { val: retFuente10, isNumber: true },
        { val: codFuente10, isText: true },
        { val: retFuente0, isNumber: true },
        { val: codFuente0, isText: true },
        { val: retFuenteOtros, isNumber: true },
        { val: codFuenteOtros, isText: true },
        { val: subtotalFuenteRet, isNumber: true },
        { val: totalRetenciones, isNumber: true }
      ];
    });

    const dataRowsHtml = allRowsCells.map(cells => {
      return `<tr>${cells.map(c => {
        if (c.isText) {
          return `<td class="text">${escapeHtml(String(c.val))}</td>`;
        }
        if (c.isNumber) {
          const num = Number(c.val || 0);
          return `<td class="number">${num.toFixed(2)}</td>`;
        }
        return `<td>${escapeHtml(String(c.val))}</td>`;
      }).join('')}</tr>`;
    }).join('\n');

    // Build Totales row
    const numericIndices = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 29, 31, 33, 35, 37, 39, 41, 43, 45, 46];
    const totalsCells: string[] = [];
    for (let i = 0; i < 47; i++) {
      if (numericIndices.includes(i)) {
        const sum = allRowsCells.reduce((acc, cells) => acc + Number(cells[i].val || 0), 0);
        totalsCells.push(`<td class="number" style="font-weight:bold; background-color: #F3F4F6; color: #111827;">${sum.toFixed(2)}</td>`);
      } else if (i === 2) {
        totalsCells.push(`<td style="font-weight:bold; background-color: #F3F4F6; color: #111827;">TOTALES</td>`);
      } else {
        totalsCells.push(`<td style="background-color: #F3F4F6;"></td>`);
      }
    }
    const totalsRowHtml = `<tr>${totalsCells.join('')}</tr>`;

    return dataRowsHtml + '\n' + totalsRowHtml;
  };

  const comprasHtml = buildSectionRowsHtml(compras);
  const ventasHtml = buildSectionRowsHtml(ventas);

  const excelHtml = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta http-equiv="content-type" content="application/vnd.ms-excel; charset=UTF-8">
      <style>
        table { border-collapse: collapse; }
        th, td { border: 0.5pt solid #D1D5DB; padding: 6px 10px; font-family: 'Segoe UI', Calibri, sans-serif; font-size: 10pt; }
        th { background-color: #F3F4F6; font-weight: bold; color: #374151; }
        .text { mso-number-format:"\\@"; }
        .number { mso-number-format:"0\\.00"; text-align: right; }
        .title { font-size: 16pt; font-weight: bold; border: none; color: #111827; }
        .subtitle { font-size: 10.5pt; color: #4B5563; border: none; }
      </style>
    </head>
    <body>
      <table>
        <tr><td class="title" colspan="6">${escapeHtml(empresaNombre)}</td></tr>
        <tr><td class="subtitle" colspan="6">DETALLE DE VENTAS Y COMPRAS PARA FORMULARIOS 103 Y 104</td></tr>
        <tr><td class="subtitle" colspan="6">${escapeHtml(periodText)}</td></tr>
        <tr><td class="subtitle" colspan="6">Descargado el: ${escapeHtml(new Date().toLocaleDateString('es-EC'))} ${escapeHtml(new Date().toLocaleTimeString('es-EC'))}</td></tr>
        <tr><td style="border:none;"></td></tr>
        
        <tr><td class="title" colspan="6" style="color: #D97706; font-size: 13pt; font-weight: bold;">COMPRAS</td></tr>
        <tr>
          ${headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}
        </tr>
        ${comprasHtml}
        
        <tr><td style="border:none;"></td></tr>
        <tr><td style="border:none;"></td></tr>
        
        <tr><td class="title" colspan="6" style="color: #6D28D9; font-size: 13pt; font-weight: bold;">VENTAS</td></tr>
        <tr>
          ${headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}
        </tr>
        ${ventasHtml}
      </table>
    </body>
    </html>
  `;

  const blob = new Blob([excelHtml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `Reporte_Compras_Ventas_${empresaNombre.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xls`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
