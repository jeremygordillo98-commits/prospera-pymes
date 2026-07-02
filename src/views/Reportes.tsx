import React, { useState } from 'react';
import { 
  Loader2,
  Lock
} from 'lucide-react';
import { MayorGeneral } from '../components/MayorGeneral';
import { useReportes } from '../hooks/useReportes';
import { BalanceComprobacionTab } from '../components/BalanceComprobacionTab';
import { EstadoResultadosTab } from '../components/EstadoResultadosTab';
import { BalanceGeneralTab } from '../components/BalanceGeneralTab';
import { AuxiliarCarteraTab } from '../components/AuxiliarCarteraTab';
import { FlujoCajaTab } from '../components/FlujoCajaTab';
import { RetencionesSRITab } from '../components/RetencionesSRITab';
import { ComprasVentasTab } from '../components/ComprasVentasTab';

interface Props { 
  empresaId: string; 
  permisoReportesPdf: boolean;
}

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

export const Reportes: React.FC<Props> = ({ empresaId, permisoReportesPdf }) => {
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const inputStyle: React.CSSProperties = {
    padding: '10px 14px',
    background: 'var(--input-bg)',
    border: '1px solid var(--border-color)',
    borderRadius: '10px',
    color: 'var(--text-main)',
    outline: 'none',
    fontSize: '0.85rem',
    fontFamily: 'inherit',
    width: '100%',
    boxSizing: 'border-box'
  };
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
    filteredLedger,
    rootAccounts,
    carteraAgrupada,
    carteraDocs,
    flowCategorized,
    retencionesAgrupadas,
    sriDocs,
    totalDebe,
    totalHaber,
    cuadrado,
    toggleAccount,
    isVisibleByParentCollapse,
    exportBalanceCSV,
    exportBalancePDF,
    presetFilter,
    setPresetFilter,
    nivelFilter,
    setNivelFilter,
    vistaFilter,
    setVistaFilter
  } = useReportes(empresaId);

  const handleExportBalanceCSV = () => {
    if (!permisoReportesPdf) {
      setShowUpgradeModal(true);
      return;
    }
    exportBalanceCSV();
  };

  const handleExportBalancePDF = () => {
    if (!permisoReportesPdf) {
      setShowUpgradeModal(true);
      return;
    }
    exportBalancePDF();
  };

  if (loading) {
    return (
      <div className="flex-center" style={{ padding: '120px 0' }}>
        <Loader2 className="animate-spin" size={36} style={{ color: 'var(--primary)' }} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Dynamic Filter Panel (Siigo Contifico style with premium glassmorphism) */}
      <div className="glass-card" style={{ padding: '16px 20px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '150px', flex: '1 1 0' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-sec)', letterSpacing: '0.5px' }}>Filtro</label>
          <select 
            value={presetFilter} 
            onChange={e => setPresetFilter(e.target.value as any)}
            style={inputStyle}
          >
            <option value="curso">Año en curso</option>
            <option value="pasado">Año pasado</option>
            <option value="mes">Mes pasado</option>
            <option value="fecha">Por fecha</option>
          </select>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '130px', flex: '1 1 0' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-sec)', letterSpacing: '0.5px' }}>Desde</label>
          <input 
            type="date" 
            value={desde} 
            onChange={e => setDesde(e.target.value)}
            disabled={presetFilter !== 'fecha'}
            style={{ ...inputStyle, opacity: presetFilter !== 'fecha' ? 0.6 : 1, cursor: presetFilter !== 'fecha' ? 'not-allowed' : 'auto' }}
          />
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '130px', flex: '1 1 0' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-sec)', letterSpacing: '0.5px' }}>Hasta</label>
          <input 
            type="date" 
            value={hasta} 
            onChange={e => setHasta(e.target.value)}
            disabled={presetFilter !== 'fecha'}
            style={{ ...inputStyle, opacity: presetFilter !== 'fecha' ? 0.6 : 1, cursor: presetFilter !== 'fecha' ? 'not-allowed' : 'auto' }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '130px', flex: '1 1 0' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-sec)', letterSpacing: '0.5px' }}>Vista</label>
          <select 
            value={vistaFilter} 
            onChange={e => setVistaFilter(e.target.value as any)}
            style={inputStyle}
          >
            <option value="detallado">Detallado</option>
            <option value="general">General</option>
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '130px', flex: '1 1 0' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-sec)', letterSpacing: '0.5px' }}>Nivel</label>
          <select 
            value={nivelFilter} 
            onChange={e => setNivelFilter(e.target.value as any)}
            style={inputStyle}
          >
            <option value="todos">Todos</option>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
            <option value="5">5</option>
          </select>
        </div>
      </div>

      {/* Tabs Multi-Reportes */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--border-color)', paddingBottom: 10, overflowX: 'auto', maxWidth: '100%' }} className="custom-scrollbar">
        <button style={tabStyle(activeTab === 'mayor')} onClick={() => setActiveTab('mayor')}>Mayor General</button>
        <button style={tabStyle(activeTab === 'balance')} onClick={() => setActiveTab('balance')}>Balance de Comprobación</button>
        <button style={tabStyle(activeTab === 'general')} onClick={() => setActiveTab('general')}>Balance General</button>
        <button style={tabStyle(activeTab === 'resultado')} onClick={() => setActiveTab('resultado')}>Estado de Resultados</button>
        <button style={tabStyle(activeTab === 'cartera')} onClick={() => setActiveTab('cartera')}>Auxiliar de Cartera</button>
        <button style={tabStyle(activeTab === 'flujo')} onClick={() => setActiveTab('flujo')}>Flujo de Caja</button>
        <button style={tabStyle(activeTab === 'retenciones')} onClick={() => setActiveTab('retenciones')}>Retenciones SRI</button>
        <button style={tabStyle(activeTab === 'comprasventas')} onClick={() => setActiveTab('comprasventas')}>Compras y Ventas</button>
      </div>

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
          soloConMov={soloConMov}
          setSoloConMov={setSoloConMov}
          exportBalanceCSV={handleExportBalanceCSV}
          exportBalancePDF={handleExportBalancePDF}
        />
      )}

      {/* ── 2. TAB: ESTADO DE RESULTADOS ── */}
      {activeTab === 'resultado' && (
        <EstadoResultadosTab
          empresaId={empresaId}
          filteredLedger={filteredLedger}
          rootAccounts={rootAccounts}
          expandedAccounts={expandedAccounts}
          toggleAccount={toggleAccount}
          isVisibleByParentCollapse={isVisibleByParentCollapse}
          desde={desde}
          hasta={hasta}
          permisoReportesPdf={permisoReportesPdf}
          onPremiumBlock={() => setShowUpgradeModal(true)}
        />
      )}

      {/* ── 3. TAB: BALANCE GENERAL ── */}
      {activeTab === 'general' && (
        <BalanceGeneralTab
          empresaId={empresaId}
          filteredLedger={filteredLedger}
          rootAccounts={rootAccounts}
          expandedAccounts={expandedAccounts}
          toggleAccount={toggleAccount}
          isVisibleByParentCollapse={isVisibleByParentCollapse}
          desde={desde}
          hasta={hasta}
          permisoReportesPdf={permisoReportesPdf}
          onPremiumBlock={() => setShowUpgradeModal(true)}
        />
      )}

      {/* ── 4. TAB: MAYOR GENERAL ── */}
      {activeTab === 'mayor' && (
        <MayorGeneral 
          empresaId={empresaId} 
          permisoReportesPdf={permisoReportesPdf}
          onPremiumBlock={() => setShowUpgradeModal(true)}
        />
      )}

      {/* ── 5. TAB: AUXILIAR DE CARTERA ── */}
      {activeTab === 'cartera' && (
        <AuxiliarCarteraTab 
          empresaId={empresaId} 
          carteraAgrupada={carteraAgrupada} 
          carteraDocs={carteraDocs} 
          permisoReportesPdf={permisoReportesPdf}
          onPremiumBlock={() => setShowUpgradeModal(true)}
        />
      )}

      {/* ── 6. TAB: ESTADO DE FLUJO DE EFECTIVO ── */}
      {activeTab === 'flujo' && (
        <FlujoCajaTab
          empresaId={empresaId}
          flowCategorized={flowCategorized}
          desde={desde}
          hasta={hasta}
          permisoReportesPdf={permisoReportesPdf}
          onPremiumBlock={() => setShowUpgradeModal(true)}
        />
      )}

      {/* ── 7. TAB: REPORTE DE RETENCIONES SRI ── */}
      {activeTab === 'retenciones' && (
        <RetencionesSRITab 
          empresaId={empresaId} 
          retencionesAgrupadas={retencionesAgrupadas} 
          permisoReportesPdf={permisoReportesPdf}
          onPremiumBlock={() => setShowUpgradeModal(true)}
          desde={desde}
          hasta={hasta}
        />
      )}

      {/* ── 8. TAB: REPORTE DE COMPRAS Y VENTAS ── */}
      {activeTab === 'comprasventas' && (
        <ComprasVentasTab 
          empresaId={empresaId}
          sriDocs={sriDocs}
          desde={desde}
          hasta={hasta}
          loading={loading}
        />
      )}

      {/* MODAL DE UPGRADE PREMIUM */}
      {showUpgradeModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999999,
          padding: 16
        }} onClick={() => setShowUpgradeModal(false)}>
          <div style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: 24,
            width: '100%',
            maxWidth: 440,
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
            overflow: 'hidden',
            padding: '32px 24px',
            textAlign: 'center',
            backdropFilter: 'blur(40px)'
          }} onClick={e => e.stopPropagation()}>
            <div style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: 'rgba(0, 214, 143, 0.15)',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              fontSize: '1.8rem'
            }}>
              <Lock size={32} />
            </div>

            <h3 style={{ margin: '0 0 12px', fontSize: '1.4rem', fontWeight: 900, color: 'var(--text-main)' }}>
              ¡Acceso a Descargas Premium!
            </h3>

            <p style={{ margin: '0 0 24px', fontSize: '0.92rem', color: 'var(--text-sec)', lineHeight: 1.6 }}>
              La exportación de informes financieros en PDF y Excel requiere una suscripción activa. Contacta con tu administrador para habilitar este módulo.
            </p>

            <button
              onClick={() => setShowUpgradeModal(false)}
              className="btn btn-primary"
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: 14,
                fontWeight: 800,
                fontSize: '0.95rem',
                justifyContent: 'center'
              }}
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
