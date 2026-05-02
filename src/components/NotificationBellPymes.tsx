import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell } from 'lucide-react';
import { supabase } from '../services/supabase';

interface Notif {
  id: string;
  user_id: string;
  title: string;
  content: string;
  type: 'info' | 'success' | 'warning' | 'error';
  is_read: boolean;
  created_at: string;
}

const TYPE_COLOR: Record<string, string> = {
  info: '#0EA5E9',
  success: '#00956A',
  warning: '#F59E0B',
  error: '#ef4444',
};

export const NotificationBellPymes = () => {
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
  }, []);

  useEffect(() => {
    if (!userId) return;
    fetchNotifs();
    const channel = supabase
      .channel(`notifs_pymes_${userId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'user_notifications',
        filter: `user_id=eq.${userId}`,
      }, () => fetchNotifs())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  const fetchNotifs = async () => {
    if (!userId) return;
    const { data } = await supabase
      .from('user_notifications')
      .select('*')
      .eq('user_id', userId)
      .eq('is_read', false)
      .order('created_at', { ascending: false });
    if (data) setNotifs(data as Notif[]);
  };

  const markAsRead = async (id: string) => {
    await supabase.from('user_notifications').update({ is_read: true }).eq('id', id);
    setNotifs(prev => prev.filter(n => n.id !== id));
  };

  const markAllRead = async () => {
    await supabase.from('user_notifications').update({ is_read: true }).eq('user_id', userId!).eq('is_read', false);
    setNotifs([]);
  };

  if (!userId) return null;

  return (
    <>
      {/* Botón campana */}
      <button
        onClick={() => setIsOpen(true)}
        title="Notificaciones"
        style={{
          position: 'relative', background: 'transparent',
          border: '1px solid var(--border-color)', borderRadius: 12,
          padding: '8px 10px', cursor: 'pointer', color: 'var(--text-main)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.2s',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-light)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        <Bell size={18} />
        {notifs.length > 0 && (
          <span style={{
            position: 'absolute', top: -5, right: -5,
            background: '#ef4444', color: '#fff',
            fontSize: '0.6rem', fontWeight: 900,
            width: 18, height: 18, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid var(--bg-color)',
            animation: 'notifPulse 2s infinite',
          }}>
            {notifs.length}
          </span>
        )}
      </button>

      {/* Modal */}
      {isOpen && createPortal(
        <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 20, animation: 'fadeIn 0.2s ease' }}>
          {/* Overlay */}
          <div onClick={() => setIsOpen(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', cursor: 'zoom-out' }} />

          {/* Panel */}
          <div style={{
            position: 'relative', width: '100%', maxWidth: 460,
            background: 'var(--nav-bg)', borderRadius: 28,
            border: '1px solid var(--border-color)',
            boxShadow: '0 40px 80px rgba(0,0,0,0.5)',
            overflow: 'hidden', maxHeight: '85vh',
            display: 'flex', flexDirection: 'column',
            animation: 'notifSlideUp 0.35s cubic-bezier(0.16,1,0.3,1)',
          }}>
            {/* Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, background: 'var(--primary)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>📫</div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 900, color: 'var(--text-main)' }}>Notificaciones</h3>
                  <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-sec)' }}>{notifs.length} sin leer</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {notifs.length > 0 && (
                  <button onClick={markAllRead} style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--primary)', background: 'var(--primary-light)', border: 'none', borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}>
                    Leer todo
                  </button>
                )}
                <button onClick={() => setIsOpen(false)} style={{ background: 'var(--input-bg)', border: 'none', cursor: 'pointer', width: 36, height: 36, borderRadius: '50%', color: 'var(--text-main)', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
              </div>
            </div>

            {/* Lista */}
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {notifs.length === 0 ? (
                <div style={{ padding: '60px 40px', textAlign: 'center' }}>
                  <div style={{ fontSize: '3rem', marginBottom: 12 }}>✨</div>
                  <h4 style={{ color: 'var(--text-main)', margin: '0 0 8px' }}>¡Estás al día!</h4>
                  <p style={{ color: 'var(--text-sec)', margin: 0, fontSize: '0.85rem' }}>No tienes notificaciones pendientes.</p>
                </div>
              ) : notifs.map(n => (
                <div
                  key={n.id}
                  onClick={() => markAsRead(n.id)}
                  style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-color)', cursor: 'pointer', display: 'flex', gap: 16, transition: 'background 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--card-bg)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: TYPE_COLOR[n.type] || '#0EA5E9', marginTop: 6, flexShrink: 0, boxShadow: `0 0 8px ${TYPE_COLOR[n.type] || '#0EA5E9'}60` }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-main)', marginBottom: 4 }}>{n.title}</div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-sec)', lineHeight: 1.5 }}>{n.content}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-sec)', opacity: 0.6, marginTop: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {new Date(n.created_at).toLocaleString('es-EC', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <span style={{ fontSize: '0.65rem', fontWeight: 900, color: 'var(--primary)', alignSelf: 'flex-start', marginTop: 2 }}>✓ Marcar</span>
                </div>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}

      <style>{`
        @keyframes notifSlideUp { from { opacity:0; transform:translateY(24px) scale(0.96); } to { opacity:1; transform:translateY(0) scale(1); } }
        @keyframes notifPulse { 0%,100% { box-shadow:0 0 0 0 rgba(239,68,68,0.4); } 50% { box-shadow:0 0 0 5px rgba(239,68,68,0); } }
      `}</style>
    </>
  );
};
