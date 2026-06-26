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

// Helper to clean and format strings for CSV
const csvStr = (str: string | undefined | null) => {
  if (!str) return '""';
  return `"${str.replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
};

// Extract voucher number from concept
const getInvoiceNumber = (concepto: string) => {
  const match = concepto.match(/\d{3}-\d{3}-\d{9}/);
  if (match) {
    const isNC = concepto.toLowerCase().includes('nc:') || concepto.toLowerCase().includes('nota');
    const isRet = concepto.toLowerCase().includes('retención') || concepto.toLowerCase().includes('retencion');
    const prefix = isNC ? 'NCT' : isRet ? 'RET' : 'FAC';
    return `${prefix} ${match[0]}`;
  }
  return concepto;
};

export const exportComprasVentasExcel = async (empresaId: string, desde: string, hasta: string, sriDocs: any[]) => {
  // Fetch company metadata
  const { data: empresa } = await supabase
    .from('empresas_gestionadas')
    .select('nombre_empresa')
    .eq('id', empresaId)
    .single();

  const empresaNombre = empresa?.nombre_empresa || 'Empresa';

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

  const buildSectionRows = (docs: any[]) => {
    return docs.map(d => {
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
        // Extract metadata first
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

      return [
        csvStr(formatDate(tx.fecha)),
        csvStr(ent.ruc_cedula || ''),
        csvStr(ent.razon_social || ''),
        csvStr(tx.concepto || ''),
        csvStr(getInvoiceNumber(tx.concepto || '')),
        csvStr(d.clave_acceso_xml || ''),
        csvStr(codSustento),
        csvStr(tx.numero_comprobante || ''),
        csvStr(''), // Centro Costo
        subtotal12,
        0, // 5%
        0, // IVA dif
        subtotal0,
        subtotalNoObj,
        subtotal,
        ivaVal,
        ivaGastoVal,
        0, // ICE
        total,
        retIva10,
        retIva20,
        retIva30,
        retIva50,
        retIva70,
        retIva100,
        subtotalIvaRet,
        csvStr(fechaRetencion),
        csvStr(numeroRetencion),
        csvStr(autorizacionRetencion),
        retFuente1,
        csvStr(codFuente1),
        retFuente1_75,
        csvStr(codFuente1_75),
        retFuente2,
        csvStr(codFuente2),
        retFuente2_75,
        csvStr(codFuente2_75),
        retFuente8,
        csvStr(codFuente8),
        retFuente10,
        csvStr(codFuente10),
        retFuente0,
        csvStr(codFuente0),
        retFuenteOtros,
        csvStr(codFuenteOtros),
        subtotalFuenteRet,
        totalRetenciones
      ];
    });
  };

  const csvRows: any[][] = [];

  // Metadata
  csvRows.push([csvStr(empresaNombre)]);
  csvRows.push([csvStr('DETALLE DE VENTAS Y COMPRAS PARA FORMULARIOS 103 Y 104')]);
  csvRows.push([csvStr(periodText)]);
  csvRows.push([csvStr(`Descargado el: ${new Date().toLocaleDateString('es-EC')} ${new Date().toLocaleTimeString('es-EC')}`)]);
  csvRows.push([]);
  csvRows.push([]);

  // Compras Section
  csvRows.push([csvStr('COMPRAS')]);
  csvRows.push(headers.map(h => csvStr(h)));
  const comprasRows = buildSectionRows(compras);
  comprasRows.forEach(r => csvRows.push(r));

  // Spacing
  csvRows.push([]);
  csvRows.push([]);

  // Ventas Section
  csvRows.push([csvStr('VENTAS')]);
  csvRows.push(headers.map(h => csvStr(h)));
  const ventasRows = buildSectionRows(ventas);
  ventasRows.forEach(r => csvRows.push(r));

  // Build CSV string
  const csvString = "sep=,\n" + csvRows.map(row => {
    // Fill empty cells up to max length so row lengths look uniform
    const padded = [...row];
    while (padded.length < headers.length) {
      padded.push('');
    }
    return padded.join(",");
  }).join("\n");

  const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `Reporte_Compras_Ventas_${empresaNombre.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
