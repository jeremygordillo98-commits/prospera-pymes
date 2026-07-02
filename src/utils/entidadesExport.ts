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

export const exportEntidadesExcel = (entidades: any[]) => {
  const headers = ['Nombre / Alias', 'Razón Social', 'Identificación / RUC', 'Tipo ID SRI', 'Tipo Persona', 'Correo', 'Teléfono', 'Dirección'];
  
  const tipoIdLabel: Record<string, string> = {
    '04': 'RUC', '05': 'Cédula', '06': 'Pasaporte',
    '07': 'Consumidor Final', '08': 'Exterior', '09': 'Placa'
  };

  const rowsHtml = entidades.map(e => {
    const cells = [
      { val: e.nombre || '', isText: false },
      { val: e.razon_social || '', isText: false },
      { val: e.ruc_cedula || '', isText: true },
      { val: tipoIdLabel[e.tipo_identificacion] || e.tipo_identificacion || '', isText: false },
      { val: e.persona_tipo || 'Natural', isText: false },
      { val: e.email || '', isText: false },
      { val: e.telefono || '', isText: true },
      { val: e.direccion || '', isText: false }
    ];

    return `<tr>${cells.map(c => {
      if (c.isText) return `<td class="text">${escapeHtml(String(c.val))}</td>`;
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
        .title { font-size: 16pt; font-weight: bold; border: none; color: #111827; }
        .subtitle { font-size: 10.5pt; color: #4B5563; border: none; }
      </style>
    </head>
    <body>
      <table>
        <tr><td class="title" colspan="8">Directorio de Terceros</td></tr>
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
  link.setAttribute("download", `Directorio_de_Terceros_${new Date().toISOString().split('T')[0]}.xls`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export const exportEntidadesPDF = async (empresaId: string, entidades: any[]) => {
  const columns = ['Alias', 'Razón Social', 'Identificación', 'Tipo SRI', 'Tipo Persona', 'Correo', 'Teléfono'];
  
  const tipoIdLabel: Record<string, string> = {
    '04': 'RUC', '05': 'Cédula', '06': 'Pasaporte',
    '07': 'Cons. Final', '08': 'Exterior', '09': 'Placa'
  };

  const rows = entidades.map(e => [
    e.nombre || '-',
    e.razon_social || '',
    e.ruc_cedula || '',
    tipoIdLabel[e.tipo_identificacion] || e.tipo_identificacion || '',
    e.persona_tipo || 'Natural',
    e.email || '-',
    e.telefono || '-'
  ]);

  await generatePDFReport(
    empresaId,
    'Directorio de Terceros',
    'Catálogo de clientes, proveedores, empleados y accionistas',
    columns,
    rows
  );
};
