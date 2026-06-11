import React from 'react';

interface Props {
  doc: any;
  showAlert: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

export const SRIIdentificacionDocumento: React.FC<Props> = ({ doc, showAlert }) => {
  return (
    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.04)' }}>
      <h4 style={{ margin: '0 0 16px 0', fontSize: '1rem', fontWeight: 800, color: 'var(--primary)' }}>
        Identificación del Documento
      </h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '6px' }}>
          <span style={{ color: 'var(--text-sec)' }}>Tipo:</span>
          <span style={{ fontWeight: 'bold', color: '#ffffff' }}>{doc.transacciones?.tipo_comprobante}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '6px' }}>
          <span style={{ color: 'var(--text-sec)' }}>Número:</span>
          <span style={{ fontWeight: 'bold', color: '#ffffff', fontFamily: 'monospace' }}>{doc.transacciones?.numero_comprobante}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '6px' }}>
          <span style={{ color: 'var(--text-sec)' }}>Fecha Emisión:</span>
          <span style={{ fontWeight: 'bold', color: '#ffffff' }}>
            {doc.transacciones?.fecha ? new Date(doc.transacciones.fecha + 'T12:00:00').toLocaleDateString('es-EC', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-sec)' }}>Clave de Acceso (SRI):</span>
            <button 
              onClick={() => {
                navigator.clipboard.writeText(doc.clave_acceso_xml);
                showAlert("Clave de acceso copiada al portapapeles.", "success");
              }}
              style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.75rem', cursor: 'pointer', padding: 0, fontWeight: 'bold' }}
            >
              [Copiar]
            </button>
          </div>
          <span style={{ fontWeight: 'bold', color: 'var(--text-sec)', fontSize: '0.76rem', fontFamily: 'monospace', wordBreak: 'break-all', marginTop: 2 }}>
            {doc.clave_acceso_xml}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '6px' }}>
          <span style={{ color: 'var(--text-sec)' }}>Entidad Vinculada:</span>
          <span style={{ fontWeight: 'bold', color: '#ffffff', textAlign: 'right' }}>{doc.transacciones?.entidades?.nombre}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text-sec)' }}>RUC/ID Entidad:</span>
          <span style={{ fontWeight: 'bold', color: '#ffffff', fontFamily: 'monospace' }}>{doc.transacciones?.entidades?.ruc_cedula}</span>
        </div>
      </div>
    </div>
  );
};
