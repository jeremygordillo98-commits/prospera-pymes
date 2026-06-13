import React from 'react';
import { FileText, Ban, Download } from 'lucide-react';

interface Props {
  selectedTxsSize: number;
  handleBulkAnular: () => void;
  filteredTransactionsLength: number;
  selectedTxsSizeEqualsFilteredLength: boolean;
  handleSelectAll: () => void;
  filterDate: string;
  setFilterDate: (val: string) => void;
  exportToExcel: () => void;
  exportToPDF: () => void;
}

export const LibroDiarioToolbar: React.FC<Props> = ({
  selectedTxsSize,
  handleBulkAnular,
  filteredTransactionsLength,
  selectedTxsSizeEqualsFilteredLength,
  handleSelectAll,
  filterDate,
  setFilterDate,
  exportToExcel,
  exportToPDF
}) => {
  return (
    <header className="flex-between" style={{ marginBottom: '40px' }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', fontWeight: 800, textTransform: 'uppercase', fontSize: '0.8rem', letterSpacing: '2px', marginBottom: '8px' }}>
          <FileText size={14} /> Contabilidad Oficial
        </div>
        <h1 className="h1" style={{ fontSize: '2.5rem', fontWeight: 900 }}>Libro Diario</h1>
        <p className="text-sec" style={{ fontSize: '1.1rem' }}>Registro cronológico de todos los movimientos contables.</p>
      </div>

      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        {selectedTxsSize > 0 && (
          <button className="btn" onClick={handleBulkAnular} style={{ background: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '10px 14px' }}>
            <Ban size={18} /> <span className="hide-mobile">Anular ({selectedTxsSize})</span>
          </button>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '10px 14px', background: 'var(--input-bg)', borderRadius: '12px', border: '1px solid var(--border-color)' }} onClick={handleSelectAll}>
          <input
            type="checkbox"
            readOnly
            checked={filteredTransactionsLength > 0 && selectedTxsSizeEqualsFilteredLength}
            style={{ width: '16px', height: '16px', accentColor: 'var(--primary)', cursor: 'pointer' }}
          />
          <span style={{ fontSize: '0.85rem', fontWeight: 600 }} className="hide-mobile">Seleccionar Todo</span>
        </div>

        <div style={{ position: 'relative' }}>
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            style={{ padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-main)', outline: 'none' }}
          />
        </div>
        {filterDate && (
          <button onClick={() => setFilterDate('')} className="btn glass-card" style={{ padding: '10px' }}>Limpiar</button>
        )}
        <button className="btn" onClick={exportToPDF} disabled={filteredTransactionsLength === 0} style={{ padding: '10px 14px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 800 }}>
          <Download size={18} /> <span className="hide-mobile">Exportar a PDF</span>
        </button>
        <button className="btn btn-primary" onClick={exportToExcel} disabled={filteredTransactionsLength === 0}>
          <Download size={18} /> <span className="hide-mobile">Exportar a Excel</span>
        </button>
      </div>
    </header>
  );
};
