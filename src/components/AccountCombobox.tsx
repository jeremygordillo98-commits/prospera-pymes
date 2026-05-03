import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';

interface Account {
  id: string;
  codigo_cuenta: string;
  nombre: string;
  tipo: string;
}

interface AccountComboboxProps {
  accounts: Account[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  filterByTipo?: string;
  fixedDropdown?: boolean;
}

export const AccountCombobox: React.FC<AccountComboboxProps> = ({
  accounts, value, onChange,
  placeholder = 'Seleccionar cuenta...',
  filterByTipo,
  fixedDropdown = false,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const pool = filterByTipo ? accounts.filter(a => a.tipo === filterByTipo) : accounts;

  const filtered = query.trim()
    ? pool.filter(a =>
      a.nombre.toLowerCase().includes(query.toLowerCase()) ||
      a.codigo_cuenta.includes(query)
    )
    : pool;

  const selected = accounts.find(a => a.id === value);

  // Cierra al hacer clic fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleOpen = () => {
    if (fixedDropdown && containerRef.current) {
      const r = containerRef.current.getBoundingClientRect();
      setDropdownStyle({
        position: 'fixed',
        top: r.bottom + 6,
        left: r.left,
        width: r.width,
        zIndex: 99999,
      });
    }
    setOpen(true);
    setQuery('');
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleSelect = (id: string) => {
    onChange(id);
    setOpen(false);
    setQuery('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setQuery('');
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      {/* Trigger */}
      <button
        type="button"
        onClick={handleOpen}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '10px 14px',
          borderRadius: 12,
          background: 'var(--input-bg)',
          border: '1px solid var(--border-color)',
          color: selected ? 'var(--text-main)' : 'var(--text-sec)',
          fontSize: '0.78rem',
          fontWeight: selected ? 600 : 400,
          cursor: 'pointer',
          textAlign: 'left',
          transition: 'border-color 0.2s',
        }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--primary)')}
        onMouseLeave={e => (e.currentTarget.style.borderColor = open ? 'var(--primary)' : 'var(--border-color)')}
      >
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected ? `${selected.codigo_cuenta} — ${selected.nombre}` : placeholder}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          {selected && (
            <span
              onClick={handleClear}
              style={{ color: 'var(--text-sec)', cursor: 'pointer', display: 'flex' }}
            >
              <X size={13} />
            </span>
          )}
          <ChevronDown
            size={14}
            style={{
              color: 'var(--text-sec)',
              transition: 'transform 0.2s',
              transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
          />
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            zIndex: 9999,
            background: 'var(--nav-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: 14,
            boxShadow: '0 20px 40px -8px rgba(0,0,0,0.4)',
            ...(fixedDropdown ? dropdownStyle : {}),
            overflow: 'hidden',
            backdropFilter: 'blur(40px)',
            WebkitBackdropFilter: 'blur(40px)',
          }}
        >
          {/* Search input */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 12px',
              borderBottom: '1px solid var(--border-color)',
            }}
          >
            <Search size={14} style={{ color: 'var(--text-sec)', flexShrink: 0 }} />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar por nombre o código..."
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--text-main)',
                fontSize: '0.8rem',
              }}
              onKeyDown={e => {
                if (e.key === 'Escape') { setOpen(false); setQuery(''); }
                if (e.key === 'Enter' && filtered.length === 1) handleSelect(filtered[0].id);
              }}
            />
          </div>

          {/* List */}
          <div style={{ maxHeight: 220, overflowY: 'auto' }} className="custom-scrollbar">
            {filtered.length === 0 ? (
              <p style={{ padding: '12px 16px', fontSize: '0.78rem', color: 'var(--text-sec)', textAlign: 'center' }}>
                Sin resultados
              </p>
            ) : (
              filtered.map(a => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => handleSelect(a.id)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '9px 14px',
                    background: a.id === value ? 'var(--primary-light)' : 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: a.id === value ? 'var(--primary)' : 'var(--text-main)',
                    fontSize: '0.76rem',
                    display: 'flex',
                    gap: 8,
                    alignItems: 'baseline',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => {
                    if (a.id !== value) e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                  }}
                  onMouseLeave={e => {
                    if (a.id !== value) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, flexShrink: 0, fontSize: '0.72rem', color: 'var(--text-sec)' }}>
                    {a.codigo_cuenta}
                  </span>
                  <span style={{ fontWeight: a.id === value ? 700 : 500 }}>{a.nombre}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
