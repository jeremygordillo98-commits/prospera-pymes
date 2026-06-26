import { generatePDFReport } from './pdfGenerator';

export const exportEntidadesExcel = (entidades: any[]) => {
  const metadata = [
    ['Directorio de Terceros'],
    [`Descargado el: ${new Date().toLocaleDateString('es-EC')} ${new Date().toLocaleTimeString('es-EC')}`],
    []
  ];
  const rows = [
    ['Nombre / Alias', 'Razón Social', 'Identificación / RUC', 'Tipo ID SRI', 'Tipo Persona', 'Correo', 'Teléfono', 'Dirección']
  ];

  const tipoIdLabel: Record<string, string> = {
    '04': 'RUC', '05': 'Cédula', '06': 'Pasaporte',
    '07': 'Consumidor Final', '08': 'Exterior', '09': 'Placa'
  };

  entidades.forEach(e => {
    rows.push([
      `"${(e.nombre || '').replace(/"/g, '""')}"`,
      `"${(e.razon_social || '').replace(/"/g, '""')}"`,
      `"${e.ruc_cedula || ''}"`,
      `"${tipoIdLabel[e.tipo_identificacion] || e.tipo_identificacion || ''}"`,
      `"${e.persona_tipo || 'Natural'}"`,
      `"${(e.email || '').replace(/"/g, '""')}"`,
      `"${(e.telefono || '').replace(/"/g, '""')}"`,
      `"${(e.direccion || '').replace(/"/g, '""')}"`
    ]);
  });

  const csvString = "sep=,\n" + metadata.map(e => e.join(",")).join("\n") + "\n" + rows.map(e => e.join(",")).join("\n");
  const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `Directorio_de_Terceros_${new Date().toISOString().split('T')[0]}.csv`);
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
