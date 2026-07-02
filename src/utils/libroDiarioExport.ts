import { generatePDFReport, generateLibroDiarioPDF } from './pdfGenerator';
import type { Transaction } from '../hooks/useLibroDiario';

export const getDocDetails = (tx: Transaction) => {
  const match = tx.concepto.match(/\d{3}-\d{3}-\d{9}/);
  const docNumber = match ? match[0] : null;

  if (docNumber) {
    let label = 'Ref';
    if (tx.tipo_comprobante === 'Factura') label = 'Factura';
    else if (tx.tipo_comprobante === 'Comprobante de Retención' || tx.tipo_comprobante?.includes('Retención') || tx.tipo_comprobante?.includes('Retencion')) label = 'Retención';
    else if (tx.tipo_comprobante === 'Nota de Crédito' || tx.tipo_comprobante?.includes('Crédito') || tx.tipo_comprobante?.includes('Credito')) label = 'Nota de Crédito';
    
    return `Comprobante #${tx.numero_comprobante} • ${label}: ${docNumber}`;
  }

  return `Comprobante #${tx.numero_comprobante}`;
};

const escapeHtml = (str: string | undefined | null) => {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

export const exportToExcel = (filteredTransactions: Transaction[], filterDate: string) => {
  const headers = ['Fecha', 'Concepto', 'Comprobante', 'Entidad', 'Codigo Cuenta', 'Nombre Cuenta', 'Debe', 'Haber'];
  
  const rowsHtml: string[] = [];
  
  filteredTransactions.forEach((tx, txIdx) => {
    if (txIdx > 0) {
      rowsHtml.push('<tr><td style="border:none; height: 18px;" colspan="8"></td></tr>');
    }
    tx.movimientos.forEach(m => {
      const cells = [
        { val: tx.fecha, isText: true },
        { val: tx.concepto || '', isText: false },
        { val: getDocDetails(tx), isText: true },
        { val: tx.entidades?.razon_social || '', isText: false },
        { val: m.plan_cuentas?.codigo_cuenta || '', isText: true },
        { val: m.plan_cuentas?.nombre || '', isText: false },
        { val: Number(m.debe || 0), isNumber: true },
        { val: Number(m.haber || 0), isNumber: true }
      ];

      const row = `<tr>${cells.map(c => {
        if (c.isText) return `<td class="text">${escapeHtml(String(c.val))}</td>`;
        if (c.isNumber) return `<td class="number">${Number(c.val || 0).toFixed(2)}</td>`;
        return `<td>${escapeHtml(String(c.val))}</td>`;
      }).join('')}</tr>`;
      
      rowsHtml.push(row);
    });
  });

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
        <tr><td class="title" colspan="8">Libro Diario General</td></tr>
        <tr><td class="subtitle" colspan="8">Período: ${escapeHtml(filterDate || 'Histórico Completo')}</td></tr>
        <tr><td class="subtitle" colspan="8">Descargado el: ${escapeHtml(new Date().toLocaleDateString('es-EC'))} ${escapeHtml(new Date().toLocaleTimeString('es-EC'))}</td></tr>
        <tr><td style="border:none;"></td></tr>
        <tr>
          ${headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}
        </tr>
        ${rowsHtml.join('\n')}
      </table>
    </body>
    </html>
  `;

  const blob = new Blob([excelHtml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `Libro_Diario_${filterDate || 'Historico'}.xls`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export const handleExportTxPDF = async (empresaId: string, tx: Transaction) => {
  const columns = ['Código', 'Cuenta Contable', 'Debe', 'Haber'];
  const rows = tx.movimientos.map(m => [
    m.plan_cuentas?.codigo_cuenta || '',
    m.plan_cuentas?.nombre || '',
    m.debe > 0 ? `$${m.debe.toFixed(2)}` : '-',
    m.haber > 0 ? `$${m.haber.toFixed(2)}` : '-'
  ]);

  const totalDebe = tx.movimientos.reduce((acc, m) => acc + m.debe, 0);
  const totalHaber = tx.movimientos.reduce((acc, m) => acc + m.haber, 0);

  const foot = [[
    '', 'TOTAL ASIENTO',
    `$${totalDebe.toFixed(2)}`,
    `$${totalHaber.toFixed(2)}`
  ]];

  const fechaFormat = new Date(tx.fecha).toLocaleDateString('es-EC');
  const subtitle = `Asiento del ${fechaFormat}\nConcepto: ${tx.concepto}\n${getDocDetails(tx)} | Tercero: ${tx.entidades?.razon_social || 'N/A'}`;

  await generatePDFReport(empresaId, 'Detalle de Asiento Contable', subtitle, columns, rows, foot);
};

export const exportLibroDiarioPDF = async (empresaId: string, filterDate: string, filteredTransactions: Transaction[]) => {
  let subtitle = 'Movimientos Contables Registrados';
  if (filterDate) {
    subtitle += ` | Período: ${filterDate}`;
  } else {
    subtitle += ' | Histórico Completo';
  }
  await generateLibroDiarioPDF(empresaId, 'Libro Diario General', subtitle, filteredTransactions);
};
