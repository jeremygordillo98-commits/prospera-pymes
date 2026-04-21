import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, FileSpreadsheet, TrendingUp, Landmark, Loader2, BookCopy } from 'lucide-react';
import { supabase } from '../services/supabase';

interface Props { empresaId: string; }
interface Account { id: string; codigo_cuenta: string; nombre: string; tipo: string; }
interface Movement { id_cuenta: string; debe: number; haber: number; }

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

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [accRes, movRes] = await Promise.all([
        supabase.from('plan_cuentas').select('id,codigo_cuenta,nombre,tipo').eq('id_empresa', empresaId).order('codigo_cuenta'),
        supabase.from('movimientos').select('id_cuenta,debe,haber').eq('id_empresa', empresaId)
      ]);
      if (!accRes.error) setAccounts(accRes.data || []);
      if (!movRes.error) setMovements((movRes.data || []).map((m: any) => ({ ...m, debe: Number(m.debe || 0), haber: Number(m.haber || 0) })));
      setLoading(false);
    };
    load();
  }, [empresaId]);

  const ledger = useMemo(() => {
    const grouped = new Map<string, { debe: number; haber: number }>();
    movements.forEach((mov) => {
      const current = grouped.get(mov.id_cuenta) || { debe: 0, haber: 0 };
      current.debe += Number(mov.debe || 0);
      current.haber += Number(mov.haber || 0);
      grouped.set(mov.id_cuenta, current);
    });
    return accounts.map((account) => {
      const totals = grouped.get(account.id) || { debe: 0, haber: 0 };
      const saldo = ['Activo', 'Gasto'].includes(account.tipo) ? totals.debe - totals.haber : totals.haber - totals.debe;
      return { ...account, ...totals, saldo };
    });
  }, [accounts, movements]);

  const totals = useMemo(() => {
    const ingresos = ledger.filter((item) => item.tipo === 'Ingreso').reduce((acc, item) => acc + item.saldo, 0);
    const gastos = ledger.filter((item) => item.tipo === 'Gasto').reduce((acc, item) => acc + item.saldo, 0);
    const activos = ledger.filter((item) => item.tipo === 'Activo').reduce((acc, item) => acc + item.saldo, 0);
    const pasivos = ledger.filter((item) => item.tipo === 'Pasivo').reduce((acc, item) => acc + item.saldo, 0);
    const patrimonio = ledger.filter((item) => item.tipo === 'Patrimonio').reduce((acc, item) => acc + item.saldo, 0);
    return { ingresos, gastos, utilidad: ingresos - gastos, activos, pasivos, patrimonio };
  }, [ledger]);

  const filteredLedger = useMemo(() => {
    if (!searchTerm) return ledger;
    const term = searchTerm.toLowerCase();
    return ledger.filter(item => item.nombre.toLowerCase().includes(term) || item.codigo_cuenta.toLowerCase().includes(term));
  }, [ledger, searchTerm]);

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
          <div style={{ padding: 20, borderBottom: '1px solid var(--border-color)' }}><h3 style={{ margin: 0 }}>Balance de comprobación</h3></div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ minWidth: 760 }}>
              <thead><tr><th>Código</th><th>Cuenta</th><th>Tipo</th><th>Debe</th><th>Haber</th><th>Saldo</th></tr></thead>
              <tbody>
                {filteredLedger.map((item) => (
                  <tr key={item.id}>
                    <td style={{ padding: 12, fontWeight: 800, color: 'var(--primary)' }}>{item.codigo_cuenta}</td>
                    <td style={{ padding: 12 }}>{item.nombre}</td>
                    <td style={{ padding: 12 }}>{item.tipo}</td>
                    <td style={{ padding: 12 }}>${item.debe.toFixed(2)}</td>
                    <td style={{ padding: 12 }}>${item.haber.toFixed(2)}</td>
                    <td style={{ padding: 12, fontWeight: 800 }}>${item.saldo.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: 'var(--primary-light)', fontWeight: 800 }}>
                  <td colSpan={3} style={{ padding: 12, textAlign: 'right' }}>Totales</td>
                  <td style={{ padding: 12 }}>${ledger.reduce((acc, item) => acc + item.debe, 0).toFixed(2)}</td>
                  <td style={{ padding: 12 }}>${ledger.reduce((acc, item) => acc + item.haber, 0).toFixed(2)}</td>
                  <td style={{ padding: 12 }}>—</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}

      {activeTab === 'resultado' && (
        <section className="glass-card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 20 }}>
          <div>
            <h3 style={{ marginTop: 0 }}>Ingresos</h3>
            {filteredLedger.filter((item) => item.tipo === 'Ingreso').map((item) => <div key={item.id} className="flex-between" style={{ padding: '10px 0', borderBottom: '1px solid var(--border-color)' }}><span>{item.nombre}</span><strong>${item.saldo.toFixed(2)}</strong></div>)}
            <div className="flex-between" style={{ paddingTop: 12, fontWeight: 900 }}><span>Total ingresos</span><span>${totals.ingresos.toFixed(2)}</span></div>
          </div>
          <div>
            <h3 style={{ marginTop: 0 }}>Gastos</h3>
            {filteredLedger.filter((item) => item.tipo === 'Gasto').map((item) => <div key={item.id} className="flex-between" style={{ padding: '10px 0', borderBottom: '1px solid var(--border-color)' }}><span>{item.nombre}</span><strong>${item.saldo.toFixed(2)}</strong></div>)}
            <div className="flex-between" style={{ paddingTop: 12, fontWeight: 900 }}><span>Total gastos</span><span>${totals.gastos.toFixed(2)}</span></div>
          </div>
          <div style={{ gridColumn: '1 / -1', padding: 20, borderRadius: 20, background: 'var(--primary-light)', color: 'var(--primary)', fontSize: '1.2rem', fontWeight: 900 }}>
            Utilidad neta del período: ${totals.utilidad.toFixed(2)}
          </div>
        </section>
      )}

      {activeTab === 'general' && (
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 20 }}>
          <div className="glass-card">
            <h3 style={{ marginTop: 0 }}>Activos</h3>
            {filteredLedger.filter((item) => item.tipo === 'Activo').map((item) => <div key={item.id} className="flex-between" style={{ padding: '10px 0', borderBottom: '1px solid var(--border-color)' }}><span>{item.nombre}</span><strong>${item.saldo.toFixed(2)}</strong></div>)}
            <div className="flex-between" style={{ paddingTop: 12, fontWeight: 900 }}><span>Total activos</span><span>${totals.activos.toFixed(2)}</span></div>
          </div>
          <div className="glass-card">
            <h3 style={{ marginTop: 0 }}>Pasivos y patrimonio</h3>
            {filteredLedger.filter((item) => ['Pasivo', 'Patrimonio'].includes(item.tipo)).map((item) => <div key={item.id} className="flex-between" style={{ padding: '10px 0', borderBottom: '1px solid var(--border-color)' }}><span>{item.nombre}</span><strong>${item.saldo.toFixed(2)}</strong></div>)}
            <div className="flex-between" style={{ paddingTop: 12, fontWeight: 900 }}><span>Total pasivos</span><span>${totals.pasivos.toFixed(2)}</span></div>
            <div className="flex-between" style={{ paddingTop: 6, fontWeight: 900 }}><span>Total patrimonio</span><span>${totals.patrimonio.toFixed(2)}</span></div>
            <div className="flex-between" style={{ paddingTop: 6, fontWeight: 900, color: 'var(--primary)' }}><span>Pasivo + patrimonio</span><span>${(totals.pasivos + totals.patrimonio).toFixed(2)}</span></div>
          </div>
        </section>
      )}

      {activeTab === 'mayor' && (
        <section className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: 20, borderBottom: '1px solid var(--border-color)' }}><h3 style={{ margin: 0 }}>Mayor general</h3></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 16, padding: 20 }}>
            {filteredLedger.map((item) => (
              <motion.div key={item.id} className="glass-card" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ padding: 18 }}>
                <div style={{ color: 'var(--primary)', fontWeight: 800 }}>{item.codigo_cuenta}</div>
                <div style={{ fontWeight: 800, marginTop: 4 }}>{item.nombre}</div>
                <div className="text-sec" style={{ marginTop: 4 }}>{item.tipo}</div>
                <div className="flex-between" style={{ marginTop: 14 }}><span>Debe</span><strong>${item.debe.toFixed(2)}</strong></div>
                <div className="flex-between" style={{ marginTop: 8 }}><span>Haber</span><strong>${item.haber.toFixed(2)}</strong></div>
                <div className="flex-between" style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border-color)', color: 'var(--primary)', fontWeight: 900 }}><span>Saldo</span><span>${item.saldo.toFixed(2)}</span></div>
              </motion.div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
