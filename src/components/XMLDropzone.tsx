import React from 'react';
import { Upload } from 'lucide-react';

interface XMLDropzoneProps {
  isDragOver: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const XMLDropzone: React.FC<XMLDropzoneProps> = ({
  isDragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileChange
}) => {
  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={() => document.getElementById('xmlInputInitial')?.click()}
      style={{
        border: '2px dashed var(--border-color)',
        borderRadius: '16px',
        padding: '40px',
        textAlign: 'center',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '300px',
        borderColor: isDragOver ? 'var(--primary)' : 'var(--border-color)',
        backgroundColor: isDragOver ? 'rgba(0, 214, 143, 0.08)' : 'transparent',
        transform: isDragOver ? 'scale(1.01)' : 'scale(1)'
      }}
      onMouseEnter={e => {
        if (!isDragOver) {
          e.currentTarget.style.borderColor = 'rgba(0, 214, 143, 0.4)';
          e.currentTarget.style.backgroundColor = 'rgba(0, 214, 143, 0.03)';
        }
      }}
      onMouseLeave={e => {
        if (!isDragOver) {
          e.currentTarget.style.borderColor = 'var(--border-color)';
          e.currentTarget.style.backgroundColor = 'transparent';
        }
      }}
    >
      <div style={{
        width: '64px',
        height: '64px',
        borderRadius: '16px',
        backgroundColor: '#0d2a23',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '20px',
        transition: 'transform 0.2s ease'
      }}>
        <Upload style={{ color: 'var(--primary)' }} size={32} />
      </div>
      <p style={{
        fontWeight: 800,
        fontSize: '16px',
        margin: '0 0 4px 0',
        color: '#ffffff'
      }}>Sube múltiples archivos XML</p>
      <p style={{
        color: 'var(--text-sec)',
        fontSize: '12px',
        maxWidth: '280px',
        margin: '0 auto',
        lineHeight: 1.5
      }}>
        Selecciona varios archivos a la vez para procesarlos en lote.
      </p>
      <input
        id="xmlInputInitial"
        type="file"
        accept=".xml"
        multiple
        style={{ display: 'none' }}
        onChange={onFileChange}
      />
    </div>
  );
};
