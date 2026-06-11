import React from 'react';

interface Props {
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
}

export const FlujoCajaTab: React.FC<Props> = ({
  flowCategorized,
  desde,
  hasta
}) => {
  const netOperacion = flowCategorized.operacionIn - flowCategorized.operacionOut;
  const netInversion = flowCategorized.inversionIn - flowCategorized.inversionOut;
  const netFinanciamiento = flowCategorized.financiamientoIn - flowCategorized.financiamientoOut;
  const incrementoNeto = netOperacion + netInversion + netFinanciamiento;

  return (
    <section className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: 12 }}>
        <h3 style={{ margin: 0 }}>Estado de Flujo de Efectivo (Método Directo)</h3>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-sec)', fontWeight: 700 }}>
          {desde || 'Inicio'} al {hasta || 'Hoy'}
        </span>
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
