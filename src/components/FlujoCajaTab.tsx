import React from 'react';
import { Download } from 'lucide-react';
import { generatePDFReport } from '../utils/pdfGenerator';

interface Props {
  empresaId: string;
  flowCategorized: {
    operacionIn: number;
    operacionOut: number;
    inversionIn: number;
    inversionOut: number;
    financiamientoIn: number;
    financiamientoOut: number;
  };
  desde: string;
  hasta: string;
  permisoReportesPdf: boolean;
  onPremiumBlock: () => void;
}

export const FlujoCajaTab: React.FC<Props> = ({
  empresaId,
  flowCategorized,
  desde,
  hasta,
  permisoReportesPdf,
  onPremiumBlock
}) => {
  const decimals = parseInt(localStorage.getItem('pref_decimals') || '2', 10);
  const netOperacion = flowCategorized.operacionIn - flowCategorized.operacionOut;
  const netInversion = flowCategorized.inversionIn - flowCategorized.inversionOut;
  const netFinanciamiento = flowCategorized.financiamientoIn - flowCategorized.financiamientoOut;
  const incrementoNeto = netOperacion + netInversion + netFinanciamiento;

  const escapeHtml = (str: string | undefined | null) => {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  const exportExcel = () => {
    if (!permisoReportesPdf) {
      onPremiumBlock();
      return;
    }
    
    const headers = ['Categoría / Actividad', 'Concepto', 'Monto'];
    
    const dataRows = [
      // Operación
      `<tr><td style="font-weight:bold; color: #1e3a8a;" colspan="3">Actividades de Operación</td></tr>`,
      `<tr><td>Actividades de Operación</td><td>Cobros a Clientes (Ingresos Operativos)</td><td class="number">${flowCategorized.operacionIn.toFixed(decimals)}</td></tr>`,
      `<tr><td>Actividades de Operación</td><td>Pagos a Proveedores y Nómina (Gastos Operativos)</td><td class="number">-${flowCategorized.operacionOut.toFixed(decimals)}</td></tr>`,
      `<tr><td>Actividades de Operación</td><td style="font-weight:bold;">Flujo Neto de Actividades de Operación</td><td class="number" style="font-weight:bold;">${netOperacion.toFixed(decimals)}</td></tr>`,
      `<tr><td style="border:none;"></td></tr>`,
      
      // Inversión
      `<tr><td style="font-weight:bold; color: #1e3a8a;" colspan="3">Actividades de Inversión</td></tr>`,
      `<tr><td>Actividades de Inversión</td><td>Venta de Propiedades, Planta y Equipos</td><td class="number">${flowCategorized.inversionIn.toFixed(decimals)}</td></tr>`,
      `<tr><td>Actividades de Inversión</td><td>Adquisición de Activos Fijos</td><td class="number">-${flowCategorized.inversionOut.toFixed(decimals)}</td></tr>`,
      `<tr><td>Actividades de Inversión</td><td style="font-weight:bold;">Flujo Neto de Actividades de Inversión</td><td class="number" style="font-weight:bold;">${netInversion.toFixed(decimals)}</td></tr>`,
      `<tr><td style="border:none;"></td></tr>`,
      
      // Financiamiento
      `<tr><td style="font-weight:bold; color: #1e3a8a;" colspan="3">Actividades de Financiamiento</td></tr>`,
      `<tr><td>Actividades de Financiamiento</td><td>Préstamos Recibidos y Aportaciones de Capital</td><td class="number">${flowCategorized.financiamientoIn.toFixed(decimals)}</td></tr>`,
      `<tr><td>Actividades de Financiamiento</td><td>Amortización de Deudas y Pago de Dividendos</td><td class="number">-${flowCategorized.financiamientoOut.toFixed(decimals)}</td></tr>`,
      `<tr><td>Actividades de Financiamiento</td><td style="font-weight:bold;">Flujo Neto de Actividades de Financiamiento</td><td class="number" style="font-weight:bold;">${netFinanciamiento.toFixed(decimals)}</td></tr>`,
      `<tr><td style="border:none;"></td></tr>`,
      
      // Neto
      `<tr><td style="font-weight:bold; color: #16a34a; font-size: 11pt;" colspan="2">INCREMENTO/DISMINUCIÓN NETO DE EFECTIVO</td><td class="number" style="font-weight:bold; color: #16a34a; font-size: 11pt;">${incrementoNeto.toFixed(decimals)}</td></tr>`
    ];

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
          <tr><td class="title" colspan="3">Estado de Flujo de Efectivo (Método Directo)</td></tr>
          <tr><td class="subtitle" colspan="3">Período: ${escapeHtml(desde || 'Inicio')} al ${escapeHtml(hasta || 'Hoy')}</td></tr>
          <tr><td class="subtitle" colspan="3">Descargado el: ${escapeHtml(new Date().toLocaleDateString('es-EC'))} ${escapeHtml(new Date().toLocaleTimeString('es-EC'))}</td></tr>
          <tr><td style="border:none;"></td></tr>
          <tr>
            ${headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}
          </tr>
          ${dataRows.join('\n')}
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([excelHtml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Flujo_Efectivo_${new Date().toISOString().split('T')[0]}.xls`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const exportPDF = async () => {
    if (!permisoReportesPdf) {
      onPremiumBlock();
      return;
    }
    const columns = ['Actividad / Concepto', 'Monto'];
    const rows: any[][] = [];

    // Operación
    rows.push([
      { content: 'ACTIVIDADES DE OPERACIÓN', colSpan: 2, styles: { fillColor: [240, 245, 255], fontStyle: 'bold', textColor: [99, 102, 241] } }
    ]);
    rows.push(['Cobros a Clientes (Ingresos Operativos)', `$${flowCategorized.operacionIn.toFixed(decimals)}`]);
    rows.push(['Pagos a Proveedores y Nómina (Gastos Operativos)', `-$${flowCategorized.operacionOut.toFixed(decimals)}`]);
    rows.push([
      { content: 'Flujo Neto de Actividades de Operación', styles: { fontStyle: 'bold' } },
      `$${netOperacion.toFixed(decimals)}`
    ]);

    // Inversión
    rows.push([
      { content: 'ACTIVIDADES DE INVERSIÓN', colSpan: 2, styles: { fillColor: [255, 251, 235], fontStyle: 'bold', textColor: [245, 158, 11] } }
    ]);
    rows.push(['Venta de Propiedades, Planta y Equipos', `$${flowCategorized.inversionIn.toFixed(decimals)}`]);
    rows.push(['Adquisición de Activos Fijos', `-$${flowCategorized.inversionOut.toFixed(decimals)}`]);
    rows.push([
      { content: 'Flujo Neto de Actividades de Inversión', styles: { fontStyle: 'bold' } },
      `$${netInversion.toFixed(decimals)}`
    ]);

    // Financiamiento
    rows.push([
      { content: 'ACTIVIDADES DE FINANCIAMIENTO', colSpan: 2, styles: { fillColor: [243, 244, 246], fontStyle: 'bold', textColor: [139, 92, 246] } }
    ]);
    rows.push(['Préstamos Recibidos y Aportaciones de Capital', `$${flowCategorized.financiamientoIn.toFixed(decimals)}`]);
    rows.push(['Amortización de Deudas y Pago de Dividendos', `-$${flowCategorized.financiamientoOut.toFixed(decimals)}`]);
    rows.push([
      { content: 'Flujo Neto de Actividades de Financiamiento', styles: { fontStyle: 'bold' } },
      `$${netFinanciamiento.toFixed(decimals)}`
    ]);

    // Incremento Neto
    rows.push([
      { content: 'INCREMENTO/DISMINUCIÓN NETO DE EFECTIVO', styles: { fontStyle: 'bold', fillColor: [240, 253, 250] } },
      { content: `$${incrementoNeto.toFixed(decimals)}`, styles: { fontStyle: 'bold', fillColor: [240, 253, 250], textColor: incrementoNeto >= 0 ? [16, 185, 129] : [239, 68, 68] } }
    ]);

    let subtitle = 'Estado de Flujo de Efectivo (Método Directo)';
    if (desde || hasta) subtitle += ` | ${desde || 'Inicio'} al ${hasta || 'Hoy'}`;

    await generatePDFReport(empresaId, 'Flujo de Efectivo', subtitle, columns, rows, []);
  };

  return (
    <section className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: 12, flexWrap: 'wrap', gap: 12 }}>
        <h3 style={{ margin: 0 }}>Estado de Flujo de Efectivo (Método Directo)</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-sec)', fontWeight: 700 }}>
            {desde || 'Inicio'} al {hasta || 'Hoy'}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={exportExcel} className="btn" style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', fontWeight: 700 }}>
              <Download size={14} /> Excel
            </button>
            <button onClick={exportPDF} className="btn btn-primary" style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', fontWeight: 700 }}>
              <Download size={14} /> PDF
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* OPERATIVO */}
        <div style={{ border: '1px solid var(--border-color)', borderRadius: 12, padding: 16 }}>
          <h4 style={{ margin: '0 0 10px 0', color: 'var(--primary)' }}>Actividades de Operación</h4>
          <div className="flex-between" style={{ fontSize: '0.9rem', marginBottom: 6 }}>
            <span>Cobros a Clientes (Ingresos Operativos)</span>
            <strong>+${flowCategorized.operacionIn.toFixed(decimals)}</strong>
          </div>
          <div className="flex-between" style={{ fontSize: '0.9rem', color: 'var(--error)' }}>
            <span>Pagos a Proveedores y Nómina (Gastos Operativos)</span>
            <strong>-${flowCategorized.operacionOut.toFixed(decimals)}</strong>
          </div>
          <div className="flex-between" style={{ borderTop: '1px dashed var(--border-color)', paddingTop: 8, fontWeight: 700, marginTop: 8 }}>
            <span>Flujo Neto de Actividades de Operación</span>
            <span style={{ color: netOperacion >= 0 ? 'var(--success)' : 'var(--error)' }}>${netOperacion.toFixed(decimals)}</span>
          </div>
        </div>

        {/* INVERSIÓN */}
        <div style={{ border: '1px solid var(--border-color)', borderRadius: 12, padding: 16 }}>
          <h4 style={{ margin: '0 0 10px 0', color: 'var(--primary)' }}>Actividades de Inversión</h4>
          <div className="flex-between" style={{ fontSize: '0.9rem', marginBottom: 6 }}>
            <span>Venta de Propiedades, Planta y Equipos</span>
            <strong>+${flowCategorized.inversionIn.toFixed(decimals)}</strong>
          </div>
          <div className="flex-between" style={{ fontSize: '0.9rem', color: 'var(--error)' }}>
            <span>Adquisición de Activos Fijos</span>
            <strong>-${flowCategorized.inversionOut.toFixed(decimals)}</strong>
          </div>
          <div className="flex-between" style={{ borderTop: '1px dashed var(--border-color)', paddingTop: 8, fontWeight: 700, marginTop: 8 }}>
            <span>Flujo Neto de Actividades de Inversión</span>
            <span style={{ color: netInversion >= 0 ? 'var(--success)' : 'var(--error)' }}>${netInversion.toFixed(decimals)}</span>
          </div>
        </div>

        {/* FINANCIAMIENTO */}
        <div style={{ border: '1px solid var(--border-color)', borderRadius: 12, padding: 16 }}>
          <h4 style={{ margin: '0 0 10px 0', color: 'var(--primary)' }}>Actividades de Financiamiento</h4>
          <div className="flex-between" style={{ fontSize: '0.9rem', marginBottom: 6 }}>
            <span>Préstamos Recibidos y Aportaciones de Capital</span>
            <strong>+${flowCategorized.financiamientoIn.toFixed(decimals)}</strong>
          </div>
          <div className="flex-between" style={{ fontSize: '0.9rem', color: 'var(--error)' }}>
            <span>Amortización de Deudas y Pago de Dividendos</span>
            <strong>-${flowCategorized.financiamientoOut.toFixed(decimals)}</strong>
          </div>
          <div className="flex-between" style={{ borderTop: '1px dashed var(--border-color)', paddingTop: 8, fontWeight: 700, marginTop: 8 }}>
            <span>Flujo Neto de Actividades de Financiamiento</span>
            <span style={{ color: netFinanciamiento >= 0 ? 'var(--success)' : 'var(--error)' }}>${netFinanciamiento.toFixed(decimals)}</span>
          </div>
        </div>

        {/* INCREMENTO NETO DE EFECTIVO */}
        <div style={{
          padding: 20, borderRadius: 16, background: incrementoNeto >= 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
          border: `1px solid ${incrementoNeto >= 0 ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
          display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: '1.2rem', marginTop: 12
        }}>
          <span>INCREMENTO/DISMINUCIÓN NETO DE EFECTIVO</span>
          <span style={{ color: incrementoNeto >= 0 ? 'var(--success)' : 'var(--error)' }}>
            ${incrementoNeto.toFixed(decimals)}
          </span>
        </div>
      </div>
    </section>
  );
};
