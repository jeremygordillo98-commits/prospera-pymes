import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { MessageCircle, X, Send, Loader2, ArrowRight } from 'lucide-react';
import { supabase } from '../services/supabase';
import { soundService } from '../utils/soundService';

interface Mensaje {
  id: string;
  usuario_id: string;
  mensaje: string;
  origen: 'usuario' | 'admin';
  estado: string;
  created_at: string;
}

interface LiveAlert {
  id: string;
  title: string;
  body: string;
  time: string;
}

export const SoporteChat = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const [chatHistory, setChatHistory] = useState<Mensaje[]>([]);
  const [inputMsg, setInputMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [rlsError, setRlsError] = useState(false);
  const [liveAlert, setLiveAlert] = useState<LiveAlert | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
  }, []);

  useEffect(() => {
    if (!userId) return;
    fetchHistory(userId);
    const channel = supabase
      .channel(`pymes_chat_${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'soporte_tickets' }, (payload) => {
        const nuevo = payload.new as Mensaje;
        if (nuevo.usuario_id !== userId) return;
        setChatHistory(prev => prev.some(m => m.id === nuevo.id) ? prev : [...prev, nuevo]);
        
        if (nuevo.origen === 'admin') {
          // 1. Reproducir tono sintetizado de audio y vibración
          soundService.playNotification('ticket');
          
          // 2. Si el chat está cerrado, activar alerta flotante y badge
          if (!isOpen) {
            setHasUnread(true);
            setLiveAlert({
              id: nuevo.id,
              title: '📨 Respuesta de Soporte Prospera',
              body: nuevo.mensaje.length > 90 ? nuevo.mensaje.substring(0, 90) + '...' : nuevo.mensaje,
              time: new Date().toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })
            });
          }
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, isOpen]);

  // Auto-descartar alerta flotante tras 8 segundos
  useEffect(() => {
    if (!liveAlert) return;
    const timer = setTimeout(() => setLiveAlert(null), 8000);
    return () => clearTimeout(timer);
  }, [liveAlert]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      setHasUnread(false);
      setLiveAlert(null);
    }
  }, [chatHistory, isOpen]);

  const fetchHistory = async (uid: string) => {
    const { data, error } = await supabase.from('soporte_tickets').select('*').eq('usuario_id', uid).order('created_at', { ascending: true });
    if (error) { console.error('SoporteChat SELECT:', error.message); return; }
    if (data) { setChatHistory(data as Mensaje[]); }
  };

  const handleSend = async () => {
    if (!inputMsg.trim() || !userId || sending) return;
    setSending(true); setRlsError(false);
    const texto = inputMsg.trim(); setInputMsg('');
    const { error } = await supabase.from('soporte_tickets').insert({ usuario_id: userId, mensaje: texto, origen: 'usuario', estado: 'abierto' });
    if (error) {
      console.error('SoporteChat INSERT:', error.message, error.code);
      setInputMsg(texto);
      if (error.code === '42501' || error.message.includes('policy')) setRlsError(true);
    }
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } };

  const handleOpenChatFromAlert = () => {
    setIsOpen(true);
    setHasUnread(false);
    setLiveAlert(null);
  };

  const btnBase: React.CSSProperties = { border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };

  return (
    <>
      {/* BANNER FLOTANTE INTERACTIVO DE SOPORTE (PORTAL) */}
      {liveAlert && typeof document !== 'undefined' && createPortal(
        <div 
          onClick={handleOpenChatFromAlert}
          style={{
            position: 'fixed',
            top: 20,
            right: 20,
            zIndex: 99999,
            maxWidth: 380,
            width: 'calc(100% - 40px)',
            background: 'var(--nav-bg)',
            backdropFilter: 'blur(30px)',
            WebkitBackdropFilter: 'blur(30px)',
            border: '1px solid var(--primary)',
            borderRadius: 20,
            padding: '14px 16px',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.35), 0 0 20px var(--primary-light)',
            cursor: 'pointer',
            animation: 'alertSlideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: 'linear-gradient(135deg, var(--primary) 0%, #0EA5E9 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.2rem',
            flexShrink: 0,
            boxShadow: '0 4px 12px var(--primary-light)',
          }}>
            💬
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--primary)' }}>
                {liveAlert.title}
              </span>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-sec)' }}>
                {liveAlert.time}
              </span>
            </div>
            <p style={{
              margin: 0,
              fontSize: '0.78rem',
              color: 'var(--text-main)',
              lineHeight: 1.4,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {liveAlert.body}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleOpenChatFromAlert();
              }}
              style={{
                background: 'var(--primary)',
                color: '#000',
                border: 'none',
                borderRadius: 10,
                padding: '6px 10px',
                fontSize: '0.72rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              Ver <ArrowRight size={12} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setLiveAlert(null);
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-sec)',
                cursor: 'pointer',
                padding: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={14} />
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* BOTÓN DE CHAT EN CABECERA */}
      <button 
        onClick={() => { setIsOpen(!isOpen); setHasUnread(false); setLiveAlert(null); }} 
        style={{ 
          ...btnBase, 
          position: 'relative', 
          background: hasUnread ? 'var(--primary-light)' : 'transparent', 
          border: hasUnread ? '1px solid var(--primary)' : '1px solid var(--border-color)', 
          borderRadius: 12,
          padding: '8px 10px', 
          color: hasUnread ? 'var(--primary)' : 'var(--text-main)',
          transition: 'all 0.2s',
          width: 38,
          height: 38,
        }} 
        onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-light)'}
        onMouseLeave={e => e.currentTarget.style.background = hasUnread ? 'var(--primary-light)' : 'transparent'}
        title="Soporte y Ayuda"
      >
        <MessageCircle size={18} />
        {hasUnread && (
          <span style={{ 
            position: 'absolute', 
            top: -3, 
            right: -3, 
            width: 10, 
            height: 10, 
            borderRadius: '50%', 
            background: 'var(--primary)', 
            border: '2px solid var(--bg-color)', 
            animation: 'chatPulse 2s infinite' 
          }} />
        )}
      </button>

      {/* MODAL DE CHAT */}
      {isOpen && (
        <div style={{ 
          position: 'fixed', 
          bottom: 24, 
          right: 24, 
          width: 360, 
          maxHeight: '80vh', 
          display: 'flex', 
          flexDirection: 'column', 
          background: 'var(--nav-bg)', 
          backdropFilter: 'blur(40px)', 
          WebkitBackdropFilter: 'blur(40px)', 
          borderRadius: 24, 
          border: '1px solid var(--border-color)', 
          boxShadow: '0 24px 60px rgba(0,0,0,0.35)', 
          zIndex: 9999, 
          overflow: 'hidden', 
          animation: 'chatSlideUp 0.4s cubic-bezier(0.16,1,0.3,1)' 
        }}>

          <div style={{ padding: '16px 20px', background: 'linear-gradient(135deg, var(--primary) 0%, #0EA5E9 100%)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 12, background: 'rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🧑‍💼</div>
              <div>
                <div style={{ fontWeight: 900, color: '#000', fontSize: '0.95rem' }}>Soporte Prospera Pymes</div>
                <div style={{ fontSize: '0.72rem', color: 'rgba(0,0,0,0.65)', fontWeight: 600 }}>Equipo disponible · Respuesta en minutos</div>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} style={{ background: 'rgba(0,0,0,0.1)', border: 'none', cursor: 'pointer', width: 28, height: 28, borderRadius: '50%', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.2)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0.1)'}>
              <X size={16} strokeWidth={2.5} />
            </button>
          </div>

          <div style={{ padding: '8px 16px', background: 'var(--card-bg)', borderBottom: '1px solid var(--border-color)', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-sec)' }}>
            Al usar el soporte, aceptas nuestros{' '}
            <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', fontWeight: 700, textDecoration: 'none' }} onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'} onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}>
              Términos y Condiciones
            </a>.
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--bg-color)' }}>
            {rlsError && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12, padding: '12px 14px', fontSize: '0.82rem', color: 'var(--error)', textAlign: 'center', lineHeight: 1.6 }}>
                ⚠️ <strong>Permisos de base de datos pendientes.</strong><br />
                Ejecuta el SQL de políticas RLS en Supabase Pymes.
              </div>
            )}
            {chatHistory.length === 0 && !rlsError && (
              <div style={{ textAlign: 'center', color: 'var(--text-sec)', padding: '32px 16px', fontSize: '0.88rem', lineHeight: 1.6 }}>
                👋 <strong>¡Hola!</strong><br />Escribe tu consulta y nuestro equipo te responderá en breve.
              </div>
            )}
            {chatHistory.map(m => (
              <div key={m.id} style={{ alignSelf: m.origen === 'usuario' ? 'flex-end' : 'flex-start', background: m.origen === 'usuario' ? 'var(--primary)' : 'var(--card-bg)', color: m.origen === 'usuario' ? '#000' : 'var(--text-main)', padding: '10px 14px', borderRadius: m.origen === 'usuario' ? '18px 18px 4px 18px' : '18px 18px 18px 4px', maxWidth: '82%', fontSize: '0.875rem', lineHeight: 1.5, border: m.origen === 'admin' ? '1px solid var(--border-color)' : 'none' }}>
                {m.mensaje}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: 10, background: 'var(--nav-bg)' }}>
            <input type="text" value={inputMsg} onChange={e => setInputMsg(e.target.value)} onKeyDown={handleKeyDown} placeholder="Escribe tu consulta..." style={{ flex: 1, padding: '10px 14px', borderRadius: 14, border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-main)', fontSize: '0.875rem', outline: 'none' }} />
            <button onClick={handleSend} disabled={sending || !inputMsg.trim()} style={{ ...btnBase, width: 42, height: 42, borderRadius: 14, background: inputMsg.trim() ? 'var(--primary)' : 'var(--input-bg)', flexShrink: 0, cursor: inputMsg.trim() ? 'pointer' : 'default' }}>
              {sending ? <Loader2 size={16} color="#000" className="animate-spin" /> : <Send size={16} color={inputMsg.trim() ? '#000' : 'var(--text-sec)'} />}
            </button>
          </div>
        </div>
      )}
      <style>{`
        @keyframes chatSlideUp { from { opacity:0; transform:translateY(20px) scale(0.96); } to { opacity:1; transform:translateY(0) scale(1); } }
        @keyframes alertSlideIn { from { opacity:0; transform:translateY(-20px) scale(0.95); } to { opacity:1; transform:translateY(0) scale(1); } }
        @keyframes chatPulse { 0% { box-shadow:0 0 0 0 rgba(0,214,143,0.7); } 70% { box-shadow:0 0 0 8px rgba(0,214,143,0); } 100% { box-shadow:0 0 0 0 rgba(0,214,143,0); } }
      `}</style>
    </>
  );
};

