import React from 'react';

interface Props {
  retencionesAgrupadas: {
    emitidasRenta: any[];
    emitidasIva: any[];
    recibidasRenta: any[];
    recibidasIva: any[];
  };
}

export const RetencionesSRITab: React.FC<Props> = ({ retencionesAgrupadas }) => {
  const totalEmitidoRenta = retencionesAgrupadas.emitidasRenta?.reduce((s, r) => s + r.valor, 0) || 0;
  const totalEmitidoIva   = retencionesAgrupadas.emitidasIva?.reduce((s, r) => s + r.valor, 0) || 0;
  const totalEmitido      = totalEmitidoRenta + totalEmitidoIva;

  const totalRecibidoRenta = retencionesAgrupadas.recibidasRenta?.reduce((s, r) => s + r.valor, 0) || 0;
  const totalRecibidoIva   = retencionesAgrupadas.recibidasIva?.reduce((s, r) => s + r.valor, 0) || 0;
  const totalRecibido      = totalRecibidoRenta + totalRecibidoIva;

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* KPI Retenciones */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        <div className="glass-card" style={{ borderLeft: '4px solid #8b5cf6', padding: '20px 24px' }}>
          <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', color: 'var(--text-sec)', fontWeight: 800 }}>Retenciones Emitidas (Compras)</div>
          <div style={{ fontSize: '2.2rem', fontWeight: 900, marginTop: 8, color: '#8b5cf6' }}>${totalEmitido.toFixed(2)}</div>
          <div style={{ display: 'flex', gap: 12, marginTop: 10, fontSize: '0.75rem', color: 'var(--text-sec)' }}>
            <span>Renta: <strong style={{ color: 'var(--text-main)' }}>${totalEmitidoRenta.toFixed(2)}</strong></span>
            <span>IVA: <strong style={{ color: 'var(--text-main)' }}>${totalEmitidoIva.toFixed(2)}</strong></span>
          </div>
          <p className="text-sec" style={{ fontSize: '0.75rem', marginTop: 10, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 8 }}>Para declarar en Formulario 103 / 104 (Mensual)</p>
        </div>
        <div className="glass-card" style={{ borderLeft: '4px solid var(--primary)', padding: '20px 24px' }}>
          <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', color: 'var(--text-sec)', fontWeight: 800 }}>Retenciones Recibidas (Ventas)</div>
          <div style={{ fontSize: '2.2rem', fontWeight: 900, marginTop: 8, color: 'var(--primary)' }}>${totalRecibido.toFixed(2)}</div>
          <div style={{ display: 'flex', gap: 12, marginTop: 10, fontSize: '0.75rem', color: 'var(--text-sec)' }}>
            <span>Renta: <strong style={{ color: 'var(--text-main)' }}>${totalRecibidoRenta.toFixed(2)}</strong></span>
            <span>IVA: <strong style={{ color: 'var(--text-main)' }}>${totalRecibidoIva.toFixed(2)}</strong></span>
          </div>
          <p className="text-sec" style={{ fontSize: '0.75rem', marginTop: 10, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 8 }}>Crédito Tributario para deducir impuestos del periodo</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: 24 }}>
        {/* PANEL EMITIDAS */}
        <div className="glass-card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ fontWeight: 800, fontSize: '1.1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: 10, color: '#8b5cf6' }}>
            Retenciones Emitidas (Compras)
          </div>

          {/* Emitidas Renta */}
          <div>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-sec)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              • Impuesto a la Renta (F.103)
            </div>
            <div style={{ overflowX: 'auto', background: 'rgba(255,255,255,0.01)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.03)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.02)', fontSize: '0.7rem' }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 800, color: 'var(--text-sec)' }}>CÓDIGO SRI</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, color: 'var(--text-sec)' }}>BASE IMPONIBLE</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, color: 'var(--text-sec)' }}>TOTAL RETENIDO</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, color: 'var(--text-sec)' }}>DOCS</th>
                  </tr>
                </thead>
                <tbody>
                  {retencionesAgrupadas.emitidasRenta?.map(r => (
                    <tr key={r.codigo} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', fontSize: '0.8rem' }}>
                      <td style={{ padding: '8px 12px' }}><span style={{ fontWeight: 800, color: '#8b5cf6', fontFamily: 'monospace' }}>{r.codigo}</span></td>
                      <td style={{ padding: '8px 12px', textAlign: 'right' }}>${r.base.toFixed(2)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, color: '#8b5cf6' }}>${r.valor.toFixed(2)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-sec)' }}>{r.count}</td>
                    </tr>
                  ))}
                  {(!retencionesAgrupadas.emitidasRenta || retencionesAgrupadas.emitidasRenta.length === 0) && (
                    <tr><td colSpan={4} style={{ textAlign: 'center', padding: 16, color: 'var(--text-sec)', fontSize: '0.8rem' }}>Sin retenciones de renta emitidas</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Emitidas IVA */}
          <div>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-sec)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              • Impuesto al Valor Agregado (F.104)
            </div>
            <div style={{ overflowX: 'auto', background: 'rgba(255,255,255,0.01)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.03)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.02)', fontSize: '0.7rem' }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 800, color: 'var(--text-sec)' }}>PORCENTAJE / CÓD</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, color: 'var(--text-sec)' }}>BASE IMPONIBLE</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, color: 'var(--text-sec)' }}>TOTAL RETENIDO</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, color: 'var(--text-sec)' }}>DOCS</th>
                  </tr>
                </thead>
                <tbody>
                  {retencionesAgrupadas.emitidasIva?.map(r => (
                    <tr key={r.codigo} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', fontSize: '0.8rem' }}>
                      <td style={{ padding: '8px 12px' }}><span style={{ fontWeight: 800, color: 'var(--primary)', fontFamily: 'monospace' }}>{r.codigo}</span></td>
                      <td style={{ padding: '8px 12px', textAlign: 'right' }}>${r.base.toFixed(2)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, color: 'var(--primary)' }}>${r.valor.toFixed(2)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-sec)' }}>{r.count}</td>
                    </tr>
                  ))}
                  {(!retencionesAgrupadas.emitidasIva || retencionesAgrupadas.emitidasIva.length === 0) && (
                    <tr><td colSpan={4} style={{ textAlign: 'center', padding: 16, color: 'var(--text-sec)', fontSize: '0.8rem' }}>Sin retenciones de IVA emitidas</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* PANEL RECIBIDAS */}
        <div className="glass-card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ fontWeight: 800, fontSize: '1.1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: 10, color: 'var(--primary)' }}>
            Retenciones Recibidas (Ventas)
          </div>

          {/* Recibidas Renta */}
          <div>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-sec)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              • Impuesto a la Renta (F.103)
            </div>
            <div style={{ overflowX: 'auto', background: 'rgba(255,255,255,0.01)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.03)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.02)', fontSize: '0.7rem' }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 800, color: 'var(--text-sec)' }}>CÓDIGO SRI</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, color: 'var(--text-sec)' }}>BASE IMPONIBLE</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, color: 'var(--text-sec)' }}>TOTAL RETENIDO</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, color: 'var(--text-sec)' }}>DOCS</th>
                  </tr>
                </thead>
                <tbody>
                  {retencionesAgrupadas.recibidasRenta?.map(r => (
                    <tr key={r.codigo} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', fontSize: '0.8rem' }}>
                      <td style={{ padding: '8px 12px' }}><span style={{ fontWeight: 800, color: '#8b5cf6', fontFamily: 'monospace' }}>{r.codigo}</span></td>
                      <td style={{ padding: '8px 12px', textAlign: 'right' }}>${r.base.toFixed(2)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, color: '#8b5cf6' }}>${r.valor.toFixed(2)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-sec)' }}>{r.count}</td>
                    </tr>
                  ))}
                  {(!retencionesAgrupadas.recibidasRenta || retencionesAgrupadas.recibidasRenta.length === 0) && (
                    <tr><td colSpan={4} style={{ textAlign: 'center', padding: 16, color: 'var(--text-sec)', fontSize: '0.8rem' }}>Sin retenciones de renta recibidas</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recibidas IVA */}
          <div>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-sec)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              • Impuesto al Valor Agregado (F.104)
            </div>
            <div style={{ overflowX: 'auto', background: 'rgba(255,255,255,0.01)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.03)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.02)', fontSize: '0.7rem' }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 800, color: 'var(--text-sec)' }}>PORCENTAJE / CÓD</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, color: 'var(--text-sec)' }}>BASE IMPONIBLE</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, color: 'var(--text-sec)' }}>TOTAL RETENIDO</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, color: 'var(--text-sec)' }}>DOCS</th>
                  </tr>
                </thead>
                <tbody>
                  {retencionesAgrupadas.recibidasIva?.map(r => (
                    <tr key={r.codigo} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', fontSize: '0.8rem' }}>
                      <td style={{ padding: '8px 12px' }}><span style={{ fontWeight: 800, color: 'var(--primary)', fontFamily: 'monospace' }}>{r.codigo}</span></td>
                      <td style={{ padding: '8px 12px', textAlign: 'right' }}>${r.base.toFixed(2)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, color: 'var(--primary)' }}>${r.valor.toFixed(2)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-sec)' }}>{r.count}</td>
                    </tr>
                  ))}
                  {(!retencionesAgrupadas.recibidasIva || retencionesAgrupadas.recibidasIva.length === 0) && (
                    <tr><td colSpan={4} style={{ textAlign: 'center', padding: 16, color: 'var(--text-sec)', fontSize: '0.8rem' }}>Sin retenciones de IVA recibidas</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
