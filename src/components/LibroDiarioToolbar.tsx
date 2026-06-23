import React from 'react';
import { FileText, Download, Search, Filter, X, DollarSign } from 'lucide-react';

interface Props {
  filteredTransactionsLength: number;
  filterDate: string;
  setFilterDate: (val: string) => void;
  filterEntidad: string;
  setFilterEntidad: (val: string) => void;
  filterTipo: string;
  setFilterTipo: (val: string) => void;
  filterMontoMin: string;
  setFilterMontoMin: (val: string) => void;
  filterMontoMax: string;
  setFilterMontoMax: (val: string) => void;
  exportToExcel: () => void;
  exportToPDF: () => void;
}

const TIPOS_COMPROBANTE = [
  { value: '', label: 'Todos los tipos' },
  { value: 'Factura', label: 'Factura' },
  { value: 'Comprobante de Retención', label: 'Retención' },
  { value: 'Nota de Crédito', label: 'Nota de Crédito' },
  { value: 'Asiento Manual', label: 'Asiento Manual' },
  { value: 'Pago de Tesorería', label: 'Pago de Tesorería' },
  { value: 'Cobro de Tesorería', label: 'Cobro de Tesorería' },
  { value: 'Anulado', label: 'Anulados' },
];

const hasActiveFilters = (filterDate: string, filterEntidad: string, filterTipo: string, filterMontoMin: string, filterMontoMax: string) =>
  !!(filterDate || filterEntidad || filterTipo || filterMontoMin || filterMontoMax);

export const LibroDiarioToolbar: React.FC<Props> = ({
  filteredTransactionsLength,
  filterDate,
  setFilterDate,
  filterEntidad,
  setFilterEntidad,
  filterTipo,
  setFilterTipo,
  filterMontoMin,
  setFilterMontoMin,
  filterMontoMax,
  setFilterMontoMax,
  exportToExcel,
  exportToPDF
}) => {
  const anyActive = hasActiveFilters(filterDate, filterEntidad, filterTipo, filterMontoMin, filterMontoMax);

  const clearAll = () => {
    setFilterDate('');
    setFilterEntidad('');
    setFilterTipo('');
    setFilterMontoMin('');
    setFilterMontoMax('');
  };

  const inputStyle: React.CSSProperties = {
    padding: '9px 12px',
    borderRadius: 12,
    border: '1px solid var(--border-color)',
    background: 'var(--input-bg)',
    color: 'var(--text-main)',
    fontSize: '0.875rem',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  };

  return (
    <header style={{ marginBottom: '32px' }}>
      {/* Título */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', fontWeight: 800, textTransform: 'uppercase', fontSize: '0.8rem', letterSpacing: '2px', marginBottom: '8px' }}>
            <FileText size={14} /> Contabilidad Oficial
          </div>
          <h1 className="h1" style={{ fontSize: '2.5rem', fontWeight: 900 }}>Libro Diario</h1>
          <p className="text-sec" style={{ fontSize: '1.1rem' }}>Registro cronológico de todos los movimientos contables.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn" onClick={exportToPDF} disabled={filteredTransactionsLength === 0} style={{ padding: '10px 14px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 800 }}>
            <Download size={18} /><span className="hide-mobile">Exportar a PDF</span>
          </button>
          <button className="btn btn-primary" onClick={exportToExcel} disabled={filteredTransactionsLength === 0}>
            <Download size={18} /><span className="hide-mobile">Exportar a Excel</span>
          </button>
        </div>
      </div>

      {/* Panel de filtros */}
      <div className="glass-card" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <Filter size={14} style={{ color: 'var(--primary)' }} />
          <span style={{ fontWeight: 800, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-sec)' }}>Filtros</span>
          {anyActive && (
            <span style={{ background: 'var(--primary)', color: '#fff', fontSize: '0.68rem', fontWeight: 800, padding: '2px 8px', borderRadius: 20 }}>
              {filteredTransactionsLength} resultado{filteredTransactionsLength !== 1 ? 's' : ''}
            </span>
          )}
          {anyActive && (
            <button onClick={clearAll} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: 'var(--text-sec)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 }}>
              <X size={13} /> Limpiar todo
            </button>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
          {/* Fecha */}
          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-sec)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Fecha</label>
            <input
              type="date"
              value={filterDate}
              onChange={e => setFilterDate(e.target.value)}
              style={inputStyle}
            />
          </div>

          {/* Entidad */}
          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-sec)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Entidad</label>
            <div style={{ position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-sec)' }} />
              <input
                type="text"
                value={filterEntidad}
                onChange={e => setFilterEntidad(e.target.value)}
                placeholder="Buscar entidad..."
                style={{ ...inputStyle, paddingLeft: 30 }}
              />
            </div>
          </div>

          {/* Tipo comprobante */}
          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-sec)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tipo</label>
            <select value={filterTipo} onChange={e => setFilterTipo(e.target.value)} style={inputStyle}>
              {TIPOS_COMPROBANTE.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Monto mínimo */}
          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-sec)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Valor mín.</label>
            <div style={{ position: 'relative' }}>
              <DollarSign size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-sec)' }} />
              <input
                type="number"
                min="0"
                step="0.01"
                value={filterMontoMin}
                onChange={e => setFilterMontoMin(e.target.value)}
                placeholder="0.00"
                style={{ ...inputStyle, paddingLeft: 28 }}
              />
            </div>
          </div>

          {/* Monto máximo */}
          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-sec)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Valor máx.</label>
            <div style={{ position: 'relative' }}>
              <DollarSign size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-sec)' }} />
              <input
                type="number"
                min="0"
                step="0.01"
                value={filterMontoMax}
                onChange={e => setFilterMontoMax(e.target.value)}
                placeholder="∞"
                style={{ ...inputStyle, paddingLeft: 28 }}
              />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
