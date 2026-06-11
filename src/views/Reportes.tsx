import React from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  FileSpreadsheet, 
  Landmark, 
  BookCopy, 
  Loader2 
} from 'lucide-react';
import { MayorGeneral } from '../components/MayorGeneral';
import { useReportes } from '../hooks/useReportes';
import { BalanceComprobacionTab } from '../components/BalanceComprobacionTab';
import { EstadoResultadosTab } from '../components/EstadoResultadosTab';
import { BalanceGeneralTab } from '../components/BalanceGeneralTab';
import { AuxiliarCarteraTab } from '../components/AuxiliarCarteraTab';
import { FlujoCajaTab } from '../components/FlujoCajaTab';
import { RetencionesSRITab } from '../components/RetencionesSRITab';

interface Props { empresaId: string; }

const tabStyle = (active: boolean): React.CSSProperties => ({
  padding: '10px 14px',
  borderRadius: 12,
  border: active ? '1px solid rgba(0,214,143,0.2)' : '1px solid transparent',
  background: active ? 'var(--primary-light)' : 'transparent',
  color: active ? 'var(--primary)' : 'var(--text-sec)',
  fontWeight: 700,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  transition: 'all 0.2s ease'
});

export const Reportes: React.FC<Props> = ({ empresaId }) => {
  const {
    loading,
    activeTab,
    setActiveTab,
    searchTerm,
    setSearchTerm,
    desde,
    setDesde,
    hasta,
    setHasta,
    soloConMov,
    setSoloConMov,
    expandedAccounts,
    totals,
    filteredLedger,
    rootAccounts,
    carteraAgrupada,
    carteraDocs,
    flowCategorized,
    retencionesAgrupadas,
    totalDebe,
    totalHaber,
    cuadrado,
    toggleAccount,
    isVisibleByParentCollapse,
    exportBalanceCSV,
    exportBalancePDF
  } = useReportes(empresaId);

  if (loading) {
    return (
      <div className="flex-center" style={{ padding: '120px 0' }}>
        <Loader2 className="animate-spin" size={36} style={{ color: 'var(--primary)' }} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <header className="flex-between" style={{ gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--primary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.5, fontSize: '0.8rem', marginBottom: 8 }}>
            <BarChart3 size={14} /> Centro de Analítica Financiera
          </div>
          <h1 className="h1" style={{ fontSize: '2.2rem' }}>Informes & Balances</h1>
          <p className="text-sec">Analiza la contabilidad de tu PYME estructurada con normas locales en tiempo real.</p>
        </div>
      </header>

      {/* Tabs Multi-Reportes */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--border-color)', paddingBottom: 10, overflowX: 'auto', maxWidth: '100%' }} className="custom-scrollbar">
        <button style={tabStyle(activeTab === 'balance')} onClick={() => setActiveTab('balance')}>Balance de Comprobación</button>
        <button style={tabStyle(activeTab === 'resultado')} onClick={() => setActiveTab('resultado')}>Estado de Resultados</button>
        <button style={tabStyle(activeTab === 'general')} onClick={() => setActiveTab('general')}>Balance General</button>
        <button style={tabStyle(activeTab === 'mayor')} onClick={() => setActiveTab('mayor')}>Mayor General</button>
        <button style={tabStyle(activeTab === 'cartera')} onClick={() => setActiveTab('cartera')}>Auxiliar de Cartera</button>
        <button style={tabStyle(activeTab === 'flujo')} onClick={() => setActiveTab('flujo')}>Flujo de Caja</button>
        <button style={tabStyle(activeTab === 'retenciones')} onClick={() => setActiveTab('retenciones')}>Retenciones SRI</button>
      </div>

      {/* Tarjetas de Resumen */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 16 }}>
        {[
          { label: 'Ingresos Operativos', value: totals.ingresos, icon: TrendingUp },
          { label: 'Egresos Contables', value: totals.gastos, icon: FileSpreadsheet },
          { label: 'Utilidad Bruta', value: totals.utilidad, icon: Landmark, color: totals.utilidad >= 0 ? 'var(--success)' : 'var(--error)' },
          { label: 'Activos Totales', value: totals.activos, icon: BookCopy },
        ].map((item) => (
          <div className="glass-card" key={item.label}>
            <div className="flex-between">
              <div>
                <div className="text-sec" style={{ textTransform: 'uppercase', fontWeight: 800, letterSpacing: 1, fontSize: '0.75rem' }}>{item.label}</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 900, marginTop: 6, color: item.color || 'var(--text-main)' }}>${item.value.toFixed(2)}</div>
              </div>
              <div style={{ width: 48, height: 48, borderRadius: 16, background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><item.icon size={24} /></div>
            </div>
          </div>
        ))}
      </section>

      {/* ── 1. TAB: BALANCE DE COMPROBACIÓN ── */}
      {activeTab === 'balance' && (
        <BalanceComprobacionTab
          filteredLedger={filteredLedger}
          expandedAccounts={expandedAccounts}
          toggleAccount={toggleAccount}
          isVisibleByParentCollapse={isVisibleByParentCollapse}
          cuadrado={cuadrado}
          totalDebe={totalDebe}
          totalHaber={totalHaber}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          desde={desde}
          setDesde={setDesde}
          hasta={hasta}
          setHasta={setHasta}
          soloConMov={soloConMov}
          setSoloConMov={setSoloConMov}
          exportBalanceCSV={exportBalanceCSV}
          exportBalancePDF={exportBalancePDF}
        />
      )}

      {/* ── 2. TAB: ESTADO DE RESULTADOS ── */}
      {activeTab === 'resultado' && (
        <EstadoResultadosTab
          filteredLedger={filteredLedger}
          rootAccounts={rootAccounts}
          expandedAccounts={expandedAccounts}
          toggleAccount={toggleAccount}
          isVisibleByParentCollapse={isVisibleByParentCollapse}
          desde={desde}
          hasta={hasta}
        />
      )}

      {/* ── 3. TAB: BALANCE GENERAL ── */}
      {activeTab === 'general' && (
        <BalanceGeneralTab
          filteredLedger={filteredLedger}
          rootAccounts={rootAccounts}
          expandedAccounts={expandedAccounts}
          toggleAccount={toggleAccount}
          isVisibleByParentCollapse={isVisibleByParentCollapse}
          desde={desde}
          hasta={hasta}
        />
      )}

      {/* ── 4. TAB: MAYOR GENERAL ── */}
      {activeTab === 'mayor' && (
        <MayorGeneral empresaId={empresaId} />
      )}

      {/* ── 5. TAB: AUXILIAR DE CARTERA ── */}
      {activeTab === 'cartera' && (
        <AuxiliarCarteraTab carteraAgrupada={carteraAgrupada} carteraDocs={carteraDocs} />
      )}

      {/* ── 6. TAB: ESTADO DE FLUJO DE EFECTIVO ── */}
      {activeTab === 'flujo' && (
        <FlujoCajaTab
          flowCategorized={flowCategorized}
          desde={desde}
          hasta={hasta}
        />
      )}

      {/* ── 7. TAB: REPORTE DE RETENCIONES SRI ── */}
      {activeTab === 'retenciones' && (
        <RetencionesSRITab retencionesAgrupadas={retencionesAgrupadas} />
      )}
    </div>
  );
};
