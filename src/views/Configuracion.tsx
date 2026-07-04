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
  LogOut,
  Hash,
  Sparkles,
  Clock,
  Save,
  CheckCircle,
  Loader2
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

  // ── Notificaciones (Supabase) ────────────────────────────────────
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [emailDestino, setEmailDestino] = useState(userEmail);

  // ── Colaboradores (Supabase Multiusuario) ─────────────────────────
  const [colaboradores, setColaboradores] = useState<any[]>([]);
  const [loadingColab, setLoadingColab] = useState(false);



  const fetchColaboradores = async () => {
    if (!empresaId) return;
    setLoadingColab(true);
    const { data, error } = await supabase
      .from('colaboradores_empresa')
      .select('*')
      .eq('id_empresa', empresaId);
    if (!error && data) {
      setColaboradores(data);
    }
    setLoadingColab(false);
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
      if (error) throw error;
      return data;
    },
    enabled: !!empresaId,
    staleTime: 1000 * 60 * 5,
  });

  // Sincronizar el email destino con el valor de la BD
  useEffect(() => {
    if (configNotif?.email_destino) {
      setEmailDestino(configNotif.email_destino);
    } else if (userEmail && !configNotif?.email_destino) {
      setEmailDestino(userEmail);
    }
  }, [configNotif, userEmail]);

  const upsertMutation = useMutation({
    mutationFn: async (patch: Partial<ConfigNotif>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No autenticado');
      const { error } = await supabase
        .from('configuracion_notificaciones')
        .upsert({
          id_empresa: empresaId,
          id_usuario: user.id,
          ...configNotif,
          ...patch,
          email_destino: emailDestino || userEmail,
        }, { onConflict: 'id_empresa,id_usuario' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config_notif', empresaId] });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2500);
    },
  });

  const handleToggle = (field: keyof Pick<ConfigNotif, 'reporte_semanal' | 'reporte_mensual_iva' | 'alerta_vencimiento'>) => {
    const current = configNotif?.[field] ?? false;
    upsertMutation.mutate({ [field]: !current });
  };

  const handleSaveEmail = () => {
    setSaveStatus('saving');
    upsertMutation.mutate({ email_destino: emailDestino });
  };

  const handleDiasAnticipacion = (val: number) => {
    upsertMutation.mutate({ dias_anticipacion: val });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const isOn = (field: keyof ConfigNotif) => Boolean(configNotif?.[field]);

  // ── Toggle UI helper ────────────────────────────────────────────
  const Toggle = ({ active, onClick, disabled }: { active: boolean; onClick: () => void; disabled?: boolean }) => (
    <button
      onClick={onClick}
      disabled={disabled || loadingNotif || upsertMutation.isPending}
      style={{
        width: 48, height: 26, borderRadius: 999,
        background: active ? 'var(--primary)' : 'var(--border-color)',
        border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
        position: 'relative', transition: 'background 0.3s',
        opacity: disabled ? 0.5 : 1,
        flexShrink: 0,
      }}
    >
      <div style={{
        position: 'absolute', top: 2,
        left: active ? 24 : 2,
        width: 22, height: 22, borderRadius: '50%',
        background: '#fff',
        transition: 'left 0.3s',
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
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
          </div>
          
          <div className="flex-between p-4 bg-black/5 dark:bg-white/5 rounded-xl border border-black/10 dark:border-white/10">
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>Esquema de Color</div>
              <div className="text-sec" style={{ fontSize: '0.8rem' }}>
                Tema actual: {isDark ? 'Modo Oscuro' : 'Modo Claro'}
              </div>
            </div>
            
            <div className="flex bg-black/5 dark:bg-black/25 p-1 rounded-full border border-black/10 dark:border-white/10" style={{ display: 'flex', gap: '4px' }}>
              <button 
                onClick={() => !isDark || toggleTheme()}
                className={`btn ${!isDark ? 'btn-primary' : ''}`}
                style={{
                  borderRadius: '50px',
                  padding: '8px 16px',
                  background: !isDark ? 'var(--primary)' : 'transparent',
                  color: !isDark ? '#fff' : 'var(--text-sec)',
                  boxShadow: !isDark ? '0 4px 12px rgba(0, 214, 143, 0.25)' : 'none',
                  fontSize: '0.85rem'
                }}
              >
                <Sun size={16} /> Claro
              </button>
              <button 
                onClick={() => isDark || toggleTheme()}
                className={`btn ${isDark ? 'btn-primary' : ''}`}
                style={{
                  borderRadius: '50px',
                  padding: '8px 16px',
                  background: isDark ? 'var(--primary)' : 'transparent',
                  color: isDark ? '#fff' : 'var(--text-sec)',
                  boxShadow: isDark ? '0 4px 12px rgba(0, 214, 143, 0.25)' : 'none',
                  fontSize: '0.85rem'
                }}
              >
                <Moon size={16} /> Oscuro
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
                        onClick={() => handleDiasAnticipacion(d)}
                        style={{
                          padding: '4px 14px',
                          borderRadius: '999px',
                          border: '1.5px solid',
                          borderColor: (configNotif?.dias_anticipacion ?? 3) === d ? 'var(--primary)' : 'var(--border-color)',
                          background: (configNotif?.dias_anticipacion ?? 3) === d ? 'var(--primary-light)' : 'transparent',
                          color: (configNotif?.dias_anticipacion ?? 3) === d ? 'var(--primary)' : 'var(--text-sec)',
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

        {/* 5. SECCIÓN: COLABORADORES CONTABLES */}
        <div className="glass-card" style={{ gridColumn: 'span 1' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            👥 Acceso Compartido (Colaboradores)
          </h3>
          <p className="text-sec" style={{ marginBottom: '20px', fontSize: '0.85rem' }}>
            Permite que otros contadores con su propio usuario accedan a esta empresa para trabajar.
          </p>

          {loadingColab ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
              <Loader2 size={24} className="animate-spin" style={{ color: 'var(--primary)' }} />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Información sobre asignación de colaboradores */}
              <div style={{ background: 'rgba(99,102,241,0.05)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(99,102,241,0.1)', fontSize: '0.82rem', color: '#818CF8' }}>
                ℹ️ Para asignar o remover un colaborador de esta empresa, por favor contacte con administración.
              </div>

              {/* Lista de Colaboradores */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontWeight: 800, fontSize: '0.8rem', color: 'var(--text-sec)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Colaboradores con Acceso ({colaboradores.length})
                </div>

                {colaboradores.length === 0 ? (
                  <div className="text-sec" style={{ fontSize: '0.82rem', fontStyle: 'italic', padding: '8px 0' }}>
                    No hay colaboradores compartidos en esta empresa.
                  </div>
                ) : (
                  colaboradores.map(col => (
                    <div key={col.id} className="flex-between p-3 bg-black/5 dark:bg-white/5 rounded-xl border border-black/10 dark:border-white/10" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-main)' }}>{col.email_invitado}</span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-sec)', textTransform: 'capitalize' }}>Rol: {col.rol}</span>
                      </div>
                      

                    </div>
                  ))
                )}
              </div>

            </div>
          )}
        </div>

        {/* 4. SECCIÓN: SEGURIDAD DE LA SESIÓN */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderColor: 'rgba(239, 68, 68, 0.2)', background: 'rgba(239, 68, 68, 0.02)' }}>
          <div>
            <h3 className="flex items-center gap-2 mb-4" style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--error)' }}>
              <LogOut size={20} /> Seguridad de la Sesión
            </h3>
            <p className="text-sec" style={{ marginBottom: '24px' }}>
              Protege el acceso a las finanzas de tus clientes cerrando de forma segura tu sesión activa en este navegador.
            </p>
          </div>
          
          <button
            onClick={handleLogout}
            className="btn"
            style={{ 
              width: '100%',
              padding: '12px',
              borderRadius: '12px',
              background: 'rgba(239, 68, 68, 0.08)', 
              border: '1px solid rgba(239, 68, 68, 0.2)', 
              color: 'var(--error)', 
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)'}
          >
            <LogOut size={16} /> Cerrar Sesión Activa
          </button>
        </div>

      </div>
    </motion.div>
  );
};
