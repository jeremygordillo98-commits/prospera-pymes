import { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  LogOut,
  Loader2,
  Building2,
  MoreHorizontal,
  Settings
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from './services/supabase';
import { MENU_STRUCTURE } from './constants/menu';
import type { Session } from '@supabase/supabase-js';

import React, { Suspense } from 'react';

// Lazy loading views
const Entidades = React.lazy(() => import('./views/Entidades').then(m => ({ default: m.Entidades })));
const PlanCuentas = React.lazy(() => import('./views/PlanCuentas').then(m => ({ default: m.PlanCuentas })));
const Configuracion = React.lazy(() => import('./views/Configuracion').then(m => ({ default: m.Configuracion })));
const Login = React.lazy(() => import('./views/Login').then(m => ({ default: m.Login })));
const Asientos = React.lazy(() => import('./views/Asientos').then(m => ({ default: m.Asientos })));
const Reportes = React.lazy(() => import('./views/Reportes').then(m => ({ default: m.Reportes })));
const Perfil = React.lazy(() => import('./views/Perfil').then(m => ({ default: m.Perfil })));
const DashboardView = React.lazy(() => import('./views/Dashboard').then(m => ({ default: m.DashboardView })));
const Sidebar = React.lazy(() => import('./components/Sidebar').then(m => ({ default: m.Sidebar })));
const SRIAutomation = React.lazy(() => import('./views/SRIAutomation').then(m => ({ default: m.SRIAutomation })));
const LibroDiario = React.lazy(() => import('./views/LibroDiario').then(m => ({ default: m.LibroDiario })));
const Tesoreria = React.lazy(() => import('./views/Tesoreria').then(m => ({ default: m.Tesoreria })));
const UpdatePassword = React.lazy(() => import('./views/UpdatePassword').then(m => ({ default: m.UpdatePassword })));
const ATS = React.lazy(() => import('./views/ATS').then(m => ({ default: m.ATS })));
const SoporteChat = React.lazy(() => import('./components/SoporteChat').then(m => ({ default: m.SoporteChat })));
const NotificationBellPymes = React.lazy(() => import('./components/NotificationBellPymes').then(m => ({ default: m.NotificationBellPymes })));
const Terms = React.lazy(() => import('./views/Terms').then(m => ({ default: m.Terms })));
const Comunicados = React.lazy(() => import('./views/Comunicados').then(m => ({ default: m.Comunicados })));

import { ImageUploader } from './components/ImageUploader';

interface Empresa {
  id: string;
  nombre_empresa: string;
  ruc_empresa: string;
}

const App = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  // Leer desde sessionStorage (set en index.html ANTES que Supabase limpie el hash)
  // O verificar si la ruta es literalmente /update-password
  const [isResettingPassword, setIsResettingPassword] = useState(() => {
    return window.location.pathname === '/update-password' || sessionStorage.getItem('pw_recovery_pending') === 'true';
  });
  const [activeView, setActiveView] = useState(() => {
    return localStorage.getItem('pymes_active_view') || 'dashboard';
  });
  const [visitedViews, setVisitedViews] = useState<string[]>(['dashboard']);

  // Registrar la vista activa como visitada
  useEffect(() => {
    if (!visitedViews.includes(activeView)) {
      setVisitedViews((prev) => [...prev, activeView]);
    }
  }, [activeView]);

  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

  // Multitenancy states
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [selectedEmpresa, setSelectedEmpresa] = useState<Empresa | null>(null);

  // Al cambiar de empresa, reiniciamos las vistas visitadas para evitar cruce de datos y liberar recursos
  useEffect(() => {
    if (selectedEmpresa) {
      localStorage.setItem('pymes_selected_empresa_id', selectedEmpresa.id);
      setVisitedViews([activeView]);
    }
  }, [selectedEmpresa?.id]);

  const [loadingEmpresas, setLoadingEmpresas] = useState(true);
  const [showNewEmpresaModal, setShowNewEmpresaModal] = useState(false);
  const [newEmpresaId, setNewEmpresaId] = useState(() => crypto.randomUUID());
  const [newEmpresaName, setNewEmpresaName] = useState('');
  const [newEmpresaRuc, setNewEmpresaRuc] = useState('');
  const [newEmpresaLogo, setNewEmpresaLogo] = useState('');
  const [limiteEmpresas, setLimiteEmpresas] = useState<number>(2);
  const [showLimitModal, setShowLimitModal] = useState(false);

  // ── Editar / Archivar empresa ─────────────────────────────────────
  const [editingEmpresa, setEditingEmpresa] = useState<Empresa | null>(null);
  const [editForm, setEditForm] = useState({ nombre_empresa: '', ruc_empresa: '', logo_url: '' });
  const [showArchiveConfirm, setShowArchiveConfirm] = useState<Empresa | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState<Empresa | null>(null);
  const [resettingEmpresa, setResettingEmpresa] = useState(false);
  // ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoadingAuth(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // Fallback: si onAuthStateChange llega antes que sessionStorage (edge case)
      if (event === 'PASSWORD_RECOVERY') {
        sessionStorage.setItem('pw_recovery_pending', 'true');
        setIsResettingPassword(true);
      }
      setSession(session);
      setLoadingAuth(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session?.user?.id) {
      fetchEmpresas();
      fetchLimite();
    }
  // Solo ejecutar cuando CAMBIA el usuario (login/logout), no en cada refresco de token
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  useEffect(() => {
    localStorage.setItem('pymes_active_view', activeView);
  }, [activeView]);

  const fetchLimite = async () => {
    const { data, error } = await supabase
      .from('perfiles')
      .select('limite_empresas')
      .eq('id_usuario', session?.user.id)
      .single();

    if (!error && data) {
      setLimiteEmpresas(data.limite_empresas || 2);
    }
  };

  const fetchEmpresas = async () => {
    setLoadingEmpresas(true);
    const { data, error } = await supabase
      .from('empresas_gestionadas')
      .select('*')
      .order('nombre_empresa');

    if (!error && data) {
      setEmpresas(data);
      const savedId = localStorage.getItem('pymes_selected_empresa_id');
      const found = data.find(e => e.id === savedId);
      if (found) {
        setSelectedEmpresa(found);
      } else if (data.length > 0 && !selectedEmpresa) {
        setSelectedEmpresa(data[0]);
      }
    }
    setLoadingEmpresas(false);
  };

  const createEmpresa = async () => {
    try {
      if (!newEmpresaName || !session?.user?.id) return;

      if (empresas.length >= limiteEmpresas) {
        setShowNewEmpresaModal(false);
        setShowLimitModal(true);
        return;
      }

      const newId = newEmpresaId;

      const { data, error } = await supabase
        .from('empresas_gestionadas')
        .insert({
          id: newId,
          nombre_empresa: newEmpresaName,
          ruc_empresa: newEmpresaRuc || `TEMP-${Date.now()}`,
          logo_url: newEmpresaLogo || null,
          id_usuario: session.user.id,
          moneda: 'USD'
        })
        .select()
        .single();

      if (!error && data) {
        setEmpresas([...empresas, data]);
        setSelectedEmpresa(data);
        setShowNewEmpresaModal(false);
        setNewEmpresaName('');
        setNewEmpresaRuc('');
        setNewEmpresaLogo('');
        setNewEmpresaId(crypto.randomUUID());
      } else {
        console.error("Supabase Error:", error);
        alert(`Error al crear empresa: ${error?.message || 'Revisa tu conexión o las políticas de la base de datos'}`);
      }
    } catch (err: any) {
      console.error("Client Error:", err);
      alert(`Error inesperado: ${err?.message || 'No se pudo procesar la solicitud'}`);
    }
  };

  // ── Editar empresa ────────────────────────────────────────────────
  const openEditEmpresa = (emp: Empresa) => {
    setEditingEmpresa(emp);
    setEditForm({ nombre_empresa: emp.nombre_empresa, ruc_empresa: emp.ruc_empresa || '', logo_url: (emp as any).logo_url || '' });
  };

  const handleSaveEdit = async () => {
    if (!editingEmpresa || !editForm.nombre_empresa.trim()) return;
    setSavingEdit(true);
    const { data, error } = await supabase
      .from('empresas_gestionadas')
      .update({ nombre_empresa: editForm.nombre_empresa, ruc_empresa: editForm.ruc_empresa, logo_url: editForm.logo_url || null })
      .eq('id', editingEmpresa.id)
      .select().single();
    if (!error && data) {
      setEmpresas(prev => prev.map(e => e.id === data.id ? data : e));
      if (selectedEmpresa?.id === data.id) setSelectedEmpresa(data);
      setEditingEmpresa(null);
    } else { alert('Error al guardar: ' + error?.message); }
    setSavingEdit(false);
  };

  // ── Archivar empresa ──────────────────────────────────────────────
  const handleArchiveEmpresa = async (emp: Empresa) => {
    const { error } = await supabase.from('empresas_gestionadas').delete().eq('id', emp.id);
    if (!error) {
      const remaining = empresas.filter(e => e.id !== emp.id);
      setEmpresas(remaining);
      if (selectedEmpresa?.id === emp.id) setSelectedEmpresa(remaining[0] || null);
      setShowArchiveConfirm(null);
    } else { alert('Error al eliminar: ' + error.message); }
  };

  // ── Resetear empresa ──────────────────────────────────────────────
  const handleResetEmpresa = async (emp: Empresa) => {
    setResettingEmpresa(true);
    try {
      // 1. documentos_sri
      const { error: errSri } = await supabase.from('documentos_sri').delete().eq('id_empresa', emp.id);
      if (errSri) throw errSri;

      // 2. tesoreria_movimientos
      const { error: errTesoMov } = await supabase.from('tesoreria_movimientos').delete().eq('id_empresa', emp.id);
      if (errTesoMov) throw errTesoMov;

      // 3. tesoreria_documentos
      const { error: errTesoDoc } = await supabase.from('tesoreria_documentos').delete().eq('id_empresa', emp.id);
      if (errTesoDoc) throw errTesoDoc;

      // 4. movimientos
      const { error: errMov } = await supabase.from('movimientos').delete().eq('id_empresa', emp.id);
      if (errMov) throw errMov;

      // 5. transacciones
      const { error: errTx } = await supabase.from('transacciones').delete().eq('id_empresa', emp.id);
      if (errTx) throw errTx;

      // 6. entidades
      const { error: errEnt } = await supabase.from('entidades').delete().eq('id_empresa', emp.id);
      if (errEnt) throw errEnt;

      // 7. cuentas_financieras
      const { error: errCuentasFin } = await supabase.from('cuentas_financieras').delete().eq('id_empresa', emp.id);
      if (errCuentasFin) throw errCuentasFin;

      alert('¡Datos de la empresa reseteados con éxito! El plan de cuentas se ha conservado.');
      
      // Forzar una actualización de la vista actual para que refleje el estado vacío
      if (selectedEmpresa?.id === emp.id) {
        setSelectedEmpresa({ ...selectedEmpresa });
      }
      setShowResetConfirm(null);
    } catch (error: any) {
      alert('Error al resetear datos: ' + (error.message || error));
    } finally {
      setResettingEmpresa(false);
    }
  };
  // ─────────────────────────────────────────────────────────────────

  const renderView = (view: string) => {
    if (!selectedEmpresa) return null;

    switch (view) {
      case 'dashboard': return <DashboardView empresaId={selectedEmpresa.id} />;
      case 'xml-compras':
      case 'xml-ventas':
        return <SRIAutomation tipo={view === 'xml-compras' ? 'Compras' : 'Ventas'} empresaId={selectedEmpresa.id} />;
      case 'libro-diario': return <LibroDiario empresaId={selectedEmpresa.id} activeView={activeView} />;
      case 'entidades': return <Entidades empresaId={selectedEmpresa.id} />;
      case 'plan-cuentas': return <PlanCuentas empresaId={selectedEmpresa.id} />;
      case 'asientos': return <Asientos empresaId={selectedEmpresa.id} />;
      case 'tesoreria': return <Tesoreria empresaId={selectedEmpresa.id} mode="resumen" />;
      case 'cobros': return <Tesoreria empresaId={selectedEmpresa.id} mode="cobros" />;
      case 'pagos': return <Tesoreria empresaId={selectedEmpresa.id} mode="pagos" />;
      case 'conciliacion': return <Tesoreria empresaId={selectedEmpresa.id} mode="conciliacion" />;
      case 'reportes': return <Reportes empresaId={selectedEmpresa.id} />;
      case 'reportes-fiscales': return <ATS empresaId={selectedEmpresa.id} />;
      case 'comunicados': return <Comunicados empresaId={selectedEmpresa.id} />;
      case 'config': return <Configuracion />;
      case 'perfil': return <Perfil />;
      default:
        return (
          <div
            className="flex-center flex-col glass-card"
            style={{ textAlign: 'center', padding: '100px 0', marginTop: '40px' }}
          >
            <h2 className="h1">Módulo en Construcción</h2>
            <p className="text-sec">Próxima entrega: {view}</p>
          </div>
        );
    }
  };

  // Si se visita la sección de términos y condiciones públicos, mostrarla directamente sin verificar auth
  if (window.location.pathname === '/terms') {
    return (
      <Suspense fallback={<div className="flex-center" style={{ height: '100vh', background: '#0f172a' }}><Loader2 className="animate-spin text-primary" size={48} /></div>}>
        <Terms />
      </Suspense>
    );
  }

  // Si se detectó un link de recuperación de contraseña, mostrar el formulario de nueva clave
  if (isResettingPassword) {
    return (
      <Suspense fallback={<div className="flex-center" style={{ height: '100vh', background: '#0f172a' }}><Loader2 className="animate-spin text-primary" size={48} /></div>}>
        <UpdatePassword
          onSuccess={() => {
            sessionStorage.removeItem('pw_recovery_pending');
            setIsResettingPassword(false);
            // Limpiar la URL para quitar el /update-password y volver a la raíz
            window.history.replaceState(null, '', '/');
            supabase.auth.signOut();
          }}
        />
      </Suspense>
    );
  }

  // Mientras se resuelve la sesión, no mostrar nada (evita flash de Login)
  if (loadingAuth) {
    return (
      <div className="flex-center" style={{ height: '100vh', background: '#0f172a' }}>
        <Loader2 className="animate-spin text-primary" size={48} />
      </div>
    );
  }

  if (!session) {
    return (
      <Suspense fallback={<div className="flex-center" style={{ height: '100vh', background: '#0f172a' }}><Loader2 className="animate-spin text-primary" size={48} /></div>}>
        <Login />
      </Suspense>
    );
  }

  // Solo mostrar pantalla de carga completa en el primer load (sin datos previos)
  if (loadingEmpresas && empresas.length === 0) {
    return (
      <div className="flex-center" style={{ height: '100vh', background: '#0f172a' }}>
        <Loader2 className="animate-spin text-primary" size={48} />
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className="aurora-bg">
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>
      </div>

      <Suspense fallback={null}>
        <Sidebar
          activeView={activeView}
          setActiveView={setActiveView}
          selectedEmpresa={selectedEmpresa}
          setSelectedEmpresa={setSelectedEmpresa}
          empresas={empresas}
          setShowNewEmpresaModal={setShowNewEmpresaModal}
          session={session}
          openEditEmpresa={openEditEmpresa}
          onArchiveEmpresa={(emp) => setShowArchiveConfirm(emp)}
          onResetEmpresa={(emp) => setShowResetConfirm(emp)}
        />
      </Suspense>

      <main className="main-content">
        {!selectedEmpresa ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', textAlign: 'center' }}>
            <Building2 size={64} className="text-sec" style={{ marginBottom: '24px', opacity: 0.3 }} />
            <h2 className="h1">Crea tu primera empresa</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '24px', width: '100%', maxWidth: '350px' }}>
              <input
                type="text"
                placeholder="Nombre de la empresa *"
                value={newEmpresaName}
                onChange={(e) => setNewEmpresaName(e.target.value)}
                style={{ padding: '12px', borderRadius: '10px', background: 'var(--input-bg)', border: '1px solid var(--border-color)', color: 'var(--text-main)', width: '100%' }}
              />
              <input
                type="text"
                placeholder="RUC o Identificación"
                value={newEmpresaRuc}
                onChange={(e) => setNewEmpresaRuc(e.target.value)}
                style={{ padding: '12px', borderRadius: '10px', background: 'var(--input-bg)', border: '1px solid var(--border-color)', color: 'var(--text-main)', width: '100%' }}
              />
              <ImageUploader
                storagePath={`empresas/empresa_${newEmpresaId}.webp`}
                currentLogoUrl={newEmpresaLogo}
                onUploadSuccess={(url: string) => setNewEmpresaLogo(url)}
                onRemove={() => setNewEmpresaLogo('')}
              />
              <button className="btn btn-primary w-full" onClick={createEmpresa}>Crear Cliente</button>
            </div>
          </div>
        ) : (
          <div>
            {visitedViews.map(view => (
              <Suspense
                key={view}
                fallback={
                  activeView === view ? (
                    <div className="flex-center" style={{ height: '60vh' }}>
                      <Loader2 className="animate-spin" size={32} style={{ color: 'var(--primary)' }} />
                    </div>
                  ) : null
                }
              >
                <div style={{ display: activeView === view ? 'block' : 'none' }}>
                  {renderView(view)}
                </div>
              </Suspense>
            ))}
          </div>
        )}
      </main>

      {/* Chat de Soporte flotante — visible en todas las vistas */}
      <Suspense fallback={null}>
        <SoporteChat />
      </Suspense>

      {/* Campana de Notificaciones Flotante */}
      <Suspense fallback={null}>
        <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999 }}>
          <NotificationBellPymes />
        </div>
      </Suspense>

      <nav className="mobile-nav">
        <button
          onClick={() => {
            setActiveView('dashboard');
            setIsMoreMenuOpen(false);
          }}
          className={`nav-item-mobile ${activeView === 'dashboard' && !isMoreMenuOpen ? 'active' : ''}`}
        >
          <LayoutDashboard size={24} />
          <span>Inicio</span>
        </button>

        <button
          onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
          className={`nav-item-mobile ${isMoreMenuOpen ? 'active' : ''}`}
        >
          <div style={{
            background: isMoreMenuOpen ? 'var(--primary)' : 'var(--primary-light)',
            color: isMoreMenuOpen ? '#fff' : 'var(--primary)',
            padding: '10px',
            borderRadius: '16px',
            display: 'flex'
          }}>
            <MoreHorizontal size={24} />
          </div>
          <span style={{ fontWeight: 800 }}>Más</span>
        </button>

        <button
          onClick={() => {
            setActiveView('config');
            setIsMoreMenuOpen(false);
          }}
          className={`nav-item-mobile ${activeView === 'config' && !isMoreMenuOpen ? 'active' : ''}`}
        >
          <Settings size={24} />
          <span>Config</span>
        </button>
      </nav>

      <AnimatePresence>
        {isMoreMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            className="more-menu-overlay custom-scrollbar"
          >
            {MENU_STRUCTURE.filter(item => item.id !== 'dashboard').map(group => (
              <div key={group.id} className="more-menu-group">
                <div className="more-menu-parent-label">
                  <group.icon size={14} /> {group.label}
                </div>
                {group.children?.map(item => (
                  <button
                    key={item.id}
                    className={`more-menu-item ${activeView === item.id ? 'active' : ''}`}
                    onClick={() => {
                      setActiveView(item.id);
                      setIsMoreMenuOpen(false);
                    }}
                  >
                    <item.icon size={20} />
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            ))}

            <button
              className="more-menu-item"
              style={{ color: 'var(--error)', marginTop: '8px', background: 'rgba(239, 68, 68, 0.05)', borderRadius: '18px' }}
              onClick={() => supabase.auth.signOut()}
            >
              <LogOut size={20} />
              <span style={{ fontWeight: 800 }}>Cerrar Sesión</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showNewEmpresaModal && (
          <div className="modal-overlay" style={{ zIndex: 200 }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass-card"
              style={{ width: '90%', maxWidth: '400px', padding: '32px' }}
            >
              <h3>Nuevo Cliente Contable</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px', marginTop: '24px' }}>
                <input
                  autoFocus
                  type="text"
                  placeholder="Nombre de la empresa *"
                  value={newEmpresaName}
                  onChange={(e) => setNewEmpresaName(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', background: 'var(--input-bg)', border: '1px solid var(--border-color)', color: 'var(--text-main)' }}
                />
                <input
                  type="text"
                  placeholder="RUC o Identificación"
                  value={newEmpresaRuc}
                  onChange={(e) => setNewEmpresaRuc(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', background: 'var(--input-bg)', border: '1px solid var(--border-color)', color: 'var(--text-main)' }}
                />
                <ImageUploader
                  storagePath={`empresas/empresa_${newEmpresaId}.webp`}
                  currentLogoUrl={newEmpresaLogo}
                  onUploadSuccess={(url: string) => setNewEmpresaLogo(url)}
                  onRemove={() => setNewEmpresaLogo('')}
                />
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button className="btn flex-1" onClick={() => setShowNewEmpresaModal(false)}>Cancelar</button>
                <button className="btn btn-primary flex-1" onClick={createEmpresa}>Crear Empresa</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showLimitModal && (
          <div className="modal-overlay" style={{ zIndex: 300 }}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card"
              style={{ width: '90%', maxWidth: '450px', padding: '40px', textAlign: 'center' }}
            >
              <div style={{ width: 64, height: 64, background: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                <Building2 size={32} />
              </div>
              <h3>Límite Alcanzado</h3>
              <p className="text-sec" style={{ marginBottom: '32px' }}>Contacta a soporte para ampliar el límite.</p>
              <button className="btn btn-primary w-full" onClick={() => setShowLimitModal(false)}>Entendido</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* ── Modal Editar Empresa ── */}
      <AnimatePresence>
        {editingEmpresa && (
          <div className="modal-overlay" style={{ zIndex: 300 }}>
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="glass-card" style={{ width: '90%', maxWidth: '420px', padding: '32px' }}>
              <h3 style={{ marginTop: 0, marginBottom: 24 }}>✏️ Editar Empresa</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                <input autoFocus type="text" placeholder="Nombre de la empresa *" value={editForm.nombre_empresa} onChange={e => setEditForm({ ...editForm, nombre_empresa: e.target.value })} style={{ width: '100%', padding: '12px', borderRadius: '10px', background: 'var(--input-bg)', border: '1px solid var(--border-color)', color: 'var(--text-main)' }} />
                <input type="text" placeholder="RUC o Identificación" value={editForm.ruc_empresa} onChange={e => setEditForm({ ...editForm, ruc_empresa: e.target.value })} style={{ width: '100%', padding: '12px', borderRadius: '10px', background: 'var(--input-bg)', border: '1px solid var(--border-color)', color: 'var(--text-main)' }} />
                <ImageUploader
                  storagePath={`empresas/empresa_${editingEmpresa.id}.webp`}
                  currentLogoUrl={editForm.logo_url}
                  onUploadSuccess={(url: string) => setEditForm({ ...editForm, logo_url: url })}
                  onRemove={() => setEditForm({ ...editForm, logo_url: '' })}
                />
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button className="btn flex-1" onClick={() => setEditingEmpresa(null)}>Cancelar</button>
                <button className="btn btn-primary flex-1" onClick={handleSaveEdit} disabled={savingEdit}>{savingEdit ? 'Guardando...' : 'Guardar Cambios'}</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Modal Confirmar Archivo/Eliminar ── */}
      <AnimatePresence>
        {showArchiveConfirm && (
          <div className="modal-overlay" style={{ zIndex: 300 }}>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card" style={{ width: '90%', maxWidth: '420px', padding: '40px', textAlign: 'center' }}>
              <div style={{ width: 64, height: 64, background: 'rgba(239,68,68,0.1)', color: 'var(--error)', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: '2rem' }}>🗑️</div>
              <h3 style={{ color: 'var(--error)', marginTop: 0 }}>Eliminar Empresa</h3>
              <p style={{ color: 'var(--text-sec)', marginBottom: '28px' }}>
                ¿Estás seguro de que deseas eliminar <strong>«{showArchiveConfirm.nombre_empresa}»</strong>?<br />
                <span style={{ fontSize: '0.82rem' }}>Esta acción es irreversible y eliminará todos sus datos contables.</span>
              </p>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button className="btn flex-1" onClick={() => setShowArchiveConfirm(null)}>Cancelar</button>
                <button className="btn flex-1" style={{ background: 'var(--error)', color: '#fff', border: 'none' }} onClick={() => handleArchiveEmpresa(showArchiveConfirm)}>Sí, Eliminar</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Modal Confirmar Resetear Empresa ── */}
      <AnimatePresence>
        {showResetConfirm && (
          <div className="modal-overlay" style={{ zIndex: 300 }}>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card" style={{ width: '90%', maxWidth: '420px', padding: '40px', textAlign: 'center' }}>
              <div style={{ width: 64, height: 64, background: 'rgba(245,158,11,0.1)', color: '#F59E0B', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: '2rem' }}>⚠️</div>
              <h3 style={{ color: '#F59E0B', marginTop: 0 }}>Resetear Empresa</h3>
              <p style={{ color: 'var(--text-sec)', marginBottom: '28px', fontSize: '0.9rem', lineHeight: '1.4' }}>
                ¿Estás seguro de que deseas resetear los datos de <strong>«{showResetConfirm.nombre_empresa}»</strong>?<br /><br />
                <span style={{ fontSize: '0.82rem', display: 'block', background: 'rgba(245,158,11,0.05)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(245,158,11,0.1)' }}>
                  Se eliminarán de forma <strong>PERMANENTE</strong> todas las transacciones, asientos contables, documentos SRI, movimientos de tesorería, entidades y cuentas bancarias.<br /><br />
                  🟢 El <strong>Plan de Cuentas</strong> se conservará intacto.
                </span>
              </p>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button className="btn flex-1" onClick={() => setShowResetConfirm(null)} disabled={resettingEmpresa}>Cancelar</button>
                <button className="btn flex-1" style={{ background: '#F59E0B', color: '#fff', border: 'none' }} onClick={() => handleResetEmpresa(showResetConfirm)} disabled={resettingEmpresa}>
                  {resettingEmpresa ? 'Reseteando...' : 'Sí, Resetear'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default App;
