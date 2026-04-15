import React, { useState } from 'react';
import { supabase } from '../services/supabase';
import { Lock, Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react';

interface UpdatePasswordProps {
  onSuccess: () => void;
}

export const UpdatePassword: React.FC<UpdatePasswordProps> = ({ onSuccess }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword)
      return setMessage({ type: 'error', text: 'Las contraseñas no coinciden.' });
    if (password.length < 6)
      return setMessage({ type: 'error', text: 'La contraseña debe tener al menos 6 caracteres.' });

    setLoading(true);
    setMessage(null);

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setMessage({ type: 'error', text: error.message });
    } else {
      setMessage({ type: 'success', text: '¡Contraseña actualizada con éxito! Iniciando sesión...' });
      setTimeout(() => {
        onSuccess();
      }, 1500);
    }
    setLoading(false);
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 12px 12px 42px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid var(--border-color)',
    borderRadius: '12px',
    color: 'white',
    outline: 'none',
    fontSize: '0.9rem',
    transition: 'all 0.3s ease',
  };

  return (
    <div
      className="flex-center"
      style={{ minHeight: '100vh', padding: '20px', background: '#0b1120' }}
      data-theme="dark"
    >
      <div className="aurora-bg" style={{ background: '#0b1120' }}>
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>
      </div>

      <div
        className="glass-card"
        style={{
          width: '100%',
          maxWidth: '420px',
          padding: '40px',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div
            style={{
              width: 56,
              height: 56,
              background: 'var(--primary)',
              borderRadius: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              margin: '0 auto 16px',
            }}
          >
            <ShieldCheck size={28} />
          </div>
          <h1 className="h1" style={{ fontSize: '1.75rem', marginBottom: '8px' }}>
            Nueva Contraseña
          </h1>
          <p className="text-sec">Crea una contraseña segura para tu cuenta</p>
        </div>

        {/* Mensaje de error o éxito */}
        {message && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '12px',
              marginBottom: '20px',
              textAlign: 'center',
              background:
                message.type === 'error'
                  ? 'rgba(239, 68, 68, 0.1)'
                  : 'rgba(16, 185, 129, 0.1)',
              color: message.type === 'error' ? 'var(--error)' : 'var(--success)',
              border: `1px solid ${
                message.type === 'error'
                  ? 'rgba(239,68,68,0.3)'
                  : 'rgba(16,185,129,0.3)'
              }`,
              fontWeight: 600,
              fontSize: '0.9rem',
            }}
          >
            {message.text}
          </div>
        )}

        <form
          onSubmit={handleUpdate}
          style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}
        >
          {/* Campo nueva contraseña */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.8rem',
                fontWeight: 600,
                marginBottom: '6px',
                color: 'var(--text-sec)',
              }}
            >
              Nueva Contraseña
            </label>
            <div style={{ position: 'relative', width: '100%' }}>
              <Lock
                size={16}
                style={{
                  position: 'absolute',
                  left: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-sec)',
                  opacity: 0.7,
                }}
              />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Mínimo 6 caracteres"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ ...inputStyle, paddingRight: '42px' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-sec)',
                  cursor: 'pointer',
                  padding: 0,
                  opacity: 0.7,
                }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Campo confirmar contraseña */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.8rem',
                fontWeight: 600,
                marginBottom: '6px',
                color: 'var(--text-sec)',
              }}
            >
              Confirmar Contraseña
            </label>
            <div style={{ position: 'relative', width: '100%' }}>
              <Lock
                size={16}
                style={{
                  position: 'absolute',
                  left: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-sec)',
                  opacity: 0.7,
                }}
              />
              <input
                type="password"
                placeholder="Repite la contraseña"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          <button
            className="btn btn-primary"
            type="submit"
            disabled={loading}
            style={{
              padding: '14px',
              width: '100%',
              justifyContent: 'center',
              marginTop: '10px',
              boxShadow: '0 8px 16px rgba(99, 102, 241, 0.2)',
            }}
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <>
                <ShieldCheck size={18} /> Guardar Nueva Contraseña
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
