import { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../services/supabase';
import { 
  Sun, 
  Moon, 
  Layout,
  Eye,
  Volume2,
  Bell,
  Mail,
  LogOut,
  Hash,
  Sparkles
} from 'lucide-react';
import { motion } from 'framer-motion';

export const Configuracion = () => {
  const { isDark, toggleTheme } = useTheme();
  
  // States stored in localStorage for full functionality
  const [decimals, setDecimals] = useState(() => {
    return localStorage.getItem('pref_decimals') || '2';
  });
  
  const [density, setDensity] = useState(() => {
    return localStorage.getItem('pref_table_density') || 'normal';
  });

  const [soundAlerts, setSoundAlerts] = useState(() => {
    return localStorage.getItem('pref_sound_alerts') === 'true';
  });

  const [emailReports, setEmailReports] = useState(() => {
    return localStorage.getItem('pref_email_reports') !== 'false'; // default true
  });

  useEffect(() => {
    localStorage.setItem('pref_decimals', decimals);
  }, [decimals]);

  useEffect(() => {
    localStorage.setItem('pref_table_density', density);
    document.documentElement.setAttribute('data-density', density);
  }, [density]);

  useEffect(() => {
    localStorage.setItem('pref_sound_alerts', String(soundAlerts));
  }, [soundAlerts]);

  useEffect(() => {
    localStorage.setItem('pref_email_reports', String(emailReports));
  }, [emailReports]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

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

        {/* 3. SECCIÓN: ALERTAS Y NOTIFICACIONES */}
        <div className="glass-card">
          <h3 className="flex items-center gap-2 mb-4" style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Bell size={20} className="text-primary" /> Alertas & Notificaciones
          </h3>
          <p className="text-sec" style={{ marginBottom: '24px' }}>
            Configura las vías por las cuales el sistema te informará sobre transacciones nuevas o alertas de auditoría.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Alertas Sonoras */}
            <div className="flex-between p-3 bg-black/5 dark:bg-white/5 rounded-xl border border-black/10 dark:border-white/10">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Volume2 size={18} className="text-sec" />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>Alertas de Sonido</div>
                  <div className="text-sec" style={{ fontSize: '0.78rem' }}>Reproducir sonidos al registrar transacciones.</div>
                </div>
              </div>
              <button
                onClick={() => setSoundAlerts(!soundAlerts)}
                style={{
                  width: 48, height: 26, borderRadius: 999,
                  background: soundAlerts ? 'var(--primary)' : 'var(--border-color)',
                  border: 'none', cursor: 'pointer', position: 'relative',
                  transition: 'background 0.3s',
                }}
              >
                <div style={{
                  position: 'absolute', top: 2,
                  left: soundAlerts ? 24 : 2,
                  width: 22, height: 22, borderRadius: '50%',
                  background: '#fff',
                  transition: 'left 0.3s',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                }} />
              </button>
            </div>

            {/* Reportes por Email */}
            <div className="flex-between p-3 bg-black/5 dark:bg-white/5 rounded-xl border border-black/10 dark:border-white/10">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Mail size={18} className="text-sec" />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>Reportes Semanales</div>
                  <div className="text-sec" style={{ fontSize: '0.78rem' }}>Recibir un resumen financiero semanal en mi correo.</div>
                </div>
              </div>
              <button
                onClick={() => setEmailReports(!emailReports)}
                style={{
                  width: 48, height: 26, borderRadius: 999,
                  background: emailReports ? 'var(--primary)' : 'var(--border-color)',
                  border: 'none', cursor: 'pointer', position: 'relative',
                  transition: 'background 0.3s',
                }}
              >
                <div style={{
                  position: 'absolute', top: 2,
                  left: emailReports ? 24 : 2,
                  width: 22, height: 22, borderRadius: '50%',
                  background: '#fff',
                  transition: 'left 0.3s',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                }} />
              </button>
            </div>
          </div>
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
