import React from 'react';
import { Search, Loader2, RefreshCw } from 'lucide-react';

interface AsientosHistoryTableProps {
  filteredHistory: any[];
  historySearch: string;
  setHistorySearch: (val: string) => void;
  fetchHistory: () => void;
  loadingHistory: boolean;
  onViewDetails: (tx: any) => void;
  onEdit: (tx: any) => void;
  onAnular: (tx: any) => void;
}

export const AsientosHistoryTable: React.FC<AsientosHistoryTableProps> = ({
  filteredHistory,
  historySearch,
  setHistorySearch,
  fetchHistory,
  loadingHistory,
  onViewDetails,
  onEdit,
  onAnular
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontWeight: 800, flex: 1, minWidth: 200 }}>
          Historial de Asientos
          <span style={{ marginLeft: 10, fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-sec)', background: 'var(--primary-light)', padding: '3px 10px', borderRadius: 20 }}>
            {filteredHistory.length}
          </span>
        </h3>
        <div style={{ position: 'relative', width: '320px' }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-sec)' }} />
          <input
            value={historySearch}
            onChange={e => setHistorySearch(e.target.value)}
            placeholder="Buscar por concepto, número o tercero..."
            style={{ width: '100%', paddingLeft: 36, padding: '10px 12px 10px 36px', borderRadius: 12, border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-main)', fontSize: '0.9rem', boxSizing: 'border-box', outline: 'none' }}
          />
        </div>
        <button 
          type="button" 
          onClick={fetchHistory} 
          className="btn" 
          style={{ padding: 12, borderRadius: 12 }} 
          disabled={loadingHistory}
        >
          {loadingHistory ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
        </button>
      </div>

      {loadingHistory ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} style={{ height: 64, borderRadius: 12, background: 'rgba(255,255,255,0.04)', animation: 'pulse 1.5s ease-in-out infinite' }} />
          ))}
        </div>
      ) : (
        <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', minWidth: 700 }}>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Nº Comprobante</th>
                  <th>Concepto / Tercero</th>
                  <th style={{ textAlign: 'right' }}>Monto</th>
                  <th style={{ textAlign: 'center' }}>Estado</th>
                  <th style={{ textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.map((tx) => {
                  const isAnulado = tx.tipo_comprobante === 'Anulado';
                  const match = tx.concepto.match(/^\[ANULADO\]\s*Motivo:\s*(.*?)\s*\|\s*Fecha:\s*(.*?)\s*\|\s*(.*)$/);
                  const conceptoDisplay = isAnulado && match ? match[3] : (isAnulado ? tx.concepto.replace(/^\[ANULADO\]\s*/, '') : tx.concepto);
                  const totalMonto = tx.movimientos?.reduce((acc: number, m: any) => acc + (m.debe || 0), 0) || 0;
                  return (
                    <tr key={tx.id} style={{ opacity: isAnulado ? 0.6 : 1 }}>
                      <td style={{ padding: '14px 16px', fontWeight: 600 }}>{tx.fecha}</td>
                      <td style={{ padding: '14px 16px', fontWeight: 700 }}>#{tx.numero_comprobante}</td>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: 800 }}>{conceptoDisplay}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-sec)' }}>{tx.entidades?.razon_social || 'Sin tercero'}</div>
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 800, color: 'var(--primary)' }}>
                        ${totalMonto.toFixed(2)}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <span style={{ 
                          fontSize: '0.7rem', 
                          textTransform: 'uppercase', 
                          padding: '4px 8px', 
                          borderRadius: 999, 
                          background: isAnulado ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)', 
                          color: isAnulado ? 'var(--error)' : 'var(--success)', 
                          fontWeight: 800 
                        }}>
                          {isAnulado ? 'Anulado' : 'Aplicado'}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                          <button 
                            type="button" 
                            onClick={() => onViewDetails(tx)}
                            className="btn" 
                            style={{ fontSize: '0.75rem', padding: '6px 12px' }}
                          >
                            Ver
                          </button>
                          {!isAnulado && (
                            <>
                              <button 
                                type="button" 
                                onClick={() => onEdit(tx)}
                                className="btn" 
                                style={{ fontSize: '0.75rem', padding: '6px 12px', background: 'var(--primary-light)', color: 'var(--primary)' }}
                              >
                                Editar
                              </button>
                              <button 
                                type="button" 
                                onClick={() => onAnular(tx)}
                                className="btn" 
                                style={{ fontSize: '0.75rem', padding: '6px 12px', color: 'var(--error)', background: 'rgba(239, 68, 68, 0.05)' }}
                              >
                                Anular
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredHistory.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: 40, textAlign: 'center', color: 'var(--text-sec)', fontWeight: 600 }}>
                      No se encontraron asientos manuales registrados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
