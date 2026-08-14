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
import { useSystemConfig } from './hooks/useSystemConfig';
import { trackPageView } from './services/analytics';

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
const AnuladosSRI = React.lazy(() => import('./views/AnuladosSRI').then(m => ({ default: m.AnuladosSRI })));
const LibroDiario = React.lazy(() => import('./views/LibroDiario').then(m => ({ default: m.LibroDiario })));
const Tesoreria = React.lazy(() => import('./views/Tesoreria').then(m => ({ default: m.Tesoreria })));
const UpdatePassword = React.lazy(() => import('./views/UpdatePassword').then(m => ({ default: m.UpdatePassword })));
const ATS = React.lazy(() => import('./views/ATS').then(m => ({ default: m.ATS })));
const Terms = React.lazy(() => import('./views/Terms').then(m => ({ default: m.Terms })));
const Comunicados = React.lazy(() => import('./views/Comunicados').then(m => ({ default: m.Comunicados })));
const CierrePeriodo = React.lazy(() => import('./views/CierrePeriodo').then(m => ({ default: m.CierrePeriodo })));

import { ImageUploader } from './components/ImageUploader';
import { 
  CompanyCreateModal,
  CompanyLimitModal,
  CompanyEditModal,
  CompanyDeleteConfirmModal,
  CompanyResetConfirmModal,
  CompanySuccessModal
} from './components/CompanyModals';

interface Empresa {
  id: string;
  nombre_empresa: string;
  ruc_empresa: string;
  logo_url?: string | null;
  permiso_reportes_pdf?: boolean;
  permiso_descarga_ats?: boolean;
  permiso_comunicacion_cliente?: boolean;
  estado?: string | null;
}

