import React from 'react';
import { CheckCircle2 } from 'lucide-react';

interface TesoreriaConciliacionProps {
  cuentas: any[];
  movimientos: any[];
}

export const TesoreriaConciliacion: React.FC<TesoreriaConciliacionProps> = ({
  cuentas,
  movimientos
}) => {
  return (
    <div className="space-y-6" style={{ animation: 'fadeIn 0.5s ease' }}>
      <header>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--primary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.5, fontSize: '0.8rem', marginBottom: 8 }}>
              <CheckCircle2 size={14} /> Auditoría
          </div>
          <h2 className="h1" style={{ fontSize: '2.2rem' }}>Conciliación Bancaria</h2>
          <p className="text-sec">Verifica que los saldos del sistema coincidan con tu estado de cuenta real.</p>
      </header>

      <section style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 24, alignItems: 'start' }}>
          {/* Lista Bancos */}
          <div className="glass-card" style={{ padding: 0 }}>
              <div style={{ padding: 20, borderBottom: '1px solid var(--border-color)', background: 'var(--primary-light)' }}>
                  <h3 style={{ margin: 0, color: 'var(--primary)' }}>Saldos Contables</h3>
                  <div style={{ fontSize: '0.75rem', marginTop: 4, color: 'var(--text-main)' }}>Valores calculados por el sistema</div>
              </div>
              <div>
                 {cuentas.map(c => {
                     const c_movs = movimientos.filter(m => m.cuenta_financiera?.nombre === c.nombre);
                     const ingresos = c_movs.filter(m => m.tipo_movimiento === 'Cobro').reduce((a, b) => a + Number(b.monto), 0);
                     const egresos = c_movs.filter(m => m.tipo_movimiento === 'Pago').reduce((a, b) => a + Number(b.monto), 0);
                     const saldoFinal = Number(c.saldo_inicial) + ingresos - egresos;

                     return (
                     <div key={c.id} style={{ padding: 20, borderBottom: '1px solid var(--border-color)' }}>
                         <div style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: 12 }}>{c.nombre}</div>
                         <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 6 }}>
                             <span className="text-sec">Inicial:</span> <span>${Number(c.saldo_inicial).toFixed(2)}</span>
                         </div>
                         <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 6, color: 'var(--success)' }}>
                             <span>Ingresos:</span> <span>+${ingresos.toFixed(2)}</span>
                         </div>
                         <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 12, color: 'var(--error)' }}>
                             <span>Egresos:</span> <span>-${egresos.toFixed(2)}</span>
                         </div>
                         <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem', fontWeight: 900, paddingTop: 12, borderTop: '1px dashed var(--border-color)' }}>
                             <span>Calculado:</span> <span>${saldoFinal.toFixed(2)}</span>
                         </div>
                     </div>
                     );
                 })}
              </div>
          </div>

          {/* Libro Auxiliar de Bancos */}
          <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: 20, borderBottom: '1px solid var(--border-color)' }}>
                  <h3 style={{ margin: 0 }}>Libro Auxiliar de Bancos</h3>
                  <p className="text-sec" style={{ margin: '6px 0 0' }}>Historial detallado para cotejar (Cartola).</p>
              </div>
              <div style={{ overflowX: 'auto' }}>
                  <table className="data-table">
                      <thead><tr><th>Fecha / Ref</th><th>Cuenta</th><th>Concepto / Proveedor</th><th style={{ textAlign: 'right' }}>Cobros</th><th style={{ textAlign: 'right' }}>Pagos</th></tr></thead>
                      <tbody>
                          {movimientos.map(mov => (
                              <tr key={mov.id}>
                                  <td style={{ padding: '12px 16px' }}>
                                      <div style={{ fontWeight: 800 }}>{mov.fecha}</div>
                                      <div style={{ fontSize: '0.75rem', color: 'var(--text-sec)' }}>{mov.referencia || 'S/N'}</div>
                                  </td>
                                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>{mov.cuenta_financiera?.nombre}</td>
                                  <td style={{ padding: '12px 16px' }}>
                                      <div>{mov.concepto}</div>
                                      <div style={{ fontSize: '0.75rem', color: 'var(--text-sec)' }}>{mov.entidades?.razon_social}</div>
                                  </td>
                                  <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: 'var(--success)' }}>
                                      {mov.tipo_movimiento === 'Cobro' ? `$${Number(mov.monto).toFixed(2)}` : ''}
                                  </td>
                                  <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: 'var(--error)' }}>
                                      {mov.tipo_movimiento === 'Pago' ? `$${Number(mov.monto).toFixed(2)}` : ''}
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
      </section>
    </div>
  );
};
