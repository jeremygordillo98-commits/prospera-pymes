import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, FileSpreadsheet, TrendingUp, Landmark, Loader2, BookCopy, CheckCircle2, XCircle, Download, Calendar } from 'lucide-react';
import { supabase } from '../services/supabase';
import { MayorGeneral } from '../components/MayorGeneral';
import { generatePDFReport } from '../utils/pdfGenerator';

interface Props { empresaId: string; }
interface Account { id: string; codigo_cuenta: string; nombre: string; tipo: string; }
interface Movement { id_cuenta: string; debe: number; haber: number; fecha?: string; }

const tabStyle = (active: boolean): React.CSSProperties => ({
  padding: '10px 14px', borderRadius: 12, border: active ? '1px solid rgba(0,214,143,0.2)' : '1px solid transparent',
  background: active ? 'var(--primary-light)' : 'transparent', color: active ? 'var(--primary)' : 'var(--text-sec)', fontWeight: 700, cursor: 'pointer'
});

export const Reportes: React.FC<Props> = ({ empresaId }) => {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'balance' | 'resultado' | 'general' | 'mayor'>('balance');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [soloConMov, setSoloConMov] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [accRes, movRes] = await Promise.all([
        supabase.from('plan_cuentas').select('id,codigo_cuenta,nombre,tipo').eq('id_empresa', empresaId).order('codigo_cuenta'),
        supabase.from('movimientos').select('id_cuenta,debe,haber,transacciones(fecha)').eq('id_empresa', empresaId)
      ]);
      if (!accRes.error) setAccounts(accRes.data || []);
      if (!movRes.error) setMovements((movRes.data || []).map((m: any) => ({
        ...m,
        debe: Number(m.debe || 0),
        haber: Number(m.haber || 0),
        fecha: Array.isArray(m.transacciones) ? m.transacciones[0]?.fecha : m.transacciones?.fecha
      })));
      setLoading(false);
    };
    load();
  }, [empresaId]);

  // Movimientos filtrados por fecha (para balance de comprobacion)
  const movsFiltrados = useMemo(() => movements.filter(m => {
    if (desde && (m.fecha || '') < desde) return false;
    if (hasta && (m.fecha || '') > hasta) return false;
    return true;
  }), [movements, desde, hasta]);

  const buildLedger = (movs: Movement[]) => {
    const grouped = new Map<string, { debe: number; haber: number }>();
    movs.forEach((mov) => {
      const current = grouped.get(mov.id_cuenta) || { debe: 0, haber: 0 };
      current.debe += Number(mov.debe || 0);
      current.haber += Number(mov.haber || 0);
      grouped.set(mov.id_cuenta, current);
    });
    return accounts.map((account) => {
      const totals = grouped.get(account.id) || { debe: 0, haber: 0 };
      const saldo = ['Activo', 'Gasto'].includes(account.tipo) ? totals.debe - totals.haber : totals.haber - totals.debe;
      return { ...account, ...totals, saldo, hasMov: grouped.has(account.id) };
    });
  };

  const ledger = useMemo(() => buildLedger(movsFiltrados), [movsFiltrados, accounts]);

  const totals = useMemo(() => {
    const ingresos = ledger.filter((item) => item.tipo === 'Ingreso').reduce((acc, item) => acc + item.saldo, 0);
    const gastos = ledger.filter((item) => item.tipo === 'Gasto').reduce((acc, item) => acc + item.saldo, 0);
    const activos = ledger.filter((item) => item.tipo === 'Activo').reduce((acc, item) => acc + item.saldo, 0);
    const pasivos = ledger.filter((item) => item.tipo === 'Pasivo').reduce((acc, item) => acc + item.saldo, 0);
    const patrimonio = ledger.filter((item) => item.tipo === 'Patrimonio').reduce((acc, item) => acc + item.saldo, 0);
    return { ingresos, gastos, utilidad: ingresos - gastos, activos, pasivos, patrimonio };
  }, [ledger]);

  const filteredLedger = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return ledger.filter(item => {
      if (soloConMov && !item.hasMov) return false;
      if (term && !item.nombre.toLowerCase().includes(term) && !item.codigo_cuenta.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [ledger, searchTerm, soloConMov]);

  const totalDebe = filteredLedger.reduce((s, i) => s + i.debe, 0);
  const totalHaber = filteredLedger.reduce((s, i) => s + i.haber, 0);
  const cuadrado = Math.abs(totalDebe - totalHaber) < 0.01 && totalDebe > 0;

  const exportBalanceCSV = () => {
    const rows = [['Código', 'Cuenta', 'Tipo', 'Debe', 'Haber', 'Saldo']];
    filteredLedger.forEach(i => rows.push([i.codigo_cuenta, `"${i.nombre}"`, i.tipo, i.debe.toFixed(2), i.haber.toFixed(2), i.saldo.toFixed(2)]));
    rows.push(['', 'TOTALES', '', totalDebe.toFixed(2), totalHaber.toFixed(2), '']);
    const csv = 'data:text/csv;charset=utf-8,\uFEFF' + rows.map(r => r.join(',')).join('\n');
    const a = document.createElement('a'); a.href = encodeURI(csv);
    a.download = `Balance_Comprobacion${desde ? '_' + desde : ''}${hasta ? '_al_' + hasta : ''}.csv`;
    a.click();
  };

  const exportBalancePDF = async () => {
    const columns = ['Código', 'Cuenta', 'Tipo', 'Debe', 'Haber', 'Saldo'];
    const rows = filteredLedger.map(i => [
      i.codigo_cuenta,
      i.nombre,
      i.tipo,
      `$${i.debe.toFixed(2)}`,
      `$${i.haber.toFixed(2)}`,
      `$${i.saldo.toFixed(2)}`
    ]);
    const foot = [['', 'TOTALES', '', `$${totalDebe.toFixed(2)}`, `$${totalHaber.toFixed(2)}`, '']];

    let subtitle = 'Balance de Comprobación';
    if (desde || hasta) subtitle += ` (${desde || 'Inicio'} al ${hasta || 'Hoy'})`;

    await generatePDFReport(empresaId, 'Balance de Comprobación', subtitle, columns, rows, foot);
  };

  if (loading) return <div className="flex-center" style={{ padding: '120px 0' }}><Loader2 className="animate-spin" size={36} style={{ color: 'var(--primary)' }} /></div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <header className="flex-between" style={{ gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--primary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.5, fontSize: '0.8rem', marginBottom: 8 }}>
            <BarChart3 size={14} /> Reportes Financieros
          </div>
          <h1 className="h1" style={{ fontSize: '2.2rem' }}>Centro Analítico</h1>
          <p className="text-sec">Balance de comprobación, estado de resultados, balance general y mayor.</p>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Buscar cuenta o código..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-main)', outline: 'none', width: '220px', marginRight: '8px' }}
          />
          <button style={tabStyle(activeTab === 'balance')} onClick={() => setActiveTab('balance')}>Balance de comprobación</button>
          <button style={tabStyle(activeTab === 'resultado')} onClick={() => setActiveTab('resultado')}>Estado de resultados</button>
          <button style={tabStyle(activeTab === 'general')} onClick={() => setActiveTab('general')}>Balance general</button>
          <button style={tabStyle(activeTab === 'mayor')} onClick={() => setActiveTab('mayor')}>Mayor general</button>
        </div>
      </header>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 16 }}>
        {[
          { label: 'Ingresos', value: totals.ingresos, icon: TrendingUp },
          { label: 'Gastos', value: totals.gastos, icon: FileSpreadsheet },
          { label: 'Utilidad', value: totals.utilidad, icon: Landmark },
          { label: 'Activos', value: totals.activos, icon: BookCopy },
        ].map((item) => (
          <div className="glass-card" key={item.label}>
            <div className="flex-between">
              <div>
                <div className="text-sec" style={{ textTransform: 'uppercase', fontWeight: 800, letterSpacing: 1 }}>{item.label}</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 900, marginTop: 6 }}>${item.value.toFixed(2)}</div>
              </div>
              <div style={{ width: 48, height: 48, borderRadius: 16, background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><item.icon size={24} /></div>
            </div>
          </div>
        ))}
      </section>

      {activeTab === 'balance' && (
        <section className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Toolbar */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <h3 style={{ margin: 0, flex: 1 }}>Balance de Comprobación</h3>
            {/* Badge cuadre */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 20, fontWeight: 800, fontSize: '0.82rem',
              background: cuadrado ? 'rgba(16,185,129,0.12)' : totalDebe === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(239,68,68,0.1)',
              color: cuadrado ? 'var(--success)' : totalDebe === 0 ? 'var(--text-sec)' : 'var(--error)'
            }}>
              {cuadrado ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
              {cuadrado ? 'Cuadrado ✓' : totalDebe === 0 ? 'Sin datos' : `Diferencia: $${Math.abs(totalDebe - totalHaber).toFixed(2)}`}
            </div>
            {/* Filtros fecha */}
            <Calendar size={14} style={{ color: 'var(--text-sec)' }} />
            <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
              style={{ padding: '7px 10px', borderRadius: 10, border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-main)', fontSize: '0.82rem' }} />
            <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
              style={{ padding: '7px 10px', borderRadius: 10, border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-main)', fontSize: '0.82rem' }} />
            {(desde || hasta) && <button onClick={() => { setDesde(''); setHasta(''); }} style={{ background: 'none', border: 'none', color: 'var(--text-sec)', cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem' }}>✕</button>}
            {/* Solo con mov */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', color: 'var(--text-sec)', cursor: 'pointer', userSelect: 'none' }}>
              <input type="checkbox" checked={soloConMov} onChange={e => setSoloConMov(e.target.checked)} style={{ accentColor: 'var(--primary)' }} />
              Solo con movimiento
            </label>
            <button onClick={exportBalanceCSV} className="btn" style={{ padding: '7px 14px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', fontWeight: 700 }}>
              <Download size={14} /> CSV
            </button>
            <button onClick={exportBalancePDF} className="btn btn-primary" style={{ padding: '7px 14px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', fontWeight: 700 }}>
              <Download size={14} /> PDF
            </button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ minWidth: 760 }}>
              <thead><tr><th>Código</th><th>Cuenta</th><th>Tipo</th><th style={{ textAlign: 'right' }}>Debe</th><th style={{ textAlign: 'right' }}>Haber</th><th style={{ textAlign: 'right' }}>Saldo</th></tr></thead>
              <tbody>
                {filteredLedger.map((item) => (
                  <tr key={item.id}>
                    <td style={{ padding: '10px 12px', fontWeight: 800, color: 'var(--primary)', fontFamily: 'monospace' }}>{item.codigo_cuenta}</td>
                    <td style={{ padding: '10px 12px' }}>{item.nombre}</td>
                    <td style={{ padding: '10px 12px' }}><span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: 20, background: 'var(--primary-light)', color: 'var(--primary)', fontWeight: 700 }}>{item.tipo}</span></td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: item.debe > 0 ? 700 : 400, color: item.debe > 0 ? 'var(--text-main)' : 'var(--text-sec)' }}>${item.debe.toFixed(2)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: item.haber > 0 ? 700 : 400, color: item.haber > 0 ? 'var(--text-main)' : 'var(--text-sec)' }}>${item.haber.toFixed(2)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 900, color: item.saldo !== 0 ? 'var(--primary)' : 'var(--text-sec)' }}>${item.saldo.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: 'var(--primary-light)', fontWeight: 900, borderTop: '2px solid var(--border-color)' }}>
                  <td colSpan={3} style={{ padding: '12px', textAlign: 'right', fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>TOTALES — {filteredLedger.length} cuentas</td>
                  <td style={{ padding: '12px', textAlign: 'right', color: 'var(--primary)' }}>${totalDebe.toFixed(2)}</td>
                  <td style={{ padding: '12px', textAlign: 'right', color: 'var(--primary)' }}>${totalHaber.toFixed(2)}</td>
                  <td style={{ padding: '12px', textAlign: 'right', color: cuadrado ? 'var(--success)' : 'var(--error)' }}>{cuadrado ? '✓ Cuadra' : `Δ $${Math.abs(totalDebe - totalHaber).toFixed(2)}`}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}

      {activeTab === 'resultado' && (() => {
        const ingresos = filteredLedger.filter(i => i.tipo === 'Ingreso');
        const gastos = filteredLedger.filter(i => i.tipo === 'Gasto');
        const totalIng = ingresos.reduce((s, i) => s + i.saldo, 0);
        const totalGas = gastos.reduce((s, i) => s + i.saldo, 0);
        const utilidad = totalIng - totalGas;
        const exportER = () => {
          const rows = [['Tipo', 'Cuenta', 'Saldo']];
          ingresos.forEach(i => rows.push(['Ingreso', `"${i.nombre}"`, i.saldo.toFixed(2)]));
          rows.push(['', 'TOTAL INGRESOS', totalIng.toFixed(2)]);
          gastos.forEach(i => rows.push(['Gasto', `"${i.nombre}"`, i.saldo.toFixed(2)]));
          rows.push(['', 'TOTAL GASTOS', totalGas.toFixed(2)]);
          rows.push(['', 'UTILIDAD NETA', utilidad.toFixed(2)]);
          const csv = 'data:text/csv;charset=utf-8,\uFEFF' + rows.map(r => r.join(',')).join('\n');
          const a = document.createElement('a'); a.href = encodeURI(csv);
          a.download = `Estado_Resultados${desde ? '_' + desde : ''}${hasta ? '_al_' + hasta : ''}.csv`;
          a.click();
        };

        const exportERPDF = async () => {
          const columns = ['Tipo', 'Cuenta', 'Saldo'];
          const rows: any[][] = [];

          ingresos.forEach(i => rows.push(['Ingreso', i.nombre, `$${i.saldo.toFixed(2)}`]));
          rows.push([{ content: 'TOTAL INGRESOS', colSpan: 2, styles: { halign: 'right', fontStyle: 'bold' } }, `$${totalIng.toFixed(2)}`]);

          gastos.forEach(i => rows.push(['Gasto', i.nombre, `$${i.saldo.toFixed(2)}`]));
          rows.push([{ content: 'TOTAL GASTOS', colSpan: 2, styles: { halign: 'right', fontStyle: 'bold' } }, `$${totalGas.toFixed(2)}`]);

          const foot = [['', 'UTILIDAD NETA', `$${utilidad.toFixed(2)}`]];

          let subtitle = 'Estado de Resultados';
          if (desde || hasta) subtitle += ` (${desde || 'Inicio'} al ${hasta || 'Hoy'})`;

          await generatePDFReport(empresaId, 'Estado de Resultados', subtitle, columns, rows, foot);
        };
        return (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Barra de período + exportar */}
            <div className="glass-card" style={{ padding: '14px 20px', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <h3 style={{ margin: 0, flex: 1 }}>Estado de Resultados</h3>
              {(desde || hasta) && (
                <span style={{ fontSize: '0.82rem', color: 'var(--text-sec)', fontWeight: 700 }}>
                  <Calendar size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                  {desde || '…'} → {hasta || '…'}
                </span>
              )}
              {/* Badge utilidad */}
              <div style={{
                padding: '6px 14px', borderRadius: 20, fontWeight: 800, fontSize: '0.82rem',
                background: utilidad >= 0 ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.1)',
                color: utilidad >= 0 ? 'var(--success)' : 'var(--error)', display: 'flex', alignItems: 'center', gap: 6
              }}>
                {utilidad >= 0 ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                {utilidad >= 0 ? `Utilidad: $${utilidad.toFixed(2)}` : `Pérdida: $${Math.abs(utilidad).toFixed(2)}`}
              </div>
              <button onClick={exportER} className="btn" style={{ padding: '7px 14px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', fontWeight: 700 }}>
                <Download size={14} /> CSV
              </button>
              <button onClick={exportERPDF} className="btn btn-primary" style={{ padding: '7px 14px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', fontWeight: 700 }}>
                <Download size={14} /> PDF
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 20 }}>
              {/* INGRESOS */}
              <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', background: 'rgba(16,185,129,0.08)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 800, color: 'var(--success)' }}>INGRESOS</span>
                  <span style={{ fontWeight: 900, color: 'var(--success)', fontSize: '1.1rem' }}>${totalIng.toFixed(2)}</span>
                </div>
                {ingresos.length === 0 ? (
                  <div style={{ padding: '24px 20px', color: 'var(--text-sec)', fontSize: '0.85rem', textAlign: 'center' }}>Sin ingresos en el período</div>
                ) : ingresos.map(item => (
                  <div key={item.id} style={{ padding: '11px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                    <span style={{ color: 'var(--text-sec)' }}>{item.codigo_cuenta} · {item.nombre}</span>
                    <strong>${item.saldo.toFixed(2)}</strong>
                  </div>
                ))}
                <div style={{ padding: '12px 20px', display: 'flex', justifyContent: 'space-between', fontWeight: 900, borderTop: '2px solid rgba(16,185,129,0.3)', background: 'rgba(16,185,129,0.04)' }}>
                  <span>Total Ingresos</span><span style={{ color: 'var(--success)' }}>${totalIng.toFixed(2)}</span>
                </div>
              </div>

              {/* GASTOS */}
              <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', background: 'rgba(239,68,68,0.08)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 800, color: 'var(--error)' }}>GASTOS</span>
                  <span style={{ fontWeight: 900, color: 'var(--error)', fontSize: '1.1rem' }}>${totalGas.toFixed(2)}</span>
                </div>
                {gastos.length === 0 ? (
                  <div style={{ padding: '24px 20px', color: 'var(--text-sec)', fontSize: '0.85rem', textAlign: 'center' }}>Sin gastos en el período</div>
                ) : gastos.map(item => (
                  <div key={item.id} style={{ padding: '11px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                    <span style={{ color: 'var(--text-sec)' }}>{item.codigo_cuenta} · {item.nombre}</span>
                    <strong>${item.saldo.toFixed(2)}</strong>
                  </div>
                ))}
                <div style={{ padding: '12px 20px', display: 'flex', justifyContent: 'space-between', fontWeight: 900, borderTop: '2px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.04)' }}>
                  <span>Total Gastos</span><span style={{ color: 'var(--error)' }}>${totalGas.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* RESULTADO FINAL */}
            <div style={{ padding: '24px 32px', borderRadius: 20, background: utilidad >= 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${utilidad >= 0 ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-sec)', marginBottom: 6 }}>Resultado del Período</div>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-sec)' }}>Ingresos ${totalIng.toFixed(2)} − Gastos ${totalGas.toFixed(2)}</div>
              </div>
              <div style={{ fontSize: '2.2rem', fontWeight: 900, color: utilidad >= 0 ? 'var(--success)' : 'var(--error)' }}>
                {utilidad >= 0 ? '+' : ''}${utilidad.toFixed(2)}
              </div>
            </div>
          </section>
        );
      })()}

      {activeTab === 'general' && (() => {
        const activos = filteredLedger.filter(i => i.tipo === 'Activo');
        const pasivos = filteredLedger.filter(i => i.tipo === 'Pasivo');
        const patrimonio = filteredLedger.filter(i => i.tipo === 'Patrimonio');
        const totalA = activos.reduce((s, i) => s + i.saldo, 0);
        const totalPa = pasivos.reduce((s, i) => s + i.saldo, 0);
        const totalPat = patrimonio.reduce((s, i) => s + i.saldo, 0);
        const totalPP = totalPa + totalPat;
        const ecuacionOk = Math.abs(totalA - totalPP) < 0.01 && totalA > 0;
        const exportBG = () => {
          const rows = [['Grupo', 'Cuenta', 'Saldo']];
          activos.forEach(i => rows.push(['Activo', `"${i.nombre}"`, i.saldo.toFixed(2)]));
          rows.push(['', 'TOTAL ACTIVOS', totalA.toFixed(2)]);
          pasivos.forEach(i => rows.push(['Pasivo', `"${i.nombre}"`, i.saldo.toFixed(2)]));
          rows.push(['', 'TOTAL PASIVOS', totalPa.toFixed(2)]);
          patrimonio.forEach(i => rows.push(['Patrimonio', `"${i.nombre}"`, i.saldo.toFixed(2)]));
          rows.push(['', 'TOTAL PATRIMONIO', totalPat.toFixed(2)]);
          rows.push(['', 'PASIVO + PATRIMONIO', totalPP.toFixed(2)]);
          const csv = 'data:text/csv;charset=utf-8,\uFEFF' + rows.map(r => r.join(',')).join('\n');
          const a = document.createElement('a'); a.href = encodeURI(csv);
          a.download = `Balance_General${desde ? '_' + desde : ''}${hasta ? '_al_' + hasta : ''}.csv`;
          a.click();
        };

        const exportBGPDF = async () => {
          const columns = ['Grupo', 'Cuenta', 'Saldo'];
          const rows: any[][] = [];

          activos.forEach(i => rows.push(['Activo', i.nombre, `$${i.saldo.toFixed(2)}`]));
          rows.push([{ content: 'TOTAL ACTIVOS', colSpan: 2, styles: { halign: 'right', fontStyle: 'bold' } }, `$${totalA.toFixed(2)}`]);

          pasivos.forEach(i => rows.push(['Pasivo', i.nombre, `$${i.saldo.toFixed(2)}`]));
          rows.push([{ content: 'TOTAL PASIVOS', colSpan: 2, styles: { halign: 'right', fontStyle: 'bold' } }, `$${totalPa.toFixed(2)}`]);

          patrimonio.forEach(i => rows.push(['Patrimonio', i.nombre, `$${i.saldo.toFixed(2)}`]));
          rows.push([{ content: 'TOTAL PATRIMONIO', colSpan: 2, styles: { halign: 'right', fontStyle: 'bold' } }, `$${totalPat.toFixed(2)}`]);

          const foot = [['', 'PASIVO + PATRIMONIO', `$${totalPP.toFixed(2)}`]];

          let subtitle = 'Balance General';
          if (desde || hasta) subtitle += ` (${desde || 'Inicio'} al ${hasta || 'Hoy'})`;

          await generatePDFReport(empresaId, 'Balance General', subtitle, columns, rows, foot);
        };
        const renderGroup = (items: typeof activos, color: string, emptyMsg: string) => (
          items.length === 0
            ? <div style={{ padding: '16px 20px', color: 'var(--text-sec)', fontSize: '0.85rem', textAlign: 'center' }}>{emptyMsg}</div>
            : items.map(item => (
              <div key={item.id} style={{ padding: '10px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                <span style={{ color: 'var(--text-sec)' }}>{item.codigo_cuenta} · {item.nombre}</span>
                <strong style={{ color }}>${item.saldo.toFixed(2)}</strong>
              </div>
            ))
        );
        return (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Barra encabezado */}
            <div className="glass-card" style={{ padding: '14px 20px', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <h3 style={{ margin: 0, flex: 1 }}>Balance General</h3>
              {(desde || hasta) && (
                <span style={{ fontSize: '0.82rem', color: 'var(--text-sec)', fontWeight: 700 }}>
                  <Calendar size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                  {desde || '…'} → {hasta || '…'}
                </span>
              )}
              {/* Badge A = P + Pat */}
              <div style={{
                padding: '6px 14px', borderRadius: 20, fontWeight: 800, fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 6,
                background: ecuacionOk ? 'rgba(16,185,129,0.12)' : totalA === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(239,68,68,0.1)',
                color: ecuacionOk ? 'var(--success)' : totalA === 0 ? 'var(--text-sec)' : 'var(--error)'
              }}>
                {ecuacionOk ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                {ecuacionOk ? 'A = P + Pat ✓' : totalA === 0 ? 'Sin datos' : `Diferencia: $${Math.abs(totalA - totalPP).toFixed(2)}`}
              </div>
              <button onClick={exportBG} className="btn" style={{ padding: '7px 14px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', fontWeight: 700 }}>
                <Download size={14} /> CSV
              </button>
              <button onClick={exportBGPDF} className="btn btn-primary" style={{ padding: '7px 14px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', fontWeight: 700 }}>
                <Download size={14} /> PDF
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 20 }}>
              {/* ACTIVOS */}
              <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', background: 'rgba(99,102,241,0.08)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 800, color: 'var(--primary)' }}>ACTIVOS</span>
                  <span style={{ fontWeight: 900, color: 'var(--primary)', fontSize: '1.1rem' }}>${totalA.toFixed(2)}</span>
                </div>
                {renderGroup(activos, 'var(--primary)', 'Sin cuentas de activo')}
                <div style={{ padding: '12px 20px', display: 'flex', justifyContent: 'space-between', fontWeight: 900, borderTop: '2px solid rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.04)' }}>
                  <span>TOTAL ACTIVOS</span><span style={{ color: 'var(--primary)' }}>${totalA.toFixed(2)}</span>
                </div>
              </div>

              {/* PASIVOS + PATRIMONIO */}
              <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', background: 'rgba(245,158,11,0.08)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 800, color: 'var(--warning)' }}>PASIVOS + PATRIMONIO</span>
                  <span style={{ fontWeight: 900, color: 'var(--warning)', fontSize: '1.1rem' }}>${totalPP.toFixed(2)}</span>
                </div>
                {/* Pasivos */}
                {pasivos.length > 0 && <div style={{ padding: '10px 20px 4px', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-sec)' }}>PASIVOS</div>}
                {renderGroup(pasivos, 'var(--warning)', '')}
                {pasivos.length > 0 && <div style={{ padding: '8px 20px', display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 800, background: 'rgba(245,158,11,0.04)', borderTop: '1px dashed var(--border-color)' }}><span>Subtotal Pasivos</span><span>${totalPa.toFixed(2)}</span></div>}
                {/* Patrimonio */}
                {patrimonio.length > 0 && <div style={{ padding: '10px 20px 4px', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-sec)', borderTop: '1px solid var(--border-color)', marginTop: 4 }}>PATRIMONIO</div>}
                {renderGroup(patrimonio, '#8b5cf6', '')}
                {patrimonio.length > 0 && <div style={{ padding: '8px 20px', display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 800, background: 'rgba(139,92,246,0.04)', borderTop: '1px dashed var(--border-color)' }}><span>Subtotal Patrimonio</span><span>${totalPat.toFixed(2)}</span></div>}
                <div style={{ padding: '12px 20px', display: 'flex', justifyContent: 'space-between', fontWeight: 900, borderTop: '2px solid rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.04)' }}>
                  <span>TOTAL P + PAT</span><span style={{ color: 'var(--warning)' }}>${totalPP.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Ecuación contable */}
            <div style={{
              padding: '20px 28px', borderRadius: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16,
              background: ecuacionOk ? 'rgba(16,185,129,0.07)' : 'rgba(239,68,68,0.07)',
              border: `1px solid ${ecuacionOk ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`
            }}>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-sec)', fontWeight: 600 }}>
                Ecuación contable: <strong style={{ color: 'var(--primary)' }}>Activos ${totalA.toFixed(2)}</strong> = <strong style={{ color: 'var(--warning)' }}>Pasivos ${totalPa.toFixed(2)}</strong> + <strong style={{ color: '#8b5cf6' }}>Patrimonio ${totalPat.toFixed(2)}</strong>
              </div>
              <div style={{ fontWeight: 900, fontSize: '1.1rem', color: ecuacionOk ? 'var(--success)' : 'var(--error)' }}>
                {ecuacionOk ? '✓ Ecuación cuadrada' : `Δ $${Math.abs(totalA - totalPP).toFixed(2)}`}
              </div>
            </div>
          </section>
        );
      })()}

      {activeTab === 'mayor' && (
        <MayorGeneral empresaId={empresaId} />
      )}
    </div>
  );
};
