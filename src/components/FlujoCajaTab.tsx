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
  const netOperacion = flowCategorized.operacionIn - flowCategorized.operacionOut;
  const netInversion = flowCategorized.inversionIn - flowCategorized.inversionOut;
  const netFinanciamiento = flowCategorized.financiamientoIn - flowCategorized.financiamientoOut;
  const incrementoNeto = netOperacion + netInversion + netFinanciamiento;

  const exportCSV = () => {
    if (!permisoReportesPdf) {
      onPremiumBlock();
      return;
    }
    const rows = [
      ['Estado de Flujo de Efectivo (Método Directo)'],
      ['Fecha / Período', `${desde || 'Inicio'} al ${hasta || 'Hoy'}`],
      [],
      ['Categoría / Actividad', 'Concepto', 'Monto'],
      ['Actividades de Operación', 'Cobros a Clientes (Ingresos Operativos)', flowCategorized.operacionIn.toFixed(2)],
      ['Actividades de Operación', 'Pagos a Proveedores y Nómina (Gastos Operativos)', `-${flowCategorized.operacionOut.toFixed(2)}`],
      ['Actividades de Operación', 'Flujo Neto de Actividades de Operación', netOperacion.toFixed(2)],
      [],
      ['Actividades de Inversión', 'Venta de Propiedades, Planta y Equipos', flowCategorized.inversionIn.toFixed(2)],
      ['Actividades de Inversión', 'Adquisición de Activos Fijos', `-${flowCategorized.inversionOut.toFixed(2)}`],
      ['Actividades de Inversión', 'Flujo Neto de Actividades de Inversión', netInversion.toFixed(2)],
      [],
      ['Actividades de Financiamiento', 'Préstamos Recibidos y Aportaciones de Capital', flowCategorized.financiamientoIn.toFixed(2)],
      ['Actividades de Financiamiento', 'Amortización de Deudas y Pago de Dividendos', `-${flowCategorized.financiamientoOut.toFixed(2)}`],
      ['Actividades de Financiamiento', 'Flujo Neto de Actividades de Financiamiento', netFinanciamiento.toFixed(2)],
      [],
      ['INCREMENTO/DISMINUCIÓN NETO DE EFECTIVO', '', incrementoNeto.toFixed(2)]
    ];

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + rows.map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = encodeURI(csvContent);
    a.download = `Flujo_Efectivo_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
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
    rows.push(['Cobros a Clientes (Ingresos Operativos)', `$${flowCategorized.operacionIn.toFixed(2)}`]);
    rows.push(['Pagos a Proveedores y Nómina (Gastos Operativos)', `-$${flowCategorized.operacionOut.toFixed(2)}`]);
    rows.push([
      { content: 'Flujo Neto de Actividades de Operación', styles: { fontStyle: 'bold' } },
      `$${netOperacion.toFixed(2)}`
    ]);

    // Inversión
    rows.push([
      { content: 'ACTIVIDADES DE INVERSIÓN', colSpan: 2, styles: { fillColor: [255, 251, 235], fontStyle: 'bold', textColor: [245, 158, 11] } }
    ]);
    rows.push(['Venta de Propiedades, Planta y Equipos', `$${flowCategorized.inversionIn.toFixed(2)}`]);
    rows.push(['Adquisición de Activos Fijos', `-$${flowCategorized.inversionOut.toFixed(2)}`]);
    rows.push([
      { content: 'Flujo Neto de Actividades de Inversión', styles: { fontStyle: 'bold' } },
      `$${netInversion.toFixed(2)}`
    ]);

    // Financiamiento
    rows.push([
      { content: 'ACTIVIDADES DE FINANCIAMIENTO', colSpan: 2, styles: { fillColor: [243, 244, 246], fontStyle: 'bold', textColor: [139, 92, 246] } }
    ]);
    rows.push(['Préstamos Recibidos y Aportaciones de Capital', `$${flowCategorized.financiamientoIn.toFixed(2)}`]);
    rows.push(['Amortización de Deudas y Pago de Dividendos', `-$${flowCategorized.financiamientoOut.toFixed(2)}`]);
    rows.push([
      { content: 'Flujo Neto de Actividades de Financiamiento', styles: { fontStyle: 'bold' } },
      `$${netFinanciamiento.toFixed(2)}`
    ]);

    // Incremento Neto
    rows.push([
      { content: 'INCREMENTO/DISMINUCIÓN NETO DE EFECTIVO', styles: { fontStyle: 'bold', fillColor: [240, 253, 250] } },
      { content: `$${incrementoNeto.toFixed(2)}`, styles: { fontStyle: 'bold', fillColor: [240, 253, 250], textColor: incrementoNeto >= 0 ? [16, 185, 129] : [239, 68, 68] } }
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
            <button onClick={exportCSV} className="btn" style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', fontWeight: 700 }}>
              <Download size={14} /> CSV
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
            <strong>+${flowCategorized.operacionIn.toFixed(2)}</strong>
          </div>
          <div className="flex-between" style={{ fontSize: '0.9rem', color: 'var(--error)' }}>
            <span>Pagos a Proveedores y Nómina (Gastos Operativos)</span>
            <strong>-${flowCategorized.operacionOut.toFixed(2)}</strong>
          </div>
          <div className="flex-between" style={{ borderTop: '1px dashed var(--border-color)', paddingTop: 8, fontWeight: 700, marginTop: 8 }}>
            <span>Flujo Neto de Actividades de Operación</span>
            <span style={{ color: netOperacion >= 0 ? 'var(--success)' : 'var(--error)' }}>${netOperacion.toFixed(2)}</span>
          </div>
        </div>

        {/* INVERSIÓN */}
        <div style={{ border: '1px solid var(--border-color)', borderRadius: 12, padding: 16 }}>
          <h4 style={{ margin: '0 0 10px 0', color: 'var(--primary)' }}>Actividades de Inversión</h4>
          <div className="flex-between" style={{ fontSize: '0.9rem', marginBottom: 6 }}>
            <span>Venta de Propiedades, Planta y Equipos</span>
            <strong>+${flowCategorized.inversionIn.toFixed(2)}</strong>
          </div>
          <div className="flex-between" style={{ fontSize: '0.9rem', color: 'var(--error)' }}>
            <span>Adquisición de Activos Fijos</span>
            <strong>-${flowCategorized.inversionOut.toFixed(2)}</strong>
          </div>
          <div className="flex-between" style={{ borderTop: '1px dashed var(--border-color)', paddingTop: 8, fontWeight: 700, marginTop: 8 }}>
            <span>Flujo Neto de Actividades de Inversión</span>
            <span style={{ color: netInversion >= 0 ? 'var(--success)' : 'var(--error)' }}>${netInversion.toFixed(2)}</span>
          </div>
        </div>

        {/* FINANCIAMIENTO */}
        <div style={{ border: '1px solid var(--border-color)', borderRadius: 12, padding: 16 }}>
          <h4 style={{ margin: '0 0 10px 0', color: 'var(--primary)' }}>Actividades de Financiamiento</h4>
          <div className="flex-between" style={{ fontSize: '0.9rem', marginBottom: 6 }}>
            <span>Préstamos Recibidos y Aportaciones de Capital</span>
            <strong>+${flowCategorized.financiamientoIn.toFixed(2)}</strong>
          </div>
          <div className="flex-between" style={{ fontSize: '0.9rem', color: 'var(--error)' }}>
            <span>Amortización de Deudas y Pago de Dividendos</span>
            <strong>-${flowCategorized.financiamientoOut.toFixed(2)}</strong>
          </div>
          <div className="flex-between" style={{ borderTop: '1px dashed var(--border-color)', paddingTop: 8, fontWeight: 700, marginTop: 8 }}>
            <span>Flujo Neto de Actividades de Financiamiento</span>
            <span style={{ color: netFinanciamiento >= 0 ? 'var(--success)' : 'var(--error)' }}>${netFinanciamiento.toFixed(2)}</span>
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
            ${incrementoNeto.toFixed(2)}
          </span>
        </div>
      </div>
    </section>
  );
};