const App = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  
  // Cargar configuraciones del sistema
  const { mantenimiento, banner, isLoading: loadingConfig } = useSystemConfig();

  // Leer desde sessionStorage (set en index.html ANTES que Supabase limpie el hash)
  // O verificar si la ruta es literalmente /update-password
  const [isResettingPassword, setIsResettingPassword] = useState(() => {
    return window.location.pathname === '/update-password' || sessionStorage.getItem('pw_recovery_pending') === 'true';
  });
  const [activeView, setActiveView] = useState(() => {
    return localStorage.getItem('pymes_active_view') || 'dashboard';
  });
  const [visitedViews, setVisitedViews] = useState<string[]>(['dashboard']);

  // Registrar la vista activa como visitada y rastrear en GA4
  useEffect(() => {
    if (!visitedViews.includes(activeView)) {
      setVisitedViews((prev) => [...prev, activeView]);
    }
    trackPageView(`/pymes/${activeView}`);
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
  const [permisoReportesPdf, setPermisoReportesPdf] = useState<boolean>(false);
  const [permisoDescargaAts, setPermisoDescargaAts] = useState<boolean>(false);
  const [permisoComunicacionCliente, setPermisoComunicacionCliente] = useState<boolean>(false);

  // ── Editar / Archivar empresa ─────────────────────────────────────
  const [editingEmpresa, setEditingEmpresa] = useState<Empresa | null>(null);
  const [editForm, setEditForm] = useState({ nombre_empresa: '', ruc_empresa: '', logo_url: '' });
  const [showArchiveConfirm, setShowArchiveConfirm] = useState<Empresa | null>(null);
  const [archiveStep, setArchiveStep] = useState(1);
  const [archiveConfirmEmail, setArchiveConfirmEmail] = useState('');
  const [submittingArchive, setSubmittingArchive] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState<Empresa | null>(null);
  const [resettingEmpresa, setResettingEmpresa] = useState(false);
  const [resetCounter, setResetCounter] = useState(0);
  const [successModal, setSuccessModal] = useState<{ title: string; message: string; type?: 'success' | 'error' | 'info' } | null>(null);
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
      supabase.from('perfiles').update({
        ultimo_acceso: new Date().toISOString()
      }).eq('id_usuario', session.user.id).then(({ error }) => {
        if (error) {
          console.warn('[Pymes Auth] No se pudo actualizar ultimo_acceso:', error.message);
        }
      });

      fetchEmpresas();
      fetchLimite();
    }
  // Solo ejecutar cuando CAMBIA el usuario (login/logout), no en cada refresco de token
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  useEffect(() => {
    localStorage.setItem('pymes_active_view', activeView);
  }, [activeView]);

  useEffect(() => {
    const savedDensity = localStorage.getItem('pref_table_density') || 'normal';
    document.documentElement.setAttribute('data-density', savedDensity);
  }, []);

  useEffect(() => {
    if (selectedEmpresa) {
      setPermisoReportesPdf(!!selectedEmpresa.permiso_reportes_pdf);
      setPermisoDescargaAts(!!selectedEmpresa.permiso_descarga_ats);
      setPermisoComunicacionCliente(!!selectedEmpresa.permiso_comunicacion_cliente);
    } else {
      setPermisoReportesPdf(false);
      setPermisoDescargaAts(false);
      setPermisoComunicacionCliente(false);
    }
  }, [selectedEmpresa]);

  const fetchLimite = async () => {
    const { data, error } = await supabase
      .from('perfiles')
      .select('limite_empresas, rol')
      .eq('id_usuario', session?.user.id)
      .single();

    if (!error && data) {
      if (data.rol === 'admin') {
        alert('Acceso denegado. Las cuentas de administrador no pueden ingresar al portal de Pymes.');
        await supabase.auth.signOut();
        setSession(null);
        return;
      }
      setLimiteEmpresas(data.limite_empresas || 2);
    }
  };

  const fetchEmpresas = async () => {
    if (!session?.user?.id) return;
    setLoadingEmpresas(true);

    // 1. Empresas donde el usuario es propietario
    const { data: ownedData, error: ownedError } = await supabase
      .from('empresas_gestionadas')
      .select('*')
      .order('nombre_empresa');

    // 2. Empresas donde el usuario es colaborador
    const { data: colabIds } = await supabase
      .from('colaboradores_empresa')
      .select('id_empresa')
      .eq('id_usuario', session.user.id);

    let colabEmpresas: any[] = [];
    if (colabIds && colabIds.length > 0) {
      const ids = colabIds.map((c: any) => c.id_empresa);
      const ownedIds = (ownedData || []).map((e: any) => e.id);
      // Solo buscar las que NO son propias (evitar duplicados)
      const missingIds = ids.filter((id: string) => !ownedIds.includes(id));
      if (missingIds.length > 0) {
        const { data: colabData } = await supabase
          .from('empresas_gestionadas')
          .select('*')
          .in('id', missingIds)
          .order('nombre_empresa');
        colabEmpresas = (colabData || []).map((e: any) => ({ ...e, es_colaborador: true }));
      }
    }

    const allEmpresas = [...(ownedData || []), ...colabEmpresas];

    if (!ownedError) {
      setEmpresas(allEmpresas);
      const savedId = localStorage.getItem('pymes_selected_empresa_id');
      const activeData = allEmpresas.filter(e => e.estado !== 'pendiente_eliminacion');
      const found = activeData.find(e => e.id === savedId);
      if (found) {
        setSelectedEmpresa(found);
      } else if (activeData.length > 0 && !selectedEmpresa) {
        setSelectedEmpresa(activeData[0]);
      } else if (activeData.length === 0) {
        setSelectedEmpresa(null);
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

  // ── Solicitar eliminación segura de empresa ───────────────────────────
  const handleRequestDeletion = async (emp: Empresa) => {
    if (!archiveConfirmEmail.trim()) {
      alert("Por favor ingresa un correo de contacto.");
      return;
    }
    setSubmittingArchive(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No hay una sesión de usuario activa.");

      const { error: insErr } = await supabase.from('solicitudes_eliminacion').insert({
        id_empresa: emp.id,
        id_usuario: user.id,
        correo_contacto: archiveConfirmEmail.trim(),
        estado: 'pendiente'
      });
      if (insErr) throw insErr;

      const { error: updErr } = await supabase.from('empresas_gestionadas').update({
        estado: 'pendiente_eliminacion'
      }).eq('id', emp.id);
      if (updErr) throw updErr;

      setEmpresas(prev => prev.map(e => e.id === emp.id ? { ...e, estado: 'pendiente_eliminacion' } : e));
      
      const remainingActives = empresas.filter(e => e.id !== emp.id && e.estado !== 'pendiente_eliminacion');
      if (selectedEmpresa?.id === emp.id) {
        setSelectedEmpresa(remainingActives[0] || null);
      }

      setSuccessModal({
        title: "Solicitud Registrada",
        message: "Tu solicitud de eliminación ha sido registrada con éxito. Se enviará un respaldo ZIP completo de tus datos contables a tu correo de contacto antes del borrado físico definitivo.",
        type: 'success'
      });
      setShowArchiveConfirm(null);
    } catch (err: any) {
      setSuccessModal({
        title: "Error",
        message: "Error al registrar solicitud: " + (err.message || err),
        type: 'error'
      });
    } finally {
      setSubmittingArchive(false);
    }
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

      setSuccessModal({
        title: "Empresa Reseteada",
        message: "¡Datos de la empresa reseteados con éxito! El plan de cuentas se ha conservado.",
        type: 'success'
      });
      
      // Forzar un reinicio completo de todas las vistas montadas
      setResetCounter(prev => prev + 1);
      setVisitedViews([activeView]);
      setShowResetConfirm(null);
    } catch (error: any) {
      setSuccessModal({
        title: "Error",
        message: "Error al resetear datos: " + (error.message || error),
        type: 'error'
      });
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
      case 'xml-anulados': return <AnuladosSRI empresaId={selectedEmpresa.id} />;
      case 'libro-diario': return <LibroDiario empresaId={selectedEmpresa.id} activeView={activeView} />;
      case 'entidades': return <Entidades empresaId={selectedEmpresa.id} />;
      case 'plan-cuentas': return <PlanCuentas empresaId={selectedEmpresa.id} />;
      case 'asientos': return <Asientos empresaId={selectedEmpresa.id} activeView={activeView} />;
      case 'tesoreria': return <Tesoreria empresaId={selectedEmpresa.id} mode="resumen" />;
      case 'cobros': return <Tesoreria empresaId={selectedEmpresa.id} mode="cobros" />;
      case 'pagos': return <Tesoreria empresaId={selectedEmpresa.id} mode="pagos" />;
      case 'conciliacion': return <Tesoreria empresaId={selectedEmpresa.id} mode="conciliacion" />;
      case 'reportes': return <Reportes empresaId={selectedEmpresa.id} permisoReportesPdf={permisoReportesPdf} />;
      case 'reportes-fiscales': return <ATS empresaId={selectedEmpresa.id} permisoDescargaAts={permisoDescargaAts} />;
      case 'comunicados': return <Comunicados empresaId={selectedEmpresa.id} permisoComunicacionCliente={permisoComunicacionCliente} />;
      case 'cierre-periodo': return <CierrePeriodo empresaId={selectedEmpresa.id} />;
      case 'config': return <Configuracion empresaId={selectedEmpresa.id} userEmail={session?.user?.email ?? ''} />;
      case 'perfil': 
        return (
          <Perfil 
            empresas={empresas}
            onEditEmpresa={openEditEmpresa}
            onArchiveEmpresa={(emp) => {
              setArchiveStep(1);
              setArchiveConfirmEmail('');
              setShowArchiveConfirm(emp);
            }}
            onResetEmpresa={(emp) => setShowResetConfirm(emp)}
            onAddNewEmpresa={() => setShowNewEmpresaModal(true)}
          />
        );
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
  if ((loadingAuth || loadingConfig || loadingEmpresas) && empresas.length === 0) {
    return (
      <div className="flex-center" style={{ height: '100vh', background: '#0f172a' }}>
        <Loader2 className="animate-spin text-primary" size={48} />
      </div>
    );
  }

  // Pantalla de Mantenimiento Global
  if (mantenimiento.activo) {
    return (
      <div className="flex-center" style={{ height: '100vh', background: '#0f172a', flexDirection: 'column', color: '#fff', textAlign: 'center', padding: '20px', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ fontSize: '48px', marginBottom: '20px' }}>🛠️</div>
        <h1 style={{ fontSize: '24px', fontWeight: 800, margin: '0 0 10px 0' }}>Servicio en Mantenimiento</h1>
        <p style={{ color: '#94a3b8', fontSize: '15px', maxWidth: '400px', margin: 0, lineHeight: 1.6 }}>
          {mantenimiento.mensaje || 'Estamos realizando mejoras programadas. Regresaremos en unos minutos.'}
        </p>
      </div>
    );
  }

  return (
    <div className="app-container">
      {banner.activo && (
        <div style={{
          background: banner.tipo === 'warning' ? '#f59e0b' : banner.tipo === 'danger' ? '#ef4444' : banner.tipo === 'success' ? '#10b981' : '#3b82f6',
          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '13px', fontWeight: 700, padding: '10px 16px', textAlign: 'center',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)', zIndex: 1000, flexShrink: 0
        }}>
          <span style={{ marginRight: '8px' }}>📢</span>
          {banner.texto}
        </div>
      )}
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
          session={session}
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
                key={`${view}_${resetCounter}`}
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

      <CompanyCreateModal
        isOpen={showNewEmpresaModal}
        onClose={() => setShowNewEmpresaModal(false)}
        newEmpresaName={newEmpresaName}
        setNewEmpresaName={setNewEmpresaName}
        newEmpresaRuc={newEmpresaRuc}
        setNewEmpresaRuc={setNewEmpresaRuc}
        newEmpresaLogo={newEmpresaLogo}
        setNewEmpresaLogo={setNewEmpresaLogo}
        newEmpresaId={newEmpresaId}
        onCreate={createEmpresa}
      />

      <CompanyLimitModal
        isOpen={showLimitModal}
        onClose={() => setShowLimitModal(false)}
      />

      <CompanyEditModal
        editingEmpresa={editingEmpresa}
        onClose={() => setEditingEmpresa(null)}
        editForm={editForm}
        setEditForm={setEditForm}
        onSave={handleSaveEdit}
        savingEdit={savingEdit}
      />

      <CompanyDeleteConfirmModal
        showArchiveConfirm={showArchiveConfirm}
        onClose={() => setShowArchiveConfirm(null)}
        archiveStep={archiveStep}
        setArchiveStep={setArchiveStep}
        archiveConfirmEmail={archiveConfirmEmail}
        setArchiveConfirmEmail={setArchiveConfirmEmail}
        onSubmit={handleRequestDeletion}
        submittingArchive={submittingArchive}
      />

      <CompanyResetConfirmModal
        showResetConfirm={showResetConfirm}
        onClose={() => setShowResetConfirm(null)}
        onSubmit={handleResetEmpresa}
        resettingEmpresa={resettingEmpresa}
      />

      <CompanySuccessModal
        successModal={successModal}
        onClose={() => setSuccessModal(null)}
      />

    </div>
  );
};

export default App;
