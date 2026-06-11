import React, { useState } from 'react';
import { ChevronDown, ChevronRight, FileText } from 'lucide-react';

interface Props {
  carteraAgrupada: any[];
  carteraDocs: any[];
}

export const AuxiliarCarteraTab: React.FC<Props> = ({ carteraAgrupada, carteraDocs }) => {
  const [expandedEntities, setExpandedEntities] = useState<Record<string, boolean>>({});
  
  const toggleEntity = (id: string) => {
    setExpandedEntities(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const clientes = carteraAgrupada.filter(c => c.tipo === 'Cliente');
  const proveedores = carteraAgrupada.filter(c => c.tipo === 'Proveedor');

  const totalPorCobrar = clientes.reduce((s, c) => s + c.saldo, 0);
  const totalPorPagar = proveedores.reduce((s, p) => s + p.saldo, 0);

  const renderEntityRow = (ent: any, isProveedor: boolean) => {
    const isExpanded = !!expandedEntities[ent.id];
    const docs = carteraDocs.filter(d => d.entidades?.id === ent.id && d.saldo_pendiente > 0);
    const badgeColor = isProveedor ? 'var(--warning)' : 'var(--success)';

    return (
      <React.Fragment key={ent.id}>
        <tr 
          onClick={() => toggleEntity(ent.id)} 
          style={{ cursor: 'pointer', transition: 'background 0.2s' }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <td style={{ padding: '12px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ 
                color: badgeColor, 
                display: 'inline-flex', 
                alignItems: 'center',
                justifyContent: 'center',
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: isProveedor ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                transition: 'all 0.2s'
              }}>
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </span>
              <div>
                <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{ent.razonSocial}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-sec)', marginTop: 2 }}>RUC: {ent.ruc}</div>
                {docs.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                    {docs.map(doc => (
                      <span 
                        key={doc.id}
                        style={{ 
                          fontSize: '0.68rem', 
                          background: 'rgba(255, 255, 255, 0.04)', 
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          borderRadius: 4,
                          padding: '1px 5px',
                          color: 'var(--text-main)',
                          fontFamily: 'monospace'
                        }}
                      >
                        #{doc.referencia || 'S/N'}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </td>
          <td style={{ textAlign: 'right', padding: '12px 16px', color: 'var(--text-main)' }}>${ent.total.toFixed(2)}</td>
          <td style={{ textAlign: 'right', fontWeight: 800, color: ent.saldo > 0 ? badgeColor : 'var(--text-sec)', padding: '12px 16px' }}>
            ${ent.saldo.toFixed(2)}
          </td>
        </tr>

        {isExpanded && (
          <tr>
            <td colSpan={3} style={{ padding: '0 20px 16px 36px', background: 'rgba(255,255,255,0.005)' }}>
              <div style={{ 
                borderLeft: `2px solid ${badgeColor}`, 
                paddingLeft: 16, 
                marginTop: 4,
                display: 'flex',
                flexDirection: 'column',
                gap: 8
              }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-sec)', letterSpacing: '0.5px', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <FileText size={12} style={{ color: badgeColor }} /> Detalle de Facturas Pendientes
                </div>
                {docs.length === 0 ? (
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-sec)', padding: '4px 0', fontStyle: 'italic' }}>
                    No hay facturas pendientes para esta entidad.
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', textAlign: 'left' }}>
                          <th style={{ padding: '6px 0', color: 'var(--text-sec)', fontWeight: 700 }}>Fecha Emisión</th>
                          <th style={{ padding: '6px 0', color: 'var(--text-sec)', fontWeight: 700 }}>Nro. Factura</th>
                          <th style={{ padding: '6px 0', color: 'var(--text-sec)', fontWeight: 700, textAlign: 'right' }}>Monto Total</th>
                          <th style={{ padding: '6px 0', color: 'var(--text-sec)', fontWeight: 700, textAlign: 'right' }}>Saldo Pendiente</th>
                        </tr>
                      </thead>
                      <tbody>
                        {docs.map(d => (
                          <tr key={d.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                            <td style={{ padding: '8px 0', color: 'var(--text-sec)' }}>
                              {d.fecha_emision ? new Date(d.fecha_emision + 'T12:00:00').toLocaleDateString('es-EC') : '—'}
                            </td>
                            <td style={{ padding: '8px 0', fontWeight: 600, fontFamily: 'monospace', color: 'var(--text-main)' }}>
                              {d.referencia || 'S/N'}
                            </td>
                            <td style={{ padding: '8px 0', textAlign: 'right', color: 'var(--text-main)' }}>
                              ${d.total.toFixed(2)}
                            </td>
                            <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 700, color: badgeColor }}>
                              ${d.saldo_pendiente.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </td>
          </tr>
        )}
      </React.Fragment>
    );
  };

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* KPI Carteras */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        <div className="glass-card" style={{ borderLeft: '4px solid var(--success)', padding: '20px 24px' }}>
          <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', color: 'var(--text-sec)', fontWeight: 800 }}>Total por Cobrar (Clientes)</div>
          <div style={{ fontSize: '2rem', fontWeight: 900, marginTop: 8, color: 'var(--success)' }}>${totalPorCobrar.toFixed(2)}</div>
          <p className="text-sec" style={{ fontSize: '0.78rem', marginTop: 6 }}>{clientes.length} clientes con saldos vigentes</p>
        </div>
        <div className="glass-card" style={{ borderLeft: '4px solid var(--warning)', padding: '20px 24px' }}>
          <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', color: 'var(--text-sec)', fontWeight: 800 }}>Total por Pagar (Proveedores)</div>
          <div style={{ fontSize: '2rem', fontWeight: 900, marginTop: 8, color: 'var(--warning)' }}>${totalPorPagar.toFixed(2)}</div>
          <p className="text-sec" style={{ fontSize: '0.78rem', marginTop: 6 }}>{proveedores.length} proveedores con facturas pendientes</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20 }}>
        {/* Clientes */}
        <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-color)', fontWeight: 800 }}>Auxiliar de Clientes (Cuentas por Cobrar)</div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                  <th style={{ padding: '12px 16px', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-sec)' }}>Razón Social</th>
                  <th style={{ padding: '12px 16px', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-sec)', textAlign: 'right' }}>Total Facturado</th>
                  <th style={{ padding: '12px 16px', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-sec)', textAlign: 'right' }}>Saldo Pendiente</th>
                </tr>
              </thead>
              <tbody>
                {clientes.map(c => renderEntityRow(c, false))}
                {clientes.length === 0 && (
                  <tr><td colSpan={3} style={{ textAlign: 'center', padding: 24, color: 'var(--text-sec)' }}>Sin saldos de clientes</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Proveedores */}
        <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-color)', fontWeight: 800 }}>Auxiliar de Proveedores (Cuentas por Pagar)</div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                  <th style={{ padding: '12px 16px', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-sec)' }}>Proveedor</th>
                  <th style={{ padding: '12px 16px', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-sec)', textAlign: 'right' }}>Total Facturado</th>
                  <th style={{ padding: '12px 16px', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-sec)', textAlign: 'right' }}>Saldo Pendiente</th>
                </tr>
              </thead>
              <tbody>
                {proveedores.map(p => renderEntityRow(p, true))}
                {proveedores.length === 0 && (
                  <tr><td colSpan={3} style={{ textAlign: 'center', padding: 24, color: 'var(--text-sec)' }}>Sin saldos de proveedores</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
};
