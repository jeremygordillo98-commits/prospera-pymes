import { generatePDFReport } from './pdfGenerator';

export const exportPlanCuentasExcel = (cuentas: any[]) => {
  const metadata = [
    ['Plan de Cuentas'],
    [`Descargado el: ${new Date().toLocaleDateString('es-EC')} ${new Date().toLocaleTimeString('es-EC')}`],
    []
  ];
  const rows = [
    ['Código', 'Nombre de Cuenta', 'Tipo', 'Acepta Movimientos']
  ];
  
  cuentas.forEach(c => {
    rows.push([
      `"${c.codigo_cuenta || ''}"`,
      `"${(c.nombre || '').replace(/"/g, '""')}"`,
      `"${(c.tipo || '').replace(/"/g, '""')}"`,
      c.acepta_movimientos ? '"Sí"' : '"No"'
    ]);
  });

  const csvString = "sep=,\n" + metadata.map(e => e.join(",")).join("\n") + "\n" + rows.map(e => e.join(",")).join("\n");
  const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `Plan_de_Cuentas_${new Date().toISOString().split('T')[0]}.csv`);
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
