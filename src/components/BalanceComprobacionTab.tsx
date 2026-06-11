import React from 'react';
import { CheckCircle2, XCircle, Calendar, Download, ChevronDown, ChevronRight } from 'lucide-react';

interface Props {
  filteredLedger: any[];
  expandedAccounts: Record<string, boolean>;
  toggleAccount: (code: string) => void;
  isVisibleByParentCollapse: (code: string) => boolean;
  cuadrado: boolean;
  totalDebe: number;
  totalHaber: number;
  searchTerm: string;
  setSearchTerm: (val: string) => void;
  desde: string;
  setDesde: (val: string) => void;
  hasta: string;
  setHasta: (val: string) => void;
  soloConMov: boolean;
  setSoloConMov: (val: boolean) => void;
  exportBalanceCSV: () => void;
  exportBalancePDF: () => void;
}

export const BalanceComprobacionTab: React.FC<Props> = ({
  filteredLedger,
  expandedAccounts,
  toggleAccount,
  isVisibleByParentCollapse,
  cuadrado,
  totalDebe,
  totalHaber,
  searchTerm,
  setSearchTerm,
  desde,
  setDesde,
  hasta,
  setHasta,
  soloConMov,
  setSoloConMov,
  exportBalanceCSV,
  exportBalancePDF
}) => {
  return (
    <section className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <h3 style={{ margin: 0, flex: 1 }}>Balance de Comprobación (Sumas y Saldos)</h3>
        <input
          type="text"
          placeholder="Buscar cuenta o código..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ padding: '7px 12px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-main)', outline: 'none', fontSize: '0.82rem', width: '180px' }}
        />
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 20, fontWeight: 800, fontSize: '0.82rem',
          background: cuadrado ? 'rgba(16,185,129,0.12)' : totalDebe === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(239,68,68,0.1)',
          color: cuadrado ? 'var(--success)' : totalDebe === 0 ? 'var(--text-sec)' : 'var(--error)'
        }}>
          {cuadrado ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
          {cuadrado ? 'Cuadrado ✓' : totalDebe === 0 ? 'Sin datos' : `Descuadre Período: $${Math.abs(totalDebe - totalHaber).toFixed(2)}`}
        </div>
        
        <Calendar size={14} style={{ color: 'var(--text-sec)' }} />
        <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
          style={{ padding: '7px 10px', borderRadius: 10, border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-main)', fontSize: '0.82rem' }} />
        <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
          style={{ padding: '7px 10px', borderRadius: 10, border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-main)', fontSize: '0.82rem' }} />
        {(desde || hasta) && <button onClick={() => { setDesde(''); setHasta(''); }} style={{ background: 'none', border: 'none', color: 'var(--text-sec)', cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem' }}>✕</button>}
        
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', color: 'var(--text-sec)', cursor: 'pointer', userSelect: 'none' }}>
          <input type="checkbox" checked={soloConMov} onChange={e => setSoloConMov(e.target.checked)} style={{ accentColor: 'var(--primary)' }} />
          Solo con movimiento
        </label>
        <button onClick={exportBalanceCSV} className="btn" style={{ padding: '7px 14px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', fontWeight: 700 }}>
          <Download size={14} /> CSV
        </button>
        <button onClick={exportBalancePDF} className="btn btn-primary" style={{ padding: '7px 14px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', fontWeight: 700 }}>
          <Download size={14} /> PDF
        </button>
      </div>
      
      <div style={{ overflowX: 'auto' }}>
        <table className="data-table" style={{ minWidth: 900 }}>
          <thead>
            <tr>
              <th>Código</th>
              <th>Cuenta</th>
              <th style={{ textAlign: 'right' }}>Saldo Inicial</th>
              <th style={{ textAlign: 'right' }}>Debe (Período)</th>
              <th style={{ textAlign: 'right' }}>Haber (Período)</th>
              <th style={{ textAlign: 'right' }}>Saldo Final</th>
            </tr>
          </thead>
          <tbody>
            {filteredLedger.map((item) => {
              if (!isVisibleByParentCollapse(item.codigo_cuenta)) return null;
              const isExpanded = expandedAccounts[item.codigo_cuenta] !== false;
              const paddingLeft = (item.codigo_cuenta.split('.').length - 1) * 16 + 12;

              return (
                <tr key={item.id} style={{ fontWeight: item.isParent ? 700 : 400, background: item.isParent ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
                  <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: 'var(--primary)' }}>{item.codigo_cuenta}</td>
                  <td style={{ padding: `10px 12px 10px ${paddingLeft}px` }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {item.isParent && (
                        <span onClick={() => toggleAccount(item.codigo_cuenta)} style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', color: 'var(--primary)' }}>
                          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </span>
                      )}
                      {item.nombre}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: item.saldoIni !== 0 ? 'var(--text-main)' : 'var(--text-sec)' }}>
                    ${item.saldoIni.toFixed(2)}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: item.debe > 0 ? 'var(--text-main)' : 'var(--text-sec)' }}>
                    ${item.debe.toFixed(2)}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: item.haber > 0 ? 'var(--text-main)' : 'var(--text-sec)' }}>
                    ${item.haber.toFixed(2)}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 900, color: 'var(--primary)' }}>
                    ${item.saldo.toFixed(2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ background: 'var(--primary-light)', fontWeight: 900, borderTop: '2px solid var(--border-color)' }}>
              <td colSpan={3} style={{ padding: '12px', textAlign: 'right', fontSize: '0.82rem', textTransform: 'uppercase' }}>TOTALES DEL PERÍODO</td>
              <td style={{ padding: '12px', textAlign: 'right', color: 'var(--primary)' }}>${totalDebe.toFixed(2)}</td>
              <td style={{ padding: '12px', textAlign: 'right', color: 'var(--primary)' }}>${totalHaber.toFixed(2)}</td>
              <td style={{ padding: '12px', textAlign: 'right', color: cuadrado ? 'var(--success)' : 'var(--error)' }}>
                {cuadrado ? '✓ Cuadrado' : `Δ $${Math.abs(totalDebe - totalHaber).toFixed(2)}`}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
};
