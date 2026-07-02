import React from 'react';
import { Wallet, Landmark, ArrowDownCircle, ArrowUpCircle, Repeat, Building2, Banknote } from 'lucide-react';

const BANCOS_ECUADOR = [
  'Banco Pichincha',
  'Banco Guayaquil',
  'Banco del Pacífico',
  'Banco Internacional',
  'Banco del Austro',
  'Banco Solidario',
  'Banco ProCredit',
  'Banco General Rumiñahui',
  'Banco de Machala',
  'Banco Bolivariano',
  'Banco Capital',
  'Produbanco',
  'Diners Club del Ecuador',
  'Banco D-MIRO',
  'Banco Desarrollo',
  'Mutualista Pichincha',
  'Mutualista Imbabura',
  'Mutualista Azuay',
  'Cooperativa JEP',
  'Cooperativa Oscus',
  'Cooperativa Cooprogreso',
  'Cooperativa Andalucía',
  'Cooperativa 29 de Octubre',
  'Cooperativa Atuntaqui',
  'Cooperativa Mego',
  'Cooperativa Riobamba',
  'Cooperativa San Francisco',
  'Cooperativa Tulcán',
  'Cooperativa Mushuc Runa',
  'Cooperativa Alianza del Valle',
  'Cooperativa Policía Nacional',
  'Cooperativa Cámara de Comercio de Ambato',
  'BanEcuador',
  'Banco del Estado (BDE)',
  'CFN (Corporación Financiera Nacional)',
  'Otro (nombre personalizado)'
];

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-main)', outline: 'none'
};

const cardTitle: React.CSSProperties = { fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: 1.2, color: 'var(--text-sec)', fontWeight: 800 };

interface TesoreriaResumenProps {
  summary: any;
  cuentas: any[];
  movimientos: any[];
  showCuentaForm: boolean;
  setShowCuentaForm: (val: boolean | ((v: boolean) => boolean)) => void;
  cuentaForm: any;
  setCuentaForm: (val: any) => void;
  handleCrearCuenta: (e: React.FormEvent) => void;
  saving: boolean;
}

