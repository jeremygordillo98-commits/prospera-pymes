import React, { useState, useMemo, useRef, useEffect } from 'react';
import { CATALOGO_RETENCIONES_RENTA } from '../utils/sriCatalog';

interface RetentionSelectorProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  style?: React.CSSProperties;
  customTriggerStyle?: React.CSSProperties;
  customDropdownStyle?: React.CSSProperties;
}

export const RetentionSelector: React.FC<RetentionSelectorProps> = ({
  value,
  onChange,
  placeholder = "Seleccionar retención...",
  style,
  customTriggerStyle,
  customDropdownStyle
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedOption = useMemo(() => 
    CATALOGO_RETENCIONES_RENTA.find(r => r.codigo === value), 
    [value]
  );

  const filteredOptions = useMemo(() => {
    const term = search.toLowerCase().trim();
    if (!term) return CATALOGO_RETENCIONES_RENTA;
    return CATALOGO_RETENCIONES_RENTA.filter(r => 
      r.codigo.toLowerCase().includes(term) || 
      r.porcentaje.toString().includes(term) ||
      r.descripcion.toLowerCase().includes(term)
    );
  }, [search]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isOpen]);

  const displayLabel = selectedOption ? `${selectedOption.codigo} (${selectedOption.porcentaje}%)` : placeholder;

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', ...style }}>
      {/* Trigger pill */}
      <div
        onClick={() => {
          if (!isOpen) {
            setIsOpen(true);
            setSearch("");
          }
        }}
        style={{
          width: '100%',
          backgroundColor: '#101b22',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '9999px',
          padding: '6px 12px',
          color: '#ffffff',
          fontSize: '11px',
          outline: 'none',
          transition: 'all 0.2s ease',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          minHeight: '30px',
          boxSizing: 'border-box',
          ...customTriggerStyle
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.5)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
        }}
      >
        <div style={{ flex: '1 1 auto', minWidth: '0px', width: '100%', textAlign: 'left' }}>
          {isOpen ? (
            <input
              ref={inputRef}
              type="text"
              placeholder={selectedOption ? `${selectedOption.codigo} (${selectedOption.porcentaje}%)` : placeholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                minWidth: '100%',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#ffffff',
                fontSize: '11px',
                padding: 0,
                fontWeight: 500,
                boxSizing: 'border-box'
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              display: 'block',
              fontWeight: 500
            }}>
              {displayLabel}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0, userSelect: 'none', marginLeft: '4px' }}>
          <span style={{ fontSize: '7px', opacity: 0.6, fontWeight: 'bold' }}>{isOpen ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* Floating Dropdown */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 9999,
            backgroundColor: '#101b22',
            border: '1px solid #1e2f38',
            borderRadius: '16px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.5)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            maxHeight: '220px',
            ...customDropdownStyle
          }}
        >
          <div className="custom-scrollbar" style={{ overflowY: 'auto', maxHeight: '220px' }}>
            {filteredOptions.length === 0 ? (
              <div style={{ padding: '16px', fontSize: '11px', textAlign: 'center', color: 'var(--text-sec)' }}>
                No se encontraron códigos
              </div>
            ) : (
              filteredOptions.map(opt => (
                <div
                  key={opt.codigo}
                  onClick={() => {
                    onChange(opt.codigo);
                    setIsOpen(false);
                  }}
                  style={{
                    padding: '10px 12px',
                    fontSize: '11px',
                    cursor: 'pointer',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.02)',
                    backgroundColor: opt.codigo === value ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                    color: opt.codigo === value ? '#10b981' : '#ffffff',
                    transition: 'background-color 0.2s ease',
                    textAlign: 'left'
                  }}
                  onMouseEnter={e => {
                    if (opt.codigo !== value) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                  }}
                  onMouseLeave={e => {
                    if (opt.codigo !== value) e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                  title={opt.descripcion}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', marginBottom: '2px' }}>
                    <span style={{ color: opt.codigo === value ? '#10b981' : 'var(--primary)' }}>{opt.codigo}</span>
                    <span style={{ color: 'var(--warning)' }}>{opt.porcentaje}%</span>
                  </div>
                  <div style={{
                    fontSize: '9px',
                    opacity: 0.7,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    color: 'var(--text-sec)'
                  }}>
                    {opt.descripcion}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
