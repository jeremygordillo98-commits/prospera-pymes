import React from 'react';

interface Props {
  doc: any;
  calculatedBase12: number;
  ivaDisplay: number;
  totalVal: number;
}

export const SRIValoresFactura: React.FC<Props> = ({
  doc,
  calculatedBase12,
  ivaDisplay,
  totalVal
}) => {
  return (
    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.04)' }}>
      <h4 style={{ margin: '0 0 16px 0', fontSize: '1rem', fontWeight: 800, color: 'var(--primary)' }}>
        Resumen de Valores (Factura)
      </h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem' }}>
        {calculatedBase12 > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '6px' }}>
            <span style={{ color: 'var(--text-sec)' }}>Subtotal con IVA (Tarifa 12% / 15%):</span>
            <span style={{ fontWeight: 'bold', color: '#ffffff' }}>${calculatedBase12.toFixed(2)}</span>
          </div>
        )}
        {(doc.base_0 || 0) > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '6px' }}>
            <span style={{ color: 'var(--text-sec)' }}>Subtotal sin IVA (Tarifa 0%):</span>
            <span style={{ fontWeight: 'bold', color: '#ffffff' }}>${(doc.base_0 || 0).toFixed(2)}</span>
          </div>
        )}
        {(doc.base_no_objeto || 0) > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '6px' }}>
            <span style={{ color: 'var(--text-sec)' }}>Subtotal No Objeto de IVA:</span>
            <span style={{ fontWeight: 'bold', color: '#ffffff' }}>${(doc.base_no_objeto || 0).toFixed(2)}</span>
          </div>
        )}
        {ivaDisplay > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '6px' }}>
            <span style={{ color: 'var(--text-sec)' }}>Monto IVA:</span>
            <span style={{ fontWeight: 'bold', color: 'var(--primary)' }}>${ivaDisplay.toFixed(2)}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: '1.05rem', paddingTop: '8px', borderTop: '1px dashed rgba(255,255,255,0.1)' }}>
          <span style={{ color: '#ffffff' }}>Total Factura:</span>
          <span style={{ color: '#ffffff' }}>${totalVal.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
};
