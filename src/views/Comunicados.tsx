import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useComunicados } from '../hooks/useComunicados';
import { ComunicadoHistorial } from '../components/ComunicadoHistorial';
import { ComunicadoWorkspace } from '../components/ComunicadoWorkspace';

interface ComunicadosProps {
  empresaId: string;
  permisoComunicacionCliente: boolean;
}

export const Comunicados: React.FC<ComunicadosProps> = ({ empresaId, permisoComunicacionCliente }) => {
  const {
    fileInputRef,
    isWorkspaceOpen,
    setIsWorkspaceOpen,
    activePreset,
    setActivePreset,
    filesList,
    previewHtml,
    sending,
    sendingProgress,
    selectedCampanaRecipients,
    setSelectedCampanaRecipients,
    customAlert,
    setCustomAlert,
    form,
    setForm,
    listado,
    loadingList,
    handleFileChange,
    removeFile,
    resetForm,
    handleSend,
    handleCancelScheduled,
    handleEditScheduled,
    deleteRecord,
    loadDraft,
    sizeLimitExceeded,
    totalAttachmentsSize
  } = useComunicados(empresaId);

  if (!permisoComunicacionCliente) {
    return (
      <div style={{
        minHeight: '70vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 24,
        background: 'rgba(15, 23, 42, 0.4)',
        border: '1px solid var(--border-color)',
        padding: 40,
        textAlign: 'center',
        marginTop: 20
      }}>
        {/* Decorative background orbs to look extremely premium */}
        <div style={{
          position: 'absolute',
          width: 250,
          height: 250,
          background: 'radial-gradient(circle, var(--primary) 0%, transparent 70%)',
          opacity: 0.15,
          top: '10%',
          left: '10%',
          filter: 'blur(40px)',
          zIndex: 1
        }} />
        <div style={{
          position: 'absolute',
          width: 300,
          height: 300,
          background: 'radial-gradient(circle, #0ea5e9 0%, transparent 70%)',
          opacity: 0.15,
          bottom: '10%',
          right: '10%',
          filter: 'blur(50px)',
          zIndex: 1
        }} />

        <div style={{
          position: 'relative',
          zIndex: 2,
          maxWidth: 480,
          padding: '40px 32px',
          background: 'var(--card-bg)',
          borderRadius: 24,
          border: '1px solid var(--border-strong)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.3)',
          backdropFilter: 'blur(30px)',
          animation: 'fadeIn 0.6s ease'
        }}>
          <div style={{
            width: 72,
            height: 72,
            borderRadius: 24,
            background: 'var(--primary-light)',
            color: 'var(--primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px',
            boxShadow: '0 8px 24px rgba(0, 214, 143, 0.2)'
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 17a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9.5C2 7 4 5 6.5 5H18c2.5 0 4 2 4 4.5V17z" /><path d="M22 9.5l-8.5 5.5c-.9.6-2.1.6-3 0L2 9.5" /></svg>
          </div>

          <h2 className="h1" style={{ fontSize: '1.8rem', fontWeight: 900, marginBottom: 12, letterSpacing: '-0.5px' }}>
            Mailer Pymes B2B
          </h2>
          <p className="text-sec" style={{ fontSize: '1rem', lineHeight: 1.6, marginBottom: 28 }}>
            Habilita la comunicación premium y envío de notificaciones automáticas/manuales de balances y reportes directo al correo de tus clientes de manera masiva.
          </p>

          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 18px',
            borderRadius: 14,
            background: 'rgba(255, 190, 0, 0.1)',
            color: '#F59E0B',
            fontWeight: 800,
            fontSize: '0.85rem',
            marginBottom: 32,
            border: '1px solid rgba(255, 190, 0, 0.2)'
          }}>
            <span>🔒 Módulo Premium Requerido</span>
          </div>

          <p style={{ fontSize: '0.82rem', color: 'var(--text-sec)', margin: 0 }}>
            Para activar esta función en tu cuenta, solicita a tu administrador de Prospera la licencia correspondiente.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: '100px' }}>
      
      {/* ─── LIST VIEW (Standard Dashboard) ─── */}
      {!isWorkspaceOpen && (
        <ComunicadoHistorial
          listado={listado}
          loadingList={loadingList}
          setIsWorkspaceOpen={setIsWorkspaceOpen}
          resetForm={resetForm}
          loadDraft={loadDraft}
          handleEditScheduled={handleEditScheduled}
          handleCancelScheduled={handleCancelScheduled}
          setSelectedCampanaRecipients={setSelectedCampanaRecipients}
          deleteRecord={deleteRecord}
        />
      )}

      {/* ─── FULL VIEW WORKSPACE (Side-by-Side Editor & Live Preview) ─── */}
      <AnimatePresence>
        {isWorkspaceOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 15 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: 15 }}
            style={{ 
              position: 'fixed', 
              inset: 0, 
              zIndex: 99999999, 
              display: 'flex', 
              flexDirection: 'column', 
              background: 'var(--bg-main)', 
              color: 'var(--text-main)',
              overflow: 'hidden'
            }}
          >
            <ComunicadoWorkspace
              form={form}
              setForm={setForm}
              setIsWorkspaceOpen={setIsWorkspaceOpen}
              sending={sending}
              sendingProgress={sendingProgress}
              sizeLimitExceeded={sizeLimitExceeded}
              totalAttachmentsSize={totalAttachmentsSize}
              activePreset={activePreset}
              setActivePreset={setActivePreset}
              filesList={filesList}
              fileInputRef={fileInputRef}
              handleFileChange={handleFileChange}
              removeFile={removeFile}
              previewHtml={previewHtml}
              handleSend={handleSend}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL DE NOTIFICACIÓN PREMIUM */}
      {customAlert && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999999999,
          padding: 16
        }}>
          <div style={{
            background: 'var(--bg-main)',
            border: '1px solid var(--border-color)',
            borderRadius: 20,
            width: '100%',
            maxWidth: 400,
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
            overflow: 'hidden',
            textAlign: 'center',
            padding: '32px 24px',
            color: 'var(--text-main)'
          }}>
            <div style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: customAlert.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              color: customAlert.type === 'success' ? 'var(--success)' : 'rgb(239, 68, 68)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              fontSize: '1.8rem',
              fontWeight: 'bold'
            }}>
              {customAlert.type === 'success' ? '✓' : '✗'}
            </div>
            
            <h4 style={{ margin: '0 0 8px', fontSize: '1.2rem', fontWeight: 900 }}>
              {customAlert.title}
            </h4>
            
            <p style={{ margin: '0 0 24px', fontSize: '0.9rem', color: 'var(--text-sec)', lineHeight: 1.5 }}>
              {customAlert.message}
            </p>
            
            <button 
              onClick={() => {
                setCustomAlert(null);
                if (customAlert.onClose) customAlert.onClose();
              }}
              style={{
                background: customAlert.type === 'success' ? 'var(--primary)' : 'rgb(239, 68, 68)',
                color: '#fff',
                border: 'none',
                width: '100%',
                padding: '12px',
                borderRadius: 12,
                cursor: 'pointer',
                fontWeight: 800,
                fontSize: '0.95rem'
              }}
            >
              Aceptar
            </button>
          </div>
        </div>
      )}

      {/* MODAL VISOR DE DESTINATARIOS */}
      {selectedCampanaRecipients && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999999,
          padding: 16
        }}>
          <div style={{
            background: 'var(--bg-main)',
            border: '1px solid var(--border-color)',
            borderRadius: 20,
            width: '100%',
            maxWidth: 500,
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
            overflow: 'hidden',
            color: 'var(--text-main)'
          }}>
            <header style={{
              padding: '20px 24px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'rgba(255,255,255,0.01)'
            }}>
              <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900 }}>Destinatarios del Comunicado</h4>
              <button 
                onClick={() => setSelectedCampanaRecipients(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-sec)',
                  fontSize: '1.2rem',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                ✕
              </button>
            </header>
            <div style={{ padding: '24px', maxHeight: 300, overflowY: 'auto' }}>
              <div style={{ marginBottom: 16 }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-sec)', display: 'block', marginBottom: 4 }}>
                  Tipo de Destinatario
                </span>
                <span style={{
                  background: 'var(--input-bg)',
                  color: 'var(--text-main)',
                  padding: '4px 10px',
                  borderRadius: 8,
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  display: 'inline-block'
                }}>
                  {selectedCampanaRecipients.destinatarios === 'clientes' && '👥 Todos los Clientes'}
                  {selectedCampanaRecipients.destinatarios === 'proveedores' && '👥 Todos los Proveedores'}
                  {selectedCampanaRecipients.destinatarios === 'manual' && '✏️ Manual'}
                  {selectedCampanaRecipients.destinatarios === 'prueba' && '🧪 Prueba'}
                </span>
              </div>
              
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-sec)', display: 'block', marginBottom: 6 }}>
                  Lista de Correos
                </span>
                {selectedCampanaRecipients.destinatarios === 'manual' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {(selectedCampanaRecipients.manual_emails || '').split(/[\n,;]/).map((email: string) => email.trim()).filter(Boolean).map((email: string, i: number) => (
                      <div key={i} style={{ fontSize: '0.85rem', fontWeight: 600, padding: '8px 12px', background: 'var(--input-bg)', borderRadius: 8 }}>
                        {email}
                      </div>
                    ))}
                  </div>
                ) : selectedCampanaRecipients.destinatarios === 'prueba' ? (
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, padding: '8px 12px', background: 'var(--input-bg)', borderRadius: 8 }}>
                    {selectedCampanaRecipients.asunto.includes('TEST') ? 'test-contador@prosperafinanzas.com (Enviado a destinatario de prueba)' : 'test-contador@prosperafinanzas.com'}
                  </div>
                ) : (
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-sec)', fontStyle: 'italic' }}>
                    Este comunicado fue enviado de forma masiva a todo el grupo seleccionado ({selectedCampanaRecipients.destinatarios === 'clientes' ? 'Clientes' : 'Proveedores'}).
                  </p>
                )}
              </div>
            </div>
            <footer style={{
              padding: '16px 24px',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'flex-end',
              background: 'rgba(255,255,255,0.01)'
            }}>
              <button 
                onClick={() => setSelectedCampanaRecipients(null)}
                style={{
                  background: 'var(--primary)',
                  color: '#fff',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: 10,
                  cursor: 'pointer',
                  fontWeight: 800,
                  fontSize: '0.85rem'
                }}
              >
                Entendido
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
};

export default Comunicados;
