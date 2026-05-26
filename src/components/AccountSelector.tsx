import React, { useState, useMemo, useRef, useEffect } from 'react';

// Interfaces comunes
interface Account {
  id: string;
  codigo_cuenta: string;
  nombre: string;
  tipo: string;
}

interface AccountSelectorProps {
  value: string;
  onChange: (val: string) => void;
  accounts: Account[];
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  customTriggerStyle?: React.CSSProperties;
  customDropdownStyle?: React.CSSProperties;
}

export const AccountSelector: React.FC<AccountSelectorProps> = ({
  value,
  onChange,
  accounts,
  placeholder = "Seleccionar cuenta...",
  className = "",
  style,
  customTriggerStyle,
  customDropdownStyle
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedAccount = useMemo(() => accounts.find(a => a.id === value), [value, accounts]);

  const filteredAccounts = useMemo(() => {
    const term = search.toLowerCase().trim();
    if (!term) return accounts;
    return accounts.filter(a => 
      a.codigo_cuenta.toLowerCase().includes(term) || 
      a.nombre.toLowerCase().includes(term)
    );
  }, [search, accounts]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Autofocus del input inline al abrir
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isOpen]);

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', ...style }}>
      {/* Selector en forma de píldora redondeada */}
      <div 
        onClick={() => {
          if (!isOpen) {
            setIsOpen(true);
            setSearch("");
          }
        }}
        className={className}
        style={{
          width: '100%',
          backgroundColor: 'rgba(22, 37, 41, 0.65)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '9999px',
          padding: '8px 16px',
          color: '#ffffff',
          fontSize: '12px',
          outline: 'none',
          transition: 'all 0.2s ease',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          minHeight: '34px',
          boxSizing: 'border-box',
          ...customTriggerStyle
        }}
        onMouseEnter={e => {
          e.currentTarget.style.backgroundColor = 'rgba(27, 49, 54, 0.8)';
          e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.5)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.backgroundColor = 'rgba(22, 37, 41, 0.65)';
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
        }}
      >
        <div style={{ flex: '1 1 auto', minWidth: '0px', width: '100%', textAlign: 'left' }}>
          {isOpen ? (
            <input
              ref={inputRef}
              type="text"
              placeholder={selectedAccount ? `${selectedAccount.codigo_cuenta} — ${selectedAccount.nombre}` : placeholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                minWidth: '100%',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#ffffff',
                fontSize: '12px',
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
              {selectedAccount ? `${selectedAccount.codigo_cuenta} — ${selectedAccount.nombre}` : placeholder}
            </span>
          )}
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          flexShrink: 0,
          userSelect: 'none'
        }}>
          {selectedAccount && !isOpen && (
            <span 
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
                setIsOpen(false);
              }}
              style={{
                color: 'rgba(255, 255, 255, 0.4)',
                fontSize: '10px',
                fontWeight: 'bold',
                padding: '2px',
                cursor: 'pointer',
                transition: 'color 0.2s ease'
              }}
              onMouseEnter={e => e.currentTarget.style.color = 'rgb(248, 113, 113)'}
              onMouseLeave={e => e.currentTarget.style.color = 'rgba(255, 255, 255, 0.4)'}
              title="Limpiar selección"
            >
              ✕
            </span>
          )}
          <span style={{ fontSize: '8px', opacity: 0.6, fontWeight: 'bold' }}>{isOpen ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* Menú flotante de búsqueda */}
      {isOpen && (
        <div 
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
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
            {filteredAccounts.length === 0 ? (
              <div style={{ padding: '16px', fontSize: '12px', textAlign: 'center', color: 'var(--text-sec)' }}>
                No se encontraron cuentas
              </div>
            ) : (
              filteredAccounts.map(account => (
                <div
                  key={account.id}
                  onClick={() => {
                    onChange(account.id);
                    setIsOpen(false);
                  }}
                  style={{
                    padding: '12px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.02)',
                    backgroundColor: account.id === value ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                    color: account.id === value ? '#10b981' : '#ffffff',
                    transition: 'background-color 0.2s ease'
                  }}
                  onMouseEnter={e => {
                    if (account.id !== value) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                  }}
                  onMouseLeave={e => {
                    if (account.id !== value) e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <strong style={{
                    display: 'block',
                    fontSize: '12px',
                    color: account.id === value ? '#10b981' : 'var(--primary)',
                    marginBottom: '2px'
                  }}>{account.codigo_cuenta}</strong>
                  <span style={{
                    fontSize: '10px',
                    opacity: 0.8,
                    color: account.id === value ? '#10b981' : 'var(--text-main)'
                  }}>{account.nombre}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
