import { useState, useEffect } from 'react';
import {
  Building2,
  LogOut
} from 'lucide-react';
import { supabase } from '../services/supabase';
import { MENU_STRUCTURE } from '../constants/menu';
import { SoporteChat } from './SoporteChat';
import { NotificationBellPymes } from './NotificationBellPymes';

interface SidebarProps {
  activeView: string;
  setActiveView: (view: string) => void;
  selectedEmpresa: any;
  setSelectedEmpresa: (emp: any) => void;
  empresas: any[];
  session: any;
}

export const Sidebar = ({
  activeView,
  setActiveView,
  selectedEmpresa,
  setSelectedEmpresa,
  empresas,
  session,
}: SidebarProps) => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const activeParent = MENU_STRUCTURE.find(item => 
    item.id === activeView || (item.children && item.children.some(child => child.id === activeView))
  ) || MENU_STRUCTURE[0];

  const handleParentClick = (item: any) => {
    if (item.children && item.children.length > 0) {
      setActiveView(item.children[0].id);
    } else {
      setActiveView(item.id);
    }
  };

  if (!isMobile) {
    return (
      <aside className="sidebar custom-scrollbar" style={{ overflow: 'visible', padding: '0 24px', borderBottom: '1px solid var(--border-color)' }}>
        {/* ROW 1: BRAND, COMPANY SELECTOR, MAIN NAVIGATION, USER & LOGOUT */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', minHeight: '72px', gap: '20px' }}>
          
          {/* Brand Logo & Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
            }}>
              <img src="/logo-pymes.png" alt="Prospera Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 800, letterSpacing: '-0.5px', margin: 0 }}>Prospera</h2>
              <div style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>Pymes</div>
            </div>
          </div>

          {/* Main Navigation (Horizontal list of parent tabs) */}
          <nav style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px', overflowX: 'auto', scrollbarWidth: 'none' }}>
            {MENU_STRUCTURE.map((item) => {
              const isSelected = activeParent.id === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleParentClick(item)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '6px 10px',
                    borderRadius: '8px',
                    background: isSelected ? 'var(--primary-light)' : 'transparent',
                    border: isSelected ? '1px solid rgba(0, 214, 143, 0.15)' : 'none',
                    color: isSelected ? 'var(--primary)' : 'var(--text-sec)',
                    cursor: 'pointer',
                    fontSize: '0.76rem',
                    fontWeight: isSelected ? 700 : 600,
                    transition: 'all 0.2s',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <item.icon size={14} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* User Profile Info & Company Selector (Combined on the right) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
            {/* Support and Notifications buttons inline */}
            <SoporteChat />
            <NotificationBellPymes />

            {/* Avatar badge linking to profile */}
            <div
              onClick={() => setActiveView('perfil')}
              style={{
                width: 36,
                height: 36,
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #FFBD00, #FF0058)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontWeight: 800,
                fontSize: '1rem',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(255, 189, 0, 0.2)'
              }}
              title="Mi Perfil"
            >
              {session.user.user_metadata?.nombre_completo?.[0] || 'A'}
            </div>

            {/* Profile Name & Company Selector Dropdown */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <div 
                onClick={() => setActiveView('perfil')}
                style={{ 
                  fontWeight: 800, 
                  fontSize: '0.85rem', 
                  color: 'var(--text-main)', 
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                {session.user.user_metadata?.nombre_completo || 'Alexander Cordova'}
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Building2 size={12} style={{ color: 'var(--primary)', opacity: 0.8 }} />
                <select
                  value={selectedEmpresa?.id || ''}
                  onChange={(e) => setSelectedEmpresa(empresas.find(emp => emp.id === e.target.value) || null)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-sec)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    outline: 'none',
                    cursor: 'pointer',
                    padding: '0 12px 0 0',
                    margin: 0,
                    maxWidth: '150px',
                    textOverflow: 'ellipsis'
                  }}
                >
                  {empresas.map(emp => (
                    <option key={emp.id} value={emp.id} style={{ background: 'var(--bg-color)', color: 'var(--text-main)' }}>{emp.nombre_empresa}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Logout button */}
            <button
              onClick={() => supabase.auth.signOut()}
              style={{
                padding: '8px',
                background: 'transparent',
                border: 'none',
                color: 'var(--error)',
                cursor: 'pointer',
                opacity: 0.7,
                transition: 'opacity 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="Cerrar Sesión"
            >
              <LogOut size={18} />
            </button>
          </div>

        </div>

        {/* ROW 2: SUB-NAVIGATION (Only if parent has children) */}
        {activeParent.children && activeParent.children.length > 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            padding: '10px 0 12px 0',
            borderTop: '1px solid var(--border-color)',
            background: 'var(--submenu-bg)',
            gap: '8px',
            overflowX: 'auto',
            scrollbarWidth: 'none'
          }}>
            {activeParent.children.map((child) => {
              const isChildActive = activeView === child.id;
              return (
                <button
                  key={child.id}
                  onClick={() => setActiveView(child.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    background: isChildActive ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
                    border: isChildActive ? '1px solid var(--border-color)' : 'none',
                    color: isChildActive ? 'var(--primary)' : 'var(--text-sec)',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    fontWeight: isChildActive ? 700 : 500,
                    transition: 'all 0.2s',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <child.icon size={14} />
                  <span>{child.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </aside>
    );
  }

  // Mobile/Tablet layout
  return (
    <aside className="sidebar custom-scrollbar" style={{ overflow: 'visible', borderBottom: '1px solid var(--border-color)' }}>
      {/* ROW 1: BRAND & USER PROFILE */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
          }}>
            <img src="/logo-pymes.png" alt="Prospera Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div>
            <h2 style={{ fontSize: '1rem', fontWeight: 800, letterSpacing: '-0.5px', margin: 0 }}>Prospera</h2>
            <div style={{ fontSize: '0.65rem', color: 'var(--primary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>Pymes</div>
          </div>
        </div>

        {/* User profile avatar & logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <SoporteChat />
          <NotificationBellPymes />
          <div
            onClick={() => setActiveView('perfil')}
            style={{
              width: 32,
              height: 32,
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #FFBD00, #FF0058)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontWeight: 800,
              fontSize: '0.9rem',
              cursor: 'pointer'
            }}
          >
            {session.user.user_metadata?.nombre_completo?.[0] || 'A'}
          </div>
          <button
            onClick={() => supabase.auth.signOut()}
            style={{
              padding: '6px',
              background: 'transparent',
              border: 'none',
              color: 'var(--error)',
              cursor: 'pointer',
              opacity: 0.7
            }}
            title="Cerrar Sesión"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>

      {/* ROW 2: CLIENT SELECTOR (Full Width on Mobile) */}
      <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{
          padding: '6px 12px',
          border: '1px solid var(--border-color)',
          borderRadius: '10px',
          background: 'rgba(255,255,255,0.02)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <Building2 size={14} style={{ color: 'var(--text-sec)', opacity: 0.6 }} />
          <select
            value={selectedEmpresa?.id || ''}
            onChange={(e) => setSelectedEmpresa(empresas.find(emp => emp.id === e.target.value) || null)}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              color: 'var(--text-main)',
              fontSize: '0.8rem',
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
      </div>

      {/* ROW 3: SCROLLABLE MAIN CATEGORIES */}
      <nav style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '8px 12px', overflowX: 'auto', scrollbarWidth: 'none' }}>
        {MENU_STRUCTURE.map((item) => {
          const isSelected = activeParent.id === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleParentClick(item)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '8px',
                background: isSelected ? 'var(--primary-light)' : 'transparent',
                border: isSelected ? '1px solid rgba(0, 214, 143, 0.15)' : 'none',
                color: isSelected ? 'var(--primary)' : 'var(--text-sec)',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: isSelected ? 700 : 600,
                transition: 'all 0.2s',
                whiteSpace: 'nowrap'
              }}
            >
              <item.icon size={14} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* ROW 4: SCROLLABLE SUB-NAVIGATION (if parent has children) */}
      {activeParent.children && activeParent.children.length > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          padding: '6px 12px 10px 12px',
          borderTop: '1px solid var(--border-color)',
          background: 'var(--submenu-bg)',
          gap: '6px',
          overflowX: 'auto',
          scrollbarWidth: 'none'
        }}>
          {activeParent.children.map((child) => {
            const isChildActive = activeView === child.id;
            return (
              <button
                key={child.id}
                onClick={() => setActiveView(child.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '5px 10px',
                  borderRadius: '6px',
                  background: isChildActive ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
                  border: isChildActive ? '1px solid var(--border-color)' : 'none',
                  color: isChildActive ? 'var(--primary)' : 'var(--text-sec)',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  fontWeight: isChildActive ? 700 : 500,
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap'
                }}
              >
                <child.icon size={12} />
                <span>{child.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </aside>
  );
};
