import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useComunicados } from '../hooks/useComunicados';
import { ComunicadoHistorial } from '../components/ComunicadoHistorial';
import { ComunicadoWorkspace } from '../components/ComunicadoWorkspace';

interface ComunicadosProps {
  empresaId: string;
}

export const Comunicados: React.FC<ComunicadosProps> = ({ empresaId }) => {
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
