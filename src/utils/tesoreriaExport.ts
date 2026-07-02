import { generatePDFReport } from './pdfGenerator';

const escapeHtml = (str: string | undefined | null) => {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

export const exportCuentasExcel = (docs: any[], type: 'cobrar' | 'pagar') => {
  const isCobrar = type === 'cobrar';
  const labelTercero = isCobrar ? 'Cliente' : 'Proveedor';
  const title = isCobrar ? 'Cuentas por Cobrar (Facturas de Clientes)' : 'Cuentas por Pagar (Facturas de Proveedores)';
  
  const headers = [labelTercero, 'Referencia', 'Concepto', 'Fecha Emisión', 'Fecha Vencimiento', 'Total ($)', 'Saldo Pendiente ($)', 'Estado'];
  
  const rowsHtml = docs.map(doc => {
    const cells = [
      { val: doc.entidades?.razon_social || '', isText: false },
      { val: doc.referencia || '', isText: true },
      { val: doc.concepto || '', isText: false },
      { val: doc.fecha_emision || '', isText: true },
      { val: doc.fecha_vencimiento || '', isText: true },
      { val: Number(doc.total || 0), isNumber: true },
      { val: Number(doc.saldo_pendiente || 0), isNumber: true },
      { val: doc.estado || '', isText: false }
    ];

    return `<tr>${cells.map(c => {
      if (c.isText) return `<td class="text">${escapeHtml(String(c.val))}</td>`;
      if (c.isNumber) return `<td class="number">${Number(c.val || 0).toFixed(2)}</td>`;
      return `<td>${escapeHtml(String(c.val))}</td>`;
    }).join('')}</tr>`;
  }).join('\n');

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
        <tr><td class="title" colspan="8">${escapeHtml(title)}</td></tr>
        <tr><td class="subtitle" colspan="8">Descargado el: ${escapeHtml(new Date().toLocaleDateString('es-EC'))} ${escapeHtml(new Date().toLocaleTimeString('es-EC'))}</td></tr>
        <tr><td style="border:none;"></td></tr>
        <tr>
          ${headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}
        </tr>
        ${rowsHtml}
      </table>
    </body>
    </html>
  `;

  const blob = new Blob([excelHtml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  const fileNameTitle = isCobrar ? 'Cuentas_por_Cobrar' : 'Cuentas_por_Pagar';
  link.setAttribute("download", `${fileNameTitle}_${new Date().toISOString().split('T')[0]}.xls`);
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

  const headers = ['Fecha', labelTercero, 'Factura Relacionada', 'Cuenta Financiera', 'Concepto', 'Referencia de Pago', 'Monto Aplicado ($)'];
  
  const rowsHtml = movimientos.map(m => {
    const cells = [
      { val: m.fecha || '', isText: true },
      { val: m.entidades?.razon_social || '', isText: false },
      { val: m.documento?.referencia || 'Anticipo / Sin Factura', isText: true },
      { val: m.cuenta_financiera?.nombre || '—', isText: false },
      { val: m.concepto || '', isText: false },
      { val: m.referencia || '', isText: true },
      { val: Number(m.monto || 0), isNumber: true }
    ];

    return `<tr>${cells.map(c => {
      if (c.isText) return `<td class="text">${escapeHtml(String(c.val))}</td>`;
      if (c.isNumber) return `<td class="number">${Number(c.val || 0).toFixed(2)}</td>`;
      return `<td>${escapeHtml(String(c.val))}</td>`;
    }).join('')}</tr>`;
  }).join('\n');

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
        <tr><td class="title" colspan="7">${escapeHtml(title)}</td></tr>
        <tr><td class="subtitle" colspan="7">Descargado el: ${escapeHtml(new Date().toLocaleDateString('es-EC'))} ${escapeHtml(new Date().toLocaleTimeString('es-EC'))}</td></tr>
        <tr><td style="border:none;"></td></tr>
        <tr>
          ${headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}
        </tr>
        ${rowsHtml}
      </table>
    </body>
    </html>
  `;

  const blob = new Blob([excelHtml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  const fileNameTitle = isCobro ? 'Historial_de_Cobros' : 'Historial_de_Pagos';
  link.setAttribute("download", `${fileNameTitle}_${new Date().toISOString().split('T')[0]}.xls`);
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
