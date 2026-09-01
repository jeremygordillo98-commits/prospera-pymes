import { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../services/supabase';
import { 
  Sun,
  Moon,
  Layout,
  Eye,
  Bell,
  Mail,
  Hash,
  Sparkles,
  Clock,
  Save,
  CheckCircle,
  Loader2,
  Users,
  Info,
  LogOut
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface ConfiguracionProps {
  empresaId: string;
  userEmail?: string;
}

interface ConfigNotif {
  reporte_semanal: boolean;
  reporte_mensual_iva: boolean;
  alerta_vencimiento: boolean;
  dias_anticipacion: number;
  email_destino: string;
}

export const Configuracion = ({ empresaId, userEmail = '' }: ConfiguracionProps) => {
  const { isDark, toggleTheme } = useTheme();
  const queryClient = useQueryClient();

  // ── Preferencias visuales (localStorage) ─────────────────────────
  const [decimals, setDecimals] = useState(() => {
    return localStorage.getItem('pref_decimals') || '2';
  });
  
  const [density, setDensity] = useState(() => {
    return localStorage.getItem('pref_table_density') || 'normal';
  });

  useEffect(() => {
    localStorage.setItem('pref_decimals', decimals);
  }, [decimals]);

  useEffect(() => {
    localStorage.setItem('pref_table_density', density);
    document.documentElement.setAttribute('data-density', density);
  }, [density]);

  // ── Notificaciones (Supabase + LocalStorage Backup) ─────────────
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [emailDestino, setEmailDestino] = useState(userEmail);

  // Inicialización inteligente desde LocalStorage por empresa para persistencia garantizada
  const [localNotif, setLocalNotif] = useState<ConfigNotif>(() => {
    if (empresaId) {
      const saved = localStorage.getItem(`pref_notif_${empresaId}`);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          // ignore
        }
      }
    }
    return {
      reporte_semanal: false,
      reporte_mensual_iva: false,
      alerta_vencimiento: false,
      dias_anticipacion: 3,
      email_destino: userEmail,
    };
  });

  // Cargar estado en LocalStorage al cambiar de empresa
  useEffect(() => {
    if (empresaId) {
      const saved = localStorage.getItem(`pref_notif_${empresaId}`);
      if (saved) {
        try {
          setLocalNotif(JSON.parse(saved));
        } catch (e) {
          // ignore
        }
      }
    }
  }, [empresaId]);

  // Sincronizar LocalStorage en cada modificación
  useEffect(() => {
    if (empresaId) {
      localStorage.setItem(`pref_notif_${empresaId}`, JSON.stringify(localNotif));
    }
  }, [localNotif, empresaId]);

  // ── Colaboradores (Supabase Multiusuario) ─────────────────────────
  const [colaboradores, setColaboradores] = useState<any[]>([]);
  const [loadingColab, setLoadingColab] = useState(false);

  const fetchColaboradores = async () => {
    if (!empresaId) return;
    setLoadingColab(true);
    try {
      const { data, error } = await supabase
        .from('colaboradores_empresa')
        .select('*')
        .eq('id_empresa', empresaId);

      if (!error && data) {
        const enriched = await Promise.all(
          data.map(async (item: any) => {
            const foundEmail = item.email_invitado || item.email || item.correo_colaborador || item.correo;
            if (foundEmail) {
              return { ...item, displayEmail: foundEmail };
            }
            if (item.id_usuario) {
              const { data: prof } = await supabase
                .from('perfiles')
                .select('email, correo, nombre_completo')
                .eq('id_usuario', item.id_usuario)
                .maybeSingle();

              if (prof?.email || prof?.correo) {
                return { ...item, displayEmail: prof.email || prof.correo };
              }
            }
            return { ...item, displayEmail: item.id_usuario || 'Colaborador' };
          })
        );
        setColaboradores(enriched);
      }
    } catch (err) {
      console.error('[Configuracion] Error cargando colaboradores:', err);
    } finally {
      setLoadingColab(false);
    }
  };

  useEffect(() => {
    if (empresaId) {
      fetchColaboradores();
    }
  }, [empresaId]);

  const { data: configNotif, isLoading: loadingNotif } = useQuery<ConfigNotif>({
    queryKey: ['config_notif', empresaId],
    queryFn: async () => {
      if (!empresaId) return null;
      const { data, error } = await supabase
        .from('configuracion_notificaciones')
        .select('*')
        .eq('id_empresa', empresaId)
        .maybeSingle();
      if (error) {
        console.warn('[Configuracion] Advertencia consultando configuracion_notificaciones:', error.message);
        return null;
      }
      return data;
    },
    enabled: !!empresaId,
    staleTime: 1000 * 60 * 5,
  });

  // Sincronizar el estado con los datos provenientes de Supabase (si existen)
  useEffect(() => {
    if (configNotif) {
      setLocalNotif(prev => {
        const updated = {
          reporte_semanal: Boolean(configNotif.reporte_semanal),
          reporte_mensual_iva: Boolean(configNotif.reporte_mensual_iva),
          alerta_vencimiento: Boolean(configNotif.alerta_vencimiento),
          dias_anticipacion: Number(configNotif.dias_anticipacion) || prev.dias_anticipacion || 3,
          email_destino: configNotif.email_destino || prev.email_destino || userEmail,
        };
        if (empresaId) {
          localStorage.setItem(`pref_notif_${empresaId}`, JSON.stringify(updated));
        }
        return updated;
      });
      if (configNotif.email_destino) {
        setEmailDestino(configNotif.email_destino);
      }
    }
  }, [configNotif, userEmail, empresaId]);

  const upsertMutation = useMutation({
    mutationFn: async (patch: Partial<ConfigNotif>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No autenticado');

      const payload = {
        id_empresa: empresaId,
        id_usuario: user.id,
        ...localNotif,
        ...patch,
        email_destino: emailDestino || userEmail,
      };

      let { error } = await supabase
        .from('configuracion_notificaciones')
        .upsert(payload, { onConflict: 'id_empresa' });

      if (error) {
        const { error: err2 } = await supabase
          .from('configuracion_notificaciones')
          .upsert(payload);

        if (err2) {
          console.warn('[Configuracion] Nota: Estado guardado localmente debido a politica de BD:', err2.message);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config_notif', empresaId] });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2500);
    },
  });

  const handleToggle = (field: keyof Pick<ConfigNotif, 'reporte_semanal' | 'reporte_mensual_iva' | 'alerta_vencimiento'>) => {
    const nextVal = !localNotif[field];
    const updated = { ...localNotif, [field]: nextVal };
    setLocalNotif(updated);
    if (empresaId) {
      localStorage.setItem(`pref_notif_${empresaId}`, JSON.stringify(updated));
    }
    upsertMutation.mutate({ [field]: nextVal });
  };

  const handleSaveEmail = () => {
    setSaveStatus('saving');
    const updated = { ...localNotif, email_destino: emailDestino };
    setLocalNotif(updated);
    if (empresaId) {
      localStorage.setItem(`pref_notif_${empresaId}`, JSON.stringify(updated));
    }
    upsertMutation.mutate({ email_destino: emailDestino });
  };

  const handleDiasAnticipacion = (val: number) => {
    const updated = { ...localNotif, dias_anticipacion: val };
    setLocalNotif(updated);
    if (empresaId) {
      localStorage.setItem(`pref_notif_${empresaId}`, JSON.stringify(updated));
    }
    upsertMutation.mutate({ dias_anticipacion: val });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const isOn = (field: keyof ConfigNotif) => Boolean(localNotif[field]);

  // ── Componente de Toggle Visual Ultra-Fluido ────────────────────
  const Toggle = ({ active, onClick, disabled }: { active: boolean; onClick: () => void; disabled?: boolean }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loadingNotif}
      style={{
        width: 48, height: 26, borderRadius: 999,
        background: active ? 'var(--primary)' : 'rgba(255,255,255,0.15)',
        border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
        position: 'relative', transition: 'all 0.25s ease',
        opacity: disabled ? 0.5 : 1,
        flexShrink: 0,
        boxShadow: active ? '0 0 10px rgba(0, 214, 143, 0.4)' : 'none'
      }}
    >
      <div style={{
        position: 'absolute', top: 2,
        left: active ? 24 : 2,
        width: 22, height: 22, borderRadius: '50%',
        background: '#fff',
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
      }} />
    </button>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-4xl mx-auto mt-6">
      <header>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--primary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.5, fontSize: '0.8rem', marginBottom: 8 }}>
          <Sparkles size={14} /> Preferencias del Sistema
        </div>
        <h2 className="h1" style={{ fontSize: '2.2rem' }}>Configuración Personalizada</h2>
        <p className="text-sec">Ajusta tu entorno de trabajo contable y visual para Prospera PyMEs.</p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        
        {/* 1. SECCIÓN: APARIENCIA */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h3 className="flex items-center gap-2 mb-4" style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layout size={20} className="text-primary" /> Apariencia Visual
            </h3>
            <p className="text-sec" style={{ marginBottom: '24px' }}>
              Cambia entre el modo claro y oscuro para trabajar con la luminosidad que te resulte más cómoda.
            </p>

            <div className="flex-between p-3 bg-black/5 dark:bg-white/5 rounded-xl border border-black/10 dark:border-white/10">
              <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Tema de la Plataforma</span>
              <button 
                onClick={toggleTheme}
                className="btn btn-outline"
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px' }}
              >
                {isDark ? <Sun size={16} className="text-amber-400" /> : <Moon size={16} className="text-indigo-400" />}
                <span>{isDark ? 'Modo Claro' : 'Modo Oscuro'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* 2. SECCIÓN: VISUALIZACIÓN CONTABLE */}
        <div className="glass-card">
          <h3 className="flex items-center gap-2 mb-4" style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Eye size={20} className="text-primary" /> Visualización de Datos
          </h3>
          <p className="text-sec" style={{ marginBottom: '24px' }}>
            Personaliza cómo se muestran los números y el espaciado en las tablas financieras del sistema.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Decimales */}
            <div className="flex-between p-3 bg-black/5 dark:bg-white/5 rounded-xl border border-black/10 dark:border-white/10">
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Hash size={14} style={{ color: 'var(--primary)' }} /> Decimales en Cifras
                </div>
                <div className="text-sec" style={{ fontSize: '0.78rem' }}>Precisión para importes y reportes.</div>
              </div>
              <select 
                value={decimals}
                onChange={e => setDecimals(e.target.value)}
                style={{
                  background: 'var(--bg-color)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-main)',
                  borderRadius: '8px',
                  padding: '6px 12px',
                  outline: 'none',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                <option value="2">2 Decimales ($0.00)</option>
                <option value="4">4 Decimales ($0.0000)</option>
              </select>
            </div>

            {/* Densidad */}
            <div className="flex-between p-3 bg-black/5 dark:bg-white/5 rounded-xl border border-black/10 dark:border-white/10">
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Layout size={14} style={{ color: 'var(--primary)' }} /> Densidad de Tablas
                </div>
                <div className="text-sec" style={{ fontSize: '0.78rem' }}>Espaciado de filas en Libro Diario y Balances.</div>
              </div>
              <select 
                value={density}
                onChange={e => setDensity(e.target.value)}
                style={{
                  background: 'var(--bg-color)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-main)',
                  borderRadius: '8px',
                  padding: '6px 12px',
                  outline: 'none',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                <option value="normal">Normal</option>
                <option value="compact">Compacta</option>
              </select>
            </div>
          </div>
        </div>

        {/* 3. SECCIÓN: NOTIFICACIONES POR EMAIL */}
        <div className="glass-card" style={{ gridColumn: 'span 1' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Bell size={20} className="text-primary" /> Notificaciones por Email
          </h3>
          <p className="text-sec" style={{ marginBottom: '20px', fontSize: '0.85rem' }}>
            Recibe reportes automáticos de tu contabilidad directo en tu correo.
          </p>

          {loadingNotif ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
              <Loader2 size={24} className="animate-spin" style={{ color: 'var(--primary)' }} />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

              {/* Correo destino */}
              <div className="p-3 bg-black/5 dark:bg-white/5 rounded-xl border border-black/10 dark:border-white/10">
                <div style={{ fontWeight: 700, fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                  <Mail size={14} style={{ color: 'var(--primary)' }} /> Correo de Destino
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="email"
                    value={emailDestino}
                    onChange={e => setEmailDestino(e.target.value)}
                    placeholder="correo@ejemplo.com"
                    style={{
                      flex: 1,
                      background: 'var(--input-bg)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-main)',
                      borderRadius: '8px',
                      padding: '7px 12px',
                      fontSize: '0.85rem',
                      outline: 'none',
                    }}
                  />
                  <button
                    onClick={handleSaveEmail}
                    disabled={saveStatus === 'saving' || upsertMutation.isPending}
                    style={{
                      padding: '7px 14px',
                      borderRadius: '8px',
                      background: saveStatus === 'saved' ? 'rgba(0,214,143,0.12)' : 'var(--primary)',
                      color: saveStatus === 'saved' ? 'var(--primary)' : '#fff',
                      border: saveStatus === 'saved' ? '1px solid var(--primary)' : 'none',
                      fontWeight: 700,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.2s',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {saveStatus === 'saving' ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : saveStatus === 'saved' ? (
                      <><CheckCircle size={14} /> Guardado</>
                    ) : (
                      <><Save size={14} /> Guardar</>
                    )}
                  </button>
                </div>
                <p className="text-sec" style={{ fontSize: '0.75rem', marginTop: '6px' }}>
                  Todos los reportes automáticos se enviarán a esta dirección.
                </p>
              </div>

              {/* Toggle: Reporte Semanal */}
              <div className="flex-between p-3 bg-black/5 dark:bg-white/5 rounded-xl border border-black/10 dark:border-white/10">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Mail size={18} className="text-sec" />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>Reporte Semanal</div>
                    <div className="text-sec" style={{ fontSize: '0.78rem' }}>Resumen de ingresos, egresos y saldo — todos los lunes.</div>
                  </div>
                </div>
                <Toggle active={isOn('reporte_semanal')} onClick={() => handleToggle('reporte_semanal')} />
              </div>

              {/* Toggle: Reporte Mensual IVA */}
              <div className="flex-between p-3 bg-black/5 dark:bg-white/5 rounded-xl border border-black/10 dark:border-white/10">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Hash size={18} className="text-sec" />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>Reporte Mensual de IVA</div>
                    <div className="text-sec" style={{ fontSize: '0.78rem' }}>IVA cobrado vs pagado del mes anterior — el día 1 de cada mes.</div>
                  </div>
                </div>
                <Toggle active={isOn('reporte_mensual_iva')} onClick={() => handleToggle('reporte_mensual_iva')} />
              </div>

              {/* Toggle: Alerta de Vencimiento SRI */}
              <div className="p-3 bg-black/5 dark:bg-white/5 rounded-xl border border-black/10 dark:border-white/10">
                <div className="flex-between" style={{ marginBottom: isOn('alerta_vencimiento') ? '12px' : '0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Clock size={18} className="text-sec" />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>Alerta de Vencimiento SRI</div>
                      <div className="text-sec" style={{ fontSize: '0.78rem' }}>Recordatorio antes de la fecha de declaración mensual.</div>
                    </div>
                  </div>
                  <Toggle active={isOn('alerta_vencimiento')} onClick={() => handleToggle('alerta_vencimiento')} />
                </div>

                {/* Selector de anticipación (solo si activo) */}
                {isOn('alerta_vencimiento') && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '4px', flexWrap: 'wrap' }}
                  >
                    <span className="text-sec" style={{ fontSize: '0.8rem' }}>Notificarme con:</span>
                    {[3, 5, 7].map(d => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => handleDiasAnticipacion(d)}
                        style={{
                          padding: '4px 14px',
                          borderRadius: '999px',
                          border: '1.5px solid',
                          borderColor: (localNotif?.dias_anticipacion ?? 3) === d ? 'var(--primary)' : 'var(--border-color)',
                          background: (localNotif?.dias_anticipacion ?? 3) === d ? 'rgba(0, 214, 143, 0.15)' : 'transparent',
                          color: (localNotif?.dias_anticipacion ?? 3) === d ? 'var(--primary)' : 'var(--text-sec)',
                          fontWeight: 700,
                          fontSize: '0.82rem',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}
                      >
                        {d} días
                      </button>
                    ))}
                    <span className="text-sec" style={{ fontSize: '0.8rem' }}>de anticipación</span>
                  </motion.div>
                )}

              </div>

            </div>
          )}
        </div>

        {/* 4. SECCIÓN: ACCESO COMPARTIDO (COLABORADORES) */}
        <div className="glass-card">
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={20} className="text-primary" /> Acceso Compartido (Colaboradores)
          </h3>
          <p className="text-sec" style={{ marginBottom: '20px', fontSize: '0.85rem' }}>
            Permite que otros contadores con su propio usuario accedan a esta empresa para trabajar.
          </p>

          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400 text-xs font-semibold mb-4 flex items-start gap-2">
            <Info size={16} className="shrink-0 mt-0.5" />
            <span>Para asignar o remover un colaborador de esta empresa, por favor contacte con administración.</span>
          </div>

          <div style={{ fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-sec)', marginBottom: '12px' }}>
            Colaboradores con Acceso ({colaboradores.length})
          </div>

          {loadingColab ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '16px' }}>
              <Loader2 size={20} className="animate-spin text-primary" />
            </div>
          ) : colaboradores.length > 0 ? (
            <div className="space-y-2">
              {colaboradores.map((c: any) => (
                <div key={c.id || c.id_usuario} className="p-3 bg-black/5 dark:bg-white/5 rounded-xl border border-black/10 dark:border-white/10 flex-between">
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                      {c.displayEmail || c.email_invitado || c.email || c.correo_colaborador || c.id_usuario}
                    </div>
                    <div className="text-sec" style={{ fontSize: '0.78rem' }}>Rol: {c.rol || 'Colaborador'}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-3 bg-black/5 dark:bg-white/5 rounded-xl text-center text-xs text-sec">
              No hay colaboradores asignados a esta empresa.
            </div>
          )}
        </div>

        {/* 5. SECCIÓN: SEGURIDAD DE LA SESIÓN */}
        <div className="glass-card">
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <LogOut size={20} className="text-rose-500" /> Seguridad de la Sesión
          </h3>
          <p className="text-sec" style={{ marginBottom: '20px', fontSize: '0.85rem' }}>
            Protege el acceso a las finanzas de tus clientes cerrando sesión al terminar tu jornada.
          </p>
          <button
            type="button"
            onClick={handleLogout}
            className="btn"
            style={{
              background: 'rgba(239, 68, 68, 0.12)',
              color: '#ef4444',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              fontWeight: 700,
              padding: '10px 18px',
              borderRadius: '10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <LogOut size={16} /> Cerrar Sesión Segura
          </button>
        </div>

      </div>
    </motion.div>
  );
};
