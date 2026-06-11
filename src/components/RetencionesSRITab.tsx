import React from 'react';

interface Props {
  retencionesAgrupadas: {
    emitidas: any[];
    recibidas: any[];
  };
}

export const RetencionesSRITab: React.FC<Props> = ({ retencionesAgrupadas }) => {
  const totalEmitido = retencionesAgrupadas.emitidas.reduce((s, r) => s + r.valor, 0);
  const totalRecibido = retencionesAgrupadas.recibidas.reduce((s, r) => s + r.valor, 0);

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* KPI Retenciones */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        <div className="glass-card" style={{ borderLeft: '4px solid #8b5cf6' }}>
          <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', color: 'var(--text-sec)', fontWeight: 800 }}>Retenciones Emitidas (Compras)</div>
          <div style={{ fontSize: '2rem', fontWeight: 900, marginTop: 8, color: '#8b5cf6' }}>${totalEmitido.toFixed(2)}</div>
          <p className="text-sec" style={{ fontSize: '0.78rem', marginTop: 6 }}>Para declarar en Formulario 103 (Mensual)</p>
        </div>
        <div className="glass-card" style={{ borderLeft: '4px solid var(--primary)' }}>
          <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', color: 'var(--text-sec)', fontWeight: 800 }}>Retenciones Recibidas (Crédito Tributario)</div>
          <div style={{ fontSize: '2rem', fontWeight: 900, marginTop: 8, color: 'var(--primary)' }}>${totalRecibido.toFixed(2)}</div>
          <p className="text-sec" style={{ fontSize: '0.78rem', marginTop: 6 }}>Para deducir en Formulario 104 de IVA</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20 }}>
        {/* Emitidas */}
        <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-color)', fontWeight: 800 }}>Retenciones Emitidas por Código del SRI</div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Código SRI</th>
                  <th style={{ textAlign: 'right' }}>Base Imponible</th>
                  <th style={{ textAlign: 'right' }}>Total Retenido</th>
                  <th style={{ textAlign: 'right' }}>Nº Docs</th>
                </tr>
              </thead>
              <tbody>
                {retencionesAgrupadas.emitidas.map(r => (
                  <tr key={r.codigo}>
                    <td><span style={{ fontWeight: 800, color: 'var(--primary)', fontFamily: 'monospace' }}>{r.codigo}</span></td>
                    <td style={{ textAlign: 'right' }}>${r.base.toFixed(2)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 800, color: '#8b5cf6' }}>${r.valor.toFixed(2)}</td>
                    <td style={{ textAlign: 'right' }}>{r.count}</td>
                  </tr>
                ))}
                {retencionesAgrupadas.emitidas.length === 0 && (
                  <tr><td colSpan={4} style={{ textAlign: 'center', padding: 24, color: 'var(--text-sec)' }}>Sin retenciones emitidas</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recibidas */}
        <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-color)', fontWeight: 800 }}>Retenciones Recibidas por Código del SRI</div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Código SRI</th>
                  <th style={{ textAlign: 'right' }}>Base Imponible</th>
                  <th style={{ textAlign: 'right' }}>Total Retenido</th>
                  <th style={{ textAlign: 'right' }}>Nº Docs</th>
                </tr>
              </thead>
              <tbody>
                {retencionesAgrupadas.recibidas.map(r => (
                  <tr key={r.codigo}>
                    <td><span style={{ fontWeight: 800, color: 'var(--primary)', fontFamily: 'monospace' }}>{r.codigo}</span></td>
                    <td style={{ textAlign: 'right' }}>${r.base.toFixed(2)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--primary)' }}>${r.valor.toFixed(2)}</td>
                    <td style={{ textAlign: 'right' }}>{r.count}</td>
                  </tr>
                ))}
                {retencionesAgrupadas.recibidas.length === 0 && (
                  <tr><td colSpan={4} style={{ textAlign: 'center', padding: 24, color: 'var(--text-sec)' }}>Sin retenciones recibidas</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
};