export const TesoreriaResumen: React.FC<TesoreriaResumenProps> = ({
  summary,
  cuentas,
  movimientos,
  showCuentaForm,
  setShowCuentaForm,
  cuentaForm,
  setCuentaForm,
  handleCrearCuenta,
  saving
}) => {
  const decimals = parseInt(localStorage.getItem('pref_decimals') || '2', 10);
  return (
    <div className="space-y-6" style={{ animation: 'fadeIn 0.5s ease' }}>
      <header>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--primary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.5, fontSize: '0.8rem', marginBottom: 8 }}>
            <Landmark size={14} /> Panorama Financiero
        </div>
        <h2 className="h1" style={{ fontSize: '2.2rem' }}>Centro de Mando de Tesorería</h2>
        <p className="text-sec">Visión general del efectivo, obligaciones y liquidez de la empresa.</p>
      </header>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 16 }}>
        {[
          { label: 'Efectivo Disponible', value: summary.disponible, icon: Wallet },
          { label: 'Cuentas por Cobrar', value: summary.porCobrar, icon: ArrowDownCircle },
          { label: 'Cuentas por Pagar', value: summary.porPagar, icon: ArrowUpCircle },
          { label: 'Liquidez Proyectada', value: summary.proyectado, icon: Repeat },
        ].map((item) => (
          <div key={item.label} className="glass-card" style={{ padding: 20 }}>
            <div className="flex-between">
              <div>
                <div style={cardTitle}>{item.label}</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 900, marginTop: 8, color: item.value < 0 ? 'var(--error)' : 'var(--text-main)' }}>${item.value.toFixed(decimals)}</div>
              </div>
              <div style={{ width: 48, height: 48, borderRadius: 16, background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <item.icon size={24} />
              </div>
            </div>
          </div>
        ))}
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 24 }}>
          {/* Cuentas Bancarias */}
          <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0 }}>Cuentas Bancarias</h3>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-sec)', marginTop: 2 }}>Bancos, cajas y cooperativas</div>
              </div>
              <button
                  style={{ background: showCuentaForm ? 'var(--error)' : 'var(--primary)', border: 'none', color: '#000', fontWeight: 800, cursor: 'pointer', fontSize: '0.78rem', padding: '6px 14px', borderRadius: 8 }}
                  onClick={() => setShowCuentaForm(v => !v)}
              >
                  {showCuentaForm ? '✕ Cancelar' : '+ Nueva Cuenta'}
              </button>
            </div>

            {showCuentaForm && (
              <form onSubmit={handleCrearCuenta} style={{ padding: 20, background: 'var(--primary-light)', borderBottom: '1px solid var(--border-color)' }}>
                <div style={{ marginBottom: 14, fontWeight: 800, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Building2 size={16} color="var(--primary)" /> Nueva Cuenta Financiera
                </div>

                {/* Tipo principal: Banco o Caja */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  {['Banco', 'Caja'].map(t => (
                    <button key={t} type="button"
                      onClick={() => setCuentaForm({...cuentaForm, tipo: t})}
                      style={{ flex: 1, padding: '10px', borderRadius: 10, border: `2px solid ${cuentaForm.tipo === t ? 'var(--primary)' : 'var(--border-color)'}`, background: cuentaForm.tipo === t ? 'var(--primary)' : 'transparent', color: cuentaForm.tipo === t ? '#000' : 'var(--text-sec)', fontWeight: 800, cursor: 'pointer', fontSize: '0.85rem' }}
                    >
                      {t === 'Banco' ? '🏦 Banco / Cooperativa' : '💵 Caja / Efectivo'}
                    </button>
                  ))}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {cuentaForm.tipo === 'Banco' ? (
                    <>
                      {/* Seleccionar banco de Ecuador */}
                      <div>
                        <label style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-sec)', display: 'block', marginBottom: 4 }}>Institución Financiera</label>
                        <select
                          value={cuentaForm.banco_seleccionado}
                          onChange={e => setCuentaForm({...cuentaForm, banco_seleccionado: e.target.value, nombre: ''})}
                          style={inputStyle}
                        >
                          {BANCOS_ECUADOR.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                      </div>

                      {/* Nombre personalizado si eligió Otro */}
                      {cuentaForm.banco_seleccionado === 'Otro (nombre personalizado)' && (
                        <input
                          value={cuentaForm.nombre}
                          onChange={e => setCuentaForm({...cuentaForm, nombre: e.target.value})}
                          style={inputStyle}
                          placeholder="Nombre del banco o cooperativa"
                          required
                        />
                      )}

                      {/* Tipo de cuenta */}
                      <div>
                        <label style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-sec)', display: 'block', marginBottom: 4 }}>Tipo de Cuenta</label>
                        <div style={{ display: 'flex', gap: 8 }}>
                          {['Ahorro', 'Corriente'].map(tc => (
                            <button key={tc} type="button"
                              onClick={() => setCuentaForm({...cuentaForm, tipo_cuenta: tc})}
                              style={{ flex: 1, padding: '9px', borderRadius: 8, border: `2px solid ${cuentaForm.tipo_cuenta === tc ? 'var(--primary)' : 'var(--border-color)'}`, background: cuentaForm.tipo_cuenta === tc ? 'var(--primary)' : 'transparent', color: cuentaForm.tipo_cuenta === tc ? '#000' : 'var(--text-sec)', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem' }}
                            >
                              {tc === 'Ahorro' ? '🏷 Ahorro' : '💳 Corriente'}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Número de cuenta */}
                      <div>
                        <label style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-sec)', display: 'block', marginBottom: 4 }}>Número de Cuenta</label>
                        <input
                          value={cuentaForm.numero_referencia}
                          onChange={e => setCuentaForm({...cuentaForm, numero_referencia: e.target.value})}
                          style={inputStyle}
                          placeholder="Ej. 2200123456"
                        />
                      </div>
                    </>
                  ) : (
                    <div>
                      <label style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-sec)', display: 'block', marginBottom: 4 }}>Nombre de la Caja</label>
                      <input
                        value={cuentaForm.nombre}
                        onChange={e => setCuentaForm({...cuentaForm, nombre: e.target.value})}
                        style={inputStyle}
                        placeholder="Ej. Caja Principal, Caja Chica"
                        required
                      />
                    </div>
                  )}

                  {/* Saldo inicial */}
                  <div>
                    <label style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-sec)', display: 'block', marginBottom: 4 }}>Saldo Inicial ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={cuentaForm.saldo_inicial}
                      onChange={e => setCuentaForm({...cuentaForm, saldo_inicial: e.target.value})}
                      style={{...inputStyle, fontWeight: 800}}
                      placeholder="0.00"
                      required
                    />
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 4 }} disabled={saving}>
                    {saving ? 'Guardando...' : '✓ Registrar Cuenta'}
                  </button>
                </div>
              </form>
            )}

            {/* Lista de cuentas registradas */}
            <div style={{ padding: cuentas.length === 0 ? 24 : '12px 0' }}>
              {cuentas.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-sec)', fontSize: '0.85rem' }}>
                  <Building2 size={32} style={{ opacity: 0.3, display: 'block', margin: '0 auto 8px' }} />
                  Sin cuentas registradas.<br />
                  <span style={{ fontSize: '0.75rem' }}>Haz clic en "+ Nueva Cuenta" para agregar tu banco.</span>
                </div>
              ) : cuentas.map((c: any) => {
                const esCaja = c.tipo === 'Caja';
                const tipoBadge = c.tipo?.replace('Banco ', '') || c.tipo;
                const numCta = c.numero_referencia;
                const numMask = numCta && numCta.length > 4 ? '···' + numCta.slice(-4) : numCta;
                return (
                  <div key={c.id} style={{ padding: '14px 20px', borderBottom: '1px dashed var(--border-color)', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: esCaja ? 'rgba(16,185,129,0.12)' : 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {esCaja ? <Banknote size={18} color="var(--success)" /> : <Building2 size={18} color="var(--primary)" />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.nombre}</div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '2px 7px', borderRadius: 6, background: esCaja ? 'rgba(16,185,129,0.12)' : 'var(--primary-light)', color: esCaja ? 'var(--success)' : 'var(--primary)', textTransform: 'uppercase' }}>
                          {tipoBadge}
                        </span>
                        {numMask && <span style={{ fontSize: '0.7rem', color: 'var(--text-sec)', fontFamily: 'monospace' }}>{numMask}</span>}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontWeight: 900, fontSize: '1rem' }}>${Number(c.saldo_inicial).toFixed(decimals)}</div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-sec)' }}>saldo inicial</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Últimos Movimientos Generales */}
          <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="flex-between" style={{ padding: 20, borderBottom: '1px solid var(--border-color)' }}>
              <div>
                <h3 style={{ margin: 0 }}>Flujo de Caja Reciente</h3>
                <p className="text-sec" style={{ margin: '6px 0 0' }}>Últimas entradas y salidas de dinero.</p>
              </div>
              <div style={{ fontWeight: 800, fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--success)', marginRight: 16 }}>Entró: ${summary.cobradoMes.toFixed(decimals)}</span>
                  <span style={{ color: 'var(--warning)' }}>Salió: ${summary.pagadoMes.toFixed(decimals)}</span>
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead><tr><th>Fecha</th><th>Tercero</th><th>Concepto</th><th>Importe</th></tr></thead>
                <tbody>
                  {movimientos.slice(0, 8).map((mov) => (
                    <tr key={mov.id}>
                      <td style={{ padding: '12px 16px', fontSize: '0.85rem' }}>{mov.fecha}</td>
                      <td style={{ padding: '12px 16px', fontWeight: 600 }}>{mov.entidades?.razon_social || 'N/A'}</td>
                      <td style={{ padding: '12px 16px' }}>{mov.concepto}</td>
                      <td style={{ padding: '12px 16px', fontWeight: 800, color: mov.tipo_movimiento === 'Cobro' ? 'var(--success)' : 'var(--text-main)', textAlign: 'right' }}>
                          {mov.tipo_movimiento === 'Cobro' ? '+' : '-'}${Number(mov.monto).toFixed(decimals)}
                      </td>
                    </tr>
                  ))}
                  {movimientos.length === 0 && <tr><td colSpan={4} style={{ padding: 28, textAlign: 'center', color: 'var(--text-sec)' }}>Sin movimientos.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
      </div>
    </div>
  );
};
