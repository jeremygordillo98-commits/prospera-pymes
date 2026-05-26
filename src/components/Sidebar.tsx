import { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Building2,
  Plus,
  LogOut
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../services/supabase';
import { MENU_STRUCTURE } from '../constants/menu';

interface SidebarProps {
  activeView: string;
  setActiveView: (view: string) => void;
  selectedEmpresa: any;
  setSelectedEmpresa: (emp: any) => void;
  empresas: any[];
  setShowNewEmpresaModal: (show: boolean) => void;
  session: any;
  openEditEmpresa: (emp: any) => void;
  onArchiveEmpresa: (emp: any) => void;
  onResetEmpresa: (emp: any) => void;
}

export const Sidebar = ({
  activeView,
  setActiveView,
  selectedEmpresa,
  setSelectedEmpresa,
  empresas,
  setShowNewEmpresaModal,
  session,
  openEditEmpresa,
  onArchiveEmpresa,
  onResetEmpresa,
}: SidebarProps) => {
  const [openMenus, setOpenMenus] = useState<string[]>(['config-parent']);

  const toggleMenu = (item: any) => {
    const id = item.id;
    const isOpening = !openMenus.includes(id);

    setOpenMenus(prev =>
      isOpening ? [...prev, id] : prev.filter(m => m !== id)
    );

    // Si se está abriendo y tiene hijos, navega directo al primer hijo
    if (isOpening && item.children && item.children.length > 0) {
      setActiveView(item.children[0].id);
    }
  };

  return (
    <aside className="sidebar custom-scrollbar" style={{ overflowY: 'auto', overflowX: 'hidden' }}>
      <div style={{ padding: '0 20px', margin: '24px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <div style={{
            width: 36,
            height: 36,
            background: 'linear-gradient(135deg, var(--primary), #8B5CF6)',
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 800,
            boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
          }}>P</div>
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 800, letterSpacing: '-0.5px', margin: 0 }}>Prospera</h2>
            <div style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>Pymes Contable</div>
          </div>
        </div>
      </div>

      {/* Selector de Cliente - UI Pulida */}
      <div style={{ padding: '0 16px', marginBottom: '24px' }}>
        <div className="glass-card" style={{ padding: '12px', border: '1px solid var(--border-color)', borderRadius: '16px', background: 'rgba(255,255,255,0.02)' }}>
          <label style={{ fontSize: '0.65rem', color: 'var(--text-sec)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', display: 'block', paddingLeft: '4px' }}>Empresa Gestionada</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <Building2 size={16} className="text-sec" style={{ opacity: 0.6 }} />
            <select
              value={selectedEmpresa?.id || ''}
              onChange={(e) => setSelectedEmpresa(empresas.find(emp => emp.id === e.target.value) || null)}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                color: 'var(--text-main)',
                fontSize: '0.85rem',
                fontWeight: 600,
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              {empresas.map(emp => (
                <option key={emp.id} value={emp.id} style={{ background: 'var(--bg-color)', color: 'var(--text-main)' }}>{emp.nombre_empresa}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => setShowNewEmpresaModal(true)}
            style={{
              width: '100%',
              padding: '8px',
              background: 'var(--primary-light)',
              border: 'none',
              borderRadius: '8px',
              color: 'var(--primary)',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.2s'
            }}
          >
            <Plus size={14} /> Registrar Empresa
          </button>

          {/* Acciones sobre empresa activa */}
          {selectedEmpresa && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => openEditEmpresa(selectedEmpresa)}
                  title="Editar empresa"
                  style={{ flex: 1, padding: '7px', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8, color: '#818CF8', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                >✏️ Editar</button>
                <button
                  onClick={() => onArchiveEmpresa(selectedEmpresa)}
                  title="Eliminar empresa"
                  style={{ flex: 1, padding: '7px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, color: 'var(--error)', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                >🗑️ Eliminar</button>
              </div>
              <button
                onClick={() => onResetEmpresa(selectedEmpresa)}
                title="Resetear todos los datos contables y mantener el plan de cuentas"
                style={{ width: '100%', padding: '7px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, color: '#F59E0B', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
              >🔄 Resetear Datos</button>
            </div>
          )}
        </div>
      </div>

      {/* Menú de Navegación Jerárquico */}
      <nav style={{ flex: 1, padding: '0 12px' }}>
        {MENU_STRUCTURE.map((item) => (
          <div key={item.id} style={{ marginBottom: '4px' }}>
            {item.children ? (
              // Parent Item
              <>
                <button
                  onClick={() => toggleMenu(item)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    background: 'transparent',
                    border: 'none',
                    color: openMenus.includes(item.id) ? 'var(--text-main)' : 'var(--text-sec)',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    transition: 'all 0.2s'
                  }}
                >
                  <item.icon size={20} className={openMenus.includes(item.id) ? 'text-primary' : ''} />
                  <span style={{ flex: 1, textAlign: 'left' }}>{item.label}</span>
                  {openMenus.includes(item.id) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>

                <AnimatePresence>
                  {openMenus.includes(item.id) && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      style={{ overflow: 'hidden', paddingLeft: '12px' }}
                    >
                      {item.children.map(child => (
                        <button
                          key={child.id}
                          onClick={() => setActiveView(child.id)}
                          style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '10px 14px',
                            margin: '2px 0',
                            borderRadius: '10px',
                            background: activeView === child.id ? 'var(--primary-light)' : 'transparent',
                            border: activeView === child.id ? '1px solid rgba(99, 102, 241, 0.1)' : 'none',
                            color: activeView === child.id ? 'var(--primary)' : 'var(--text-sec)',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            fontWeight: activeView === child.id ? 700 : 500,
                            transition: 'all 0.2s'
                          }}
                        >
                          <child.icon size={18} />
                          <span>{child.label}</span>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            ) : (
              // Single Item
              <button
                onClick={() => setActiveView(item.id)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 14px',
                  borderRadius: '12px',
                  background: activeView === item.id ? 'var(--primary-light)' : 'transparent',
                  border: activeView === item.id ? '1px solid rgba(99, 102, 241, 0.1)' : 'none',
                  color: activeView === item.id ? 'var(--primary)' : 'var(--text-sec)',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: activeView === item.id ? 700 : 600,
                  transition: 'all 0.2s'
                }}
              >
                <item.icon size={20} />
                <span>{item.label}</span>
              </button>
            )}
          </div>
        ))}
      </nav>

      {/* Sección de Usuario Footer UI */}
      <div style={{ padding: '16px', marginTop: 'auto', borderTop: '1px solid var(--border-color)' }}>
        <div
          className="glass-card"
          onClick={() => setActiveView('perfil')}
          style={{
            padding: '12px',
            borderRadius: '16px',
            background: activeView === 'perfil' ? 'rgba(255,190,0,0.1)' : 'rgba(255,190,0,0.03)',
            border: activeView === 'perfil' ? '1px solid rgba(255,190,0,0.3)' : '1px solid rgba(255,190,0,0.1)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          <div style={{
            width: 40,
            height: 40,
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #FFBD00, #FF0058)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 800,
            fontSize: '1.1rem'
          }}>
            {session.user.user_metadata?.nombre_completo?.[0] || 'A'}
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--text-main)', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
              {session.user.user_metadata?.nombre_completo || 'Usuario'}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-sec)', fontWeight: 600 }}>Plan Contador</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={e => e.stopPropagation()}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                supabase.auth.signOut();
              }}
              style={{
                padding: '6px',
                background: 'transparent',
                border: 'none',
                color: 'var(--error)',
                cursor: 'pointer',
                opacity: 0.7,
                transition: 'opacity 0.2s'
              }}
              title="Cerrar Sesión"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
