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

export const exportPlanCuentasExcel = (cuentas: any[]) => {
  const headers = ['Código', 'Nombre de Cuenta', 'Tipo', 'Acepta Movimientos'];
  
  const rowsHtml = cuentas.map(c => {
    const cells = [
      { val: c.codigo_cuenta || '', isText: true },
      { val: c.nombre || '', isText: false },
      { val: c.tipo || '', isText: false },
      { val: c.acepta_movimientos ? 'Sí' : 'No', isText: false }
    ];

    return `<tr>${cells.map(cell => {
      if (cell.isText) return `<td class="text">${escapeHtml(String(cell.val))}</td>`;
      return `<td>${escapeHtml(String(cell.val))}</td>`;
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
        .title { font-size: 16pt; font-weight: bold; border: none; color: #111827; }
        .subtitle { font-size: 10.5pt; color: #4B5563; border: none; }
      </style>
    </head>
    <body>
      <table>
        <tr><td class="title" colspan="4">Plan de Cuentas</td></tr>
        <tr><td class="subtitle" colspan="4">Descargado el: ${escapeHtml(new Date().toLocaleDateString('es-EC'))} ${escapeHtml(new Date().toLocaleTimeString('es-EC'))}</td></tr>
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
  link.setAttribute("download", `Plan_de_Cuentas_${new Date().toISOString().split('T')[0]}.xls`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export const exportPlanCuentasPDF = async (empresaId: string, cuentas: any[]) => {
  const columns = ['Código', 'Nombre de Cuenta', 'Tipo', 'Acepta Movimientos'];
  const rows = cuentas.map(c => [
    c.codigo_cuenta || '',
    c.nombre || '',
    c.tipo || '',
    c.acepta_movimientos ? 'Sí' : 'No'
  ]);

  await generatePDFReport(
    empresaId,
    'Plan de Cuentas',
    'Estructura y catálogo de cuentas contables',
    columns,
    rows
  );
};
