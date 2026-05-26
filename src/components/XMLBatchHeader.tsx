import React from 'react';
import { Plus } from 'lucide-react';

interface XMLBatchHeaderProps {
  totalItems: number;
  hasMissingEntities: boolean;
  onAutoCreateEntities: () => Promise<void>;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const XMLBatchHeader: React.FC<XMLBatchHeaderProps> = ({
  totalItems,
  hasMissingEntities,
  onAutoCreateEntities,
  onFileChange
}) => {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: '16px',
      backgroundColor: 'rgba(17, 28, 34, 0.5)',
      padding: '16px',
      borderRadius: '12px',
      border: '1px solid rgba(255, 255, 255, 0.05)'
    }}>
      <div>
        <h4 style={{
          fontWeight: 900,
          fontSize: '1rem',
          color: '#ffffff',
          margin: 0
        }}>
          Archivos Procesados ({totalItems})
        </h4>
        <p style={{
          fontSize: '11px',
          color: 'var(--text-sec)',
          fontWeight: 500,
          margin: '2px 0 0 0'
        }}>
          Verifica y asigna cuentas antes de guardar.
        </p>
      </div>
      
      <div style={{
        display: 'flex',
        gap: '8px'
      }}>
        {hasMissingEntities && (
          <button
            onClick={onAutoCreateEntities}
            className="btn"
            style={{
              fontSize: '11px',
              fontWeight: 900,
              padding: '8px 16px',
              height: '36px',
              borderRadius: '12px',
              backgroundColor: '#eab308',
              color: '#0b0f19',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            Registrar Proveedores Faltantes
          </button>
        )}
        
        <button
          onClick={() => document.getElementById('xmlInputAddMore')?.click()}
          className="btn"
          style={{
            backgroundColor: '#162529',
            color: 'var(--primary)',
            border: '1px solid rgba(0, 214, 143, 0.2)',
            fontSize: '11px',
            fontWeight: 900,
            padding: '8px 16px',
            height: '36px',
            borderRadius: '12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = '#1a2f34'}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = '#162529'}
        >
          <Plus size={13} /> Agregar más
        </button>
        <input
          id="xmlInputAddMore"
          type="file"
          accept=".xml"
          multiple
          style={{ display: 'none' }}
          onChange={onFileChange}
        />
      </div>
    </div>
  );
};
