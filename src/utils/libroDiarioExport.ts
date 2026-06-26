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

export const exportToExcel = (filteredTransactions: Transaction[], filterDate: string) => {
  const metadata = [
    ['Libro Diario General'],
    [`Período: ${filterDate || 'Histórico Completo'}`],
    [`Descargado el: ${new Date().toLocaleDateString('es-EC')} ${new Date().toLocaleTimeString('es-EC')}`],
    []
  ];
  const rows = [
    ['Fecha', 'Concepto', 'Comprobante', 'Entidad', 'Codigo Cuenta', 'Nombre Cuenta', 'Debe', 'Haber']
  ];
  filteredTransactions.forEach(tx => {
    tx.movimientos.forEach(m => {
      rows.push([
        tx.fecha,
        `"${tx.concepto.replace(/"/g, '""')}"`,
        `"${getDocDetails(tx)}"`,
        `"${tx.entidades?.razon_social || ''}"`,
        m.plan_cuentas?.codigo_cuenta || '',
        `"${m.plan_cuentas?.nombre || ''}"`,
        m.debe.toString(),
        m.haber.toString()
      ]);
    });
  });
  const csvString = "sep=,\n" + metadata.map(e => e.join(",")).join("\n") + "\n" + rows.map(e => e.join(",")).join("\n");
  const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `Libro_Diario_${filterDate || 'Historico'}.csv`);
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
