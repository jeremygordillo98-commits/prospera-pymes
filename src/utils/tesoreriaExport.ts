import { generatePDFReport } from './pdfGenerator';

export const exportCuentasExcel = (docs: any[], type: 'cobrar' | 'pagar') => {
  const isCobrar = type === 'cobrar';
  const labelTercero = isCobrar ? 'Cliente' : 'Proveedor';
  const title = isCobrar ? 'Cuentas por Cobrar (Facturas de Clientes)' : 'Cuentas por Pagar (Facturas de Proveedores)';
  const metadata = [
    [title],
    [`Descargado el: ${new Date().toLocaleDateString('es-EC')} ${new Date().toLocaleTimeString('es-EC')}`],
    []
  ];
  const rows = [
    [labelTercero, 'Referencia', 'Concepto', 'Fecha Emisión', 'Fecha Vencimiento', 'Total ($)', 'Saldo Pendiente ($)', 'Estado']
  ];
  
  docs.forEach(doc => {
    rows.push([
      `"${(doc.entidades?.razon_social || '').replace(/"/g, '""')}"`,
      `"${doc.referencia || ''}"`,
      `"${(doc.concepto || '').replace(/"/g, '""')}"`,
      `"${doc.fecha_emision || ''}"`,
      `"${doc.fecha_vencimiento || ''}"`,
      `"${Number(doc.total || 0).toFixed(2)}"`,
      `"${Number(doc.saldo_pendiente || 0).toFixed(2)}"`,
      `"${doc.estado || ''}"`
    ]);
  });

  const csvString = "sep=,\n" + metadata.map(e => e.join(",")).join("\n") + "\n" + rows.map(e => e.join(",")).join("\n");
  const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  const fileNameTitle = isCobrar ? 'Cuentas_por_Cobrar' : 'Cuentas_por_Pagar';
  link.setAttribute("download", `${fileNameTitle}_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export const exportCuentasPDF = async (empresaId: string, docs: any[], type: 'cobrar' | 'pagar') => {
  const isCobrar = type === 'cobrar';
  const labelTercero = isCobrar ? 'Cliente' : 'Proveedor';
  const columns = [labelTercero, 'Referencia', 'Concepto', 'Fecha Venc.', 'Total', 'Saldo Pendiente', 'Estado'];
  
  const rows = docs.map(doc => [
    doc.entidades?.razon_social || '',
    doc.referencia || '',
    doc.concepto || '',
    doc.fecha_vencimiento || '',
    `$${Number(doc.total || 0).toFixed(2)}`,
    `$${Number(doc.saldo_pendiente || 0).toFixed(2)}`,
    doc.estado || ''
  ]);
  
  const title = isCobrar ? 'Cuentas por Cobrar' : 'Cuentas por Pagar';
  const subtitle = isCobrar ? 'Listado de facturas de clientes con saldos pendientes' : 'Listado de facturas de proveedores con saldos pendientes';
  
  await generatePDFReport(empresaId, title, subtitle, columns, rows);
};

export const exportHistorialExcel = (movimientos: any[], type: 'cobro' | 'pago') => {
  const isCobro = type === 'cobro';
  const labelTercero = isCobro ? 'Cliente' : 'Proveedor';
  const title = isCobro ? 'Historial de Cobros Aplicados' : 'Historial de Pagos Aplicados';
  const metadata = [
    [title],
    [`Descargado el: ${new Date().toLocaleDateString('es-EC')} ${new Date().toLocaleTimeString('es-EC')}`],
    []
  ];
  const rows = [
    ['Fecha', labelTercero, 'Factura Relacionada', 'Cuenta Financiera', 'Concepto', 'Referencia de Pago', 'Monto Aplicado ($)']
  ];
  
  movimientos.forEach(m => {
    rows.push([
      `"${m.fecha || ''}"`,
      `"${(m.entidades?.razon_social || '').replace(/"/g, '""')}"`,
      `"${m.documento?.referencia || 'Anticipo / Sin Factura'}"`,
      `"${(m.cuenta_financiera?.nombre || '—').replace(/"/g, '""')}"`,
      `"${(m.concepto || '').replace(/"/g, '""')}"`,
      `"${(m.referencia || '').replace(/"/g, '""')}"`,
      `"${Number(m.monto || 0).toFixed(2)}"`
    ]);
  });
  
  const csvString = "sep=,\n" + metadata.map(e => e.join(",")).join("\n") + "\n" + rows.map(e => e.join(",")).join("\n");
  const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  const fileNameTitle = isCobro ? 'Historial_de_Cobros' : 'Historial_de_Pagos';
  link.setAttribute("download", `${fileNameTitle}_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export const exportHistorialPDF = async (empresaId: string, movimientos: any[], type: 'cobro' | 'pago') => {
  const isCobro = type === 'cobro';
  const labelTercero = isCobro ? 'Cliente' : 'Proveedor';
  const columns = ['Fecha', labelTercero, 'Factura', 'Cta. Financiera', 'Concepto', 'Ref. Pago', 'Monto'];
  
  const rows = movimientos.map(m => [
    m.fecha || '',
    m.entidades?.razon_social || '',
    m.documento?.referencia || 'Sin Factura',
    m.cuenta_financiera?.nombre || '—',
    m.concepto || '',
    m.referencia || '',
    `$${Number(m.monto || 0).toFixed(2)}`
  ]);
  
  const title = isCobro ? 'Historial de Cobros' : 'Historial de Pagos';
  const subtitle = isCobro ? 'Registro de cobranzas aplicadas' : 'Registro de pagos realizados';
  
  await generatePDFReport(empresaId, title, subtitle, columns, rows);
};
