import React from 'react';
import { motion } from 'framer-motion';
import { X, FileText, Download } from 'lucide-react';
import { useDocumentDetailsSRI } from '../hooks/useDocumentDetailsSRI';
import { SRIIdentificacionDocumento } from './SRIIdentificacionDocumento';
import { SRIValoresFactura } from './SRIValoresFactura';
import { SRIAsientoContable } from './SRIAsientoContable';
import { SRIRetencionAplicada } from './SRIRetencionAplicada';
import { generateSingleSRIDocumentPDF } from '../utils/pdfGenerator';

interface DocumentDetailsSRIModalProps {
  viewingDoc: any;
  onClose: () => void;
  accounts: any[];
  empresaId: string;
  tipo: 'Compras' | 'Ventas';
  onSuccess: () => void;
  showAlert: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  showConfirm: (message: string, onConfirm: () => void, title?: string) => void;
}

export const DocumentDetailsSRIModal: React.FC<DocumentDetailsSRIModalProps> = ({
  viewingDoc,
  onClose,
  accounts,
  empresaId,
  tipo,
  onSuccess,
  showAlert,
  showConfirm
}) => {
  const {
    doc,
    viewingMovements,
    loadingViewingMovs,
    withholdingLoading,
    parsedWithholding,
    verRetRenta,
    setVerRetRenta,
    verRetIva,
    setVerRetIva,
    selectedWithholdingRentaAccount,
    setSelectedWithholdingRentaAccount,
    selectedWithholdingIvaAccount,
    setSelectedWithholdingIvaAccount,
    getAccountLabel,
    handleWithholdingFileChange,
    handleSaveManualWithholding,
    handleRemoveWithholding,
    ivaDisplay,
    totalVal,
    calculatedBase12,
    handleApplyWithholdingFromXML
  } = useDocumentDetailsSRI({
    viewingDoc,
    accounts,
    empresaId,
    tipo,
    onSuccess,
    showAlert,
    showConfirm
  });

  if (!doc) return null;

  return (
    <div className="modal-overlay" style={{ 
      position: 'fixed',
      inset: 0,
      zIndex: 10000, 
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
        className="modal-content glass-card"
        style={{ 
          padding: 0, 
          width: '95%', 
          maxWidth: '1000px', 
          maxHeight: 'min(90vh, 850px)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: 'rgba(11, 15, 25, 0.97)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '20px'
        }}
      >
        {/* Header Fijo */}
        <div style={{ 
          padding: '24px 32px', 
          borderBottom: '1px solid var(--border-color)', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center' 
        }}>
          <h3 className="h1" style={{ fontSize: '1.4rem', margin: 0, display: 'flex', alignItems: 'center', gap: 10, fontWeight: 900, color: '#ffffff' }}>
            <FileText className="text-primary" size={24} /> Resumen y Detalle del XML
          </h3>
          <button 
            onClick={onClose} 
            style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: 'var(--text-sec)', cursor: 'pointer', padding: '8px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Cuerpo Scrollable */}
        <div style={{ 
          padding: '32px', 
          overflowY: 'auto', 
          flex: 1,
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(380px, 100%), 1fr))', 
          gap: '32px' 
        }}>
          {/* Columna Izquierda */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Datos del Comprobante */}
            <SRIIdentificacionDocumento doc={doc} showAlert={showAlert} />

            {/* Resumen de Valores */}
            <SRIValoresFactura
              doc={doc}
              calculatedBase12={calculatedBase12}
              ivaDisplay={ivaDisplay}
              totalVal={totalVal}
            />
          </div>

          {/* Columna Derecha */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Asiento Contable */}
            <SRIAsientoContable
              loadingViewingMovs={loadingViewingMovs}
              viewingMovements={viewingMovements}
              getAccountLabel={getAccountLabel}
            />

            {/* Retención SRI */}
            <SRIRetencionAplicada
              doc={doc}
              tipo={tipo}
              accounts={accounts}
              withholdingLoading={withholdingLoading}
              parsedWithholding={parsedWithholding}
              verRetRenta={verRetRenta}
              setVerRetRenta={setVerRetRenta}
              verRetIva={verRetIva}
              setVerRetIva={setVerRetIva}
              selectedWithholdingRentaAccount={selectedWithholdingRentaAccount}
              setSelectedWithholdingRentaAccount={setSelectedWithholdingRentaAccount}
              selectedWithholdingIvaAccount={selectedWithholdingIvaAccount}
              setSelectedWithholdingIvaAccount={setSelectedWithholdingIvaAccount}
              handleWithholdingFileChange={handleWithholdingFileChange}
              handleSaveManualWithholding={handleSaveManualWithholding}
              handleRemoveWithholding={handleRemoveWithholding}
              handleApplyWithholdingFromXML={handleApplyWithholdingFromXML}
            />
          </div>
        </div>

        {/* Footer Fijo */}
        <div style={{ 
          padding: '20px 32px', 
          borderTop: '1px solid var(--border-color)', 
          display: 'flex', 
          justifyContent: 'flex-end',
          gap: '12px',
          backgroundColor: '#0c101b'
        }}>
          <button 
            onClick={async () => {
              try {
                await generateSingleSRIDocumentPDF(empresaId, doc, viewingMovements, getAccountLabel);
                showAlert("PDF generado exitosamente.", "success");
              } catch (err) {
                console.error("Error generating PDF:", err);
                showAlert("Error al generar el PDF.", "error");
              }
            }}
            className="btn btn-secondary" 
            style={{ 
              padding: '12px 28px', 
              fontSize: '0.95rem', 
              fontWeight: 800, 
              borderRadius: '12px', 
              background: 'rgba(255,255,255,0.05)', 
              border: '1px solid rgba(255,255,255,0.1)', 
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Download size={16} /> Descargar PDF
          </button>
          <button 
            onClick={onClose} 
            className="btn btn-primary" 
            style={{ padding: '12px 28px', fontSize: '0.95rem', fontWeight: 800, borderRadius: '12px' }}
          >
            Cerrar Detalle
          </button>
        </div>
      </motion.div>
    </div>
  );
};
