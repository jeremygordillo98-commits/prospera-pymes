import { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, Loader2 } from 'lucide-react';
import { supabase } from '../services/supabase';

interface Mensaje {
  id: string;
  usuario_id: string;
  mensaje: string;
  origen: 'usuario' | 'admin';
  estado: string;
  created_at: string;
}

export const SoporteChat = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const [chatHistory, setChatHistory] = useState<Mensaje[]>([]);
  const [inputMsg, setInputMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [rlsError, setRlsError] = useState(false);
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
        if (nuevo.origen === 'admin' && !isOpen) setHasUnread(true);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, isOpen]);

  useEffect(() => {
    if (isOpen) { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); setHasUnread(false); }
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

  const btnBase: React.CSSProperties = { border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };

  return (
    <>
      <button 
        onClick={() => { setIsOpen(!isOpen); setHasUnread(false); }} 
        style={{ 
          ...btnBase, 
          position: 'relative', 
          background: 'transparent',
          border: '1px solid var(--border-color)', 
          borderRadius: 12,
          padding: '8px 10px', 
          color: 'var(--text-main)',
          transition: 'all 0.2s',
          width: 38,
          height: 38,
        }} 
        onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-light)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
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
        @keyframes chatPulse { 0% { box-shadow:0 0 0 0 rgba(239,68,68,0.5); } 70% { box-shadow:0 0 0 8px rgba(239,68,68,0); } 100% { box-shadow:0 0 0 0 rgba(239,68,68,0); } }
      `}</style>
    </>
  );
};
