import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, AlertTriangle, Info, Ban } from 'lucide-react';

interface CustomModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  type?: 'info' | 'success' | 'warning' | 'error' | 'confirm' | 'prompt';
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  inputValue?: string;
  onInputChange?: (val: string) => void;
  inputPlaceholder?: string;
  children?: React.ReactNode;
}

export const CustomModal: React.FC<CustomModalProps> = ({
  isOpen,
  onClose,
  title,
  type = 'info',
  message,
  confirmLabel = 'Aceptar',
  cancelLabel = 'Cancelar',
  onConfirm,
  inputValue,
  onInputChange,
  inputPlaceholder,
  children
}) => {
  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle2 size={24} style={{ color: '#10b981' }} />;
      case 'warning':
        return <AlertTriangle size={24} style={{ color: '#f59e0b' }} />;
      case 'error':
      case 'confirm':
      case 'prompt':
        return <Ban size={24} style={{ color: '#ef4444' }} />;
      default:
        return <Info size={24} style={{ color: '#3b82f6' }} />;
    }
  };

  const getHeaderColor = () => {
    switch (type) {
      case 'success':
        return '#10b981';
      case 'warning':
        return '#f59e0b';
      case 'error':
      case 'confirm':
      case 'prompt':
        return '#ef4444';
      default:
        return 'var(--primary)';
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="modal-overlay" style={{
          position: 'fixed',
          inset: 0,
          zIndex: 100000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(5, 8, 16, 0.85)',
          backdropFilter: 'blur(12px)',
          padding: '20px',
          boxSizing: 'border-box'
        }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="glass-card"
            style={{
              padding: '32px',
              width: '90%',
              maxWidth: '500px',
              background: 'rgba(15, 23, 42, 0.95)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '24px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              boxSizing: 'border-box'
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: getHeaderColor() }}>
                {getIcon()}
                <h3 className="h1" style={{ fontSize: '1.3rem', margin: 0, fontWeight: 800 }}>
                  {title}
                </h3>
              </div>
              <button 
                onClick={onClose} 
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  color: 'var(--text-sec)', 
                  cursor: 'pointer', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  padding: '4px',
                  borderRadius: '50%',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                <X size={18} />
              </button>
            </div>

            {/* Message/Content */}
            <div style={{ marginBottom: '24px' }}>
              {message && (
                <p style={{ fontSize: '0.95rem', lineHeight: '1.6', color: 'var(--text-sec)', margin: '0 0 16px 0', whiteSpace: 'pre-line' }}>
                  {message}
                </p>
              )}

              {type === 'prompt' && onInputChange && (
                <input
                  type="text"
                  placeholder={inputPlaceholder || "Escribe aquí..."}
                  value={inputValue || ''}
                  onChange={(e) => onInputChange(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    border: '1px solid var(--border-color)',
                    background: 'rgba(255,255,255,0.05)',
                    color: 'var(--text-main)',
                    fontSize: '0.95rem',
                    boxSizing: 'border-box',
                    outline: 'none'
                  }}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && onConfirm) {
                      onConfirm();
                    }
                  }}
                />
              )}

              {children}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              {(type === 'confirm' || type === 'prompt') ? (
                <>
                  <button
                    onClick={onClose}
                    className="btn glass-card"
                    style={{ padding: '10px 20px', border: '1px solid var(--border-color)' }}
                  >
                    {cancelLabel}
                  </button>
                  <button
                    onClick={onConfirm}
                    className="btn btn-primary"
                    style={{ 
                      padding: '10px 24px', 
                      background: type === 'prompt' || type === 'confirm' ? 'linear-gradient(135deg, var(--error), #ef4444)' : 'var(--primary)' 
                    }}
                  >
                    {confirmLabel}
                  </button>
                </>
              ) : (
                <button
                  onClick={onClose}
                  className="btn btn-primary"
                  style={{ padding: '10px 24px' }}
                >
                  {confirmLabel}
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
