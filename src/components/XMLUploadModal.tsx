import React from 'react';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import { motion } from 'framer-motion';
import { useXMLUpload } from '../hooks/useXMLUpload';
import { XMLDropzone } from './XMLDropzone';
import { XMLBatchHeader } from './XMLBatchHeader';
import { XMLBatchTable } from './XMLBatchTable';

interface XMLUploadModalProps {
  isOpen: boolean;
  tipo?: 'Compras' | 'Ventas';
  empresaId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const XMLUploadModal: React.FC<XMLUploadModalProps> = ({
  isOpen,
  tipo = "Compras",
  empresaId,
  onClose,
  onSuccess
}) => {
  const {
    parsing,
    accounts,
    batchItems,
    batchSaving,
    batchProgress,
    isDragOver,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleFileChange,
    autoCreateAllEntities,
    handleSaveBatch,
    handleUpdateItem,
    handleDeleteItem,
    clearDraft
  } = useXMLUpload(empresaId, tipo, isOpen, onClose, onSuccess);

  if (!isOpen) return null;

  const hasFiles = batchItems.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 15 }}
      transition={{ duration: 0.25 }}
      className="glass-card"
      style={{
        padding: 0,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        width: '100%',
        boxSizing: 'border-box',
        minHeight: '500px',
        maxHeight: 'calc(100vh - 120px)'
      }}
    >
      {/* Loader de Parsing */}
      {parsing && (
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(11, 15, 25, 0.9)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10001,
          borderTopLeftRadius: '20px',
          borderTopRightRadius: '20px',
          borderBottomLeftRadius: '20px',
          borderBottomRightRadius: '20px'
        }}>
          <Loader2 className="animate-spin" style={{ color: 'var(--primary)', marginBottom: '16px' }} size={44} />
          <p style={{ color: '#ffffff', fontSize: '14px', fontWeight: 'bold', letterSpacing: '0.5px', margin: 0 }}>Procesando y validando archivos XML...</p>
          <p style={{ color: 'var(--text-sec)', fontSize: '11px', marginTop: '4px', fontWeight: 500, margin: 0 }}>Extrayendo datos fiscales del SRI...</p>
        </div>
      )}

      {/* Cabecera */}
      <div style={{
        padding: '20px 24px',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#0b0f19',
        borderTopLeftRadius: '20px',
        borderTopRightRadius: '20px'
      }}>
        <h3 className="h1" style={{
          fontSize: '1.2rem',
          fontWeight: 900,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          color: '#ffffff',
          margin: 0
        }}>
          <button 
            onClick={onClose} 
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--primary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '8px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              transition: 'all 0.2s ease',
              width: '36px',
              height: '36px'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.15)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
            }}
            title="Volver al Historial"
          >
            <ArrowLeft size={20} />
          </button>
          Carga de XML SRI — {tipo}
        </h3>
      </div>

      {/* Cuerpo */}
      <div style={{
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        backgroundColor: 'rgba(11, 19, 24, 0.4)',
        borderBottomLeftRadius: '20px',
        borderBottomRightRadius: '20px',
        overflowY: 'auto'
      }}>
        {!hasFiles ? (
          /* DISPARADOR INICIAL */
          <XMLDropzone
            isDragOver={isDragOver}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onFileChange={handleFileChange}
          />
        ) : (
          /* TABLA PROCESADOR DE LOTES */
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            flex: 1
          }}>
            <XMLBatchHeader
              totalItems={batchItems.length}
              hasMissingEntities={batchItems.some(item => item.status === 'missing_entity')}
              onAutoCreateEntities={autoCreateAllEntities}
              onFileChange={handleFileChange}
            />

            {/* Renderizar componente de tabla modular */}
            <XMLBatchTable
              items={batchItems}
              accounts={accounts}
              empresaId={empresaId}
              onChangeItem={handleUpdateItem}
              onDeleteItem={handleDeleteItem}
            />

            {/* Barra de progreso de guardado */}
            {batchSaving && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                backgroundColor: '#0f172a',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                padding: '16px',
                borderRadius: '12px'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  color: 'var(--text-sec)'
                }}>
                  <span>Guardando y procesando asientos en lote...</span>
                  <span>{batchProgress}%</span>
                </div>
                <div style={{
                  width: '100%',
                  height: '8px',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: '9999px',
                  overflow: 'hidden',
                  border: '1px solid rgba(255, 255, 255, 0.1)'
                }}>
                  <div style={{
                    height: '100%',
                    backgroundColor: 'var(--primary)',
                    width: `${batchProgress}%`,
                    transition: 'width 0.3s ease'
                  }} />
                </div>
              </div>
            )}

            {/* Footer */}
            <footer style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '16px',
              paddingTop: '16px',
              borderTop: '1px solid var(--border-color)'
            }}>
              <button
                disabled={batchSaving}
                onClick={clearDraft}
                className="btn"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  padding: '12px 24px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  color: 'var(--text-main)',
                  cursor: 'pointer'
                }}
                onMouseEnter={e => { if (!batchSaving) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'; }}
                onMouseLeave={e => { if (!batchSaving) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'; }}
              >
                Limpiar Todo
              </button>
              
              <button
                disabled={batchSaving || !batchItems.some(item => item.status === 'ready')}
                onClick={handleSaveBatch}
                className="btn btn-primary"
                style={{
                  padding: '12px 32px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: 900,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {batchSaving ? (
                  <Loader2 className="animate-spin" size={15} />
                ) : (
                  <>
                    <Save size={15} />
                    Guardar {batchItems.filter(item => item.status === 'ready').length} Documentos
                  </>
                )}
              </button>
            </footer>
          </div>
        )}
      </div>
    </motion.div>
  );
};
