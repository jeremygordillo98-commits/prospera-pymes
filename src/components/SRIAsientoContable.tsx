import React from 'react';
import { Loader2 } from 'lucide-react';

interface Props {
  loadingViewingMovs: boolean;
  viewingMovements: any[];
  getAccountLabel: (idCuenta: string) => string;
}

export const SRIAsientoContable: React.FC<Props> = ({
  loadingViewingMovs,
  viewingMovements,
  getAccountLabel
}) => {
  return (
    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.04)' }}>
      <h4 style={{ margin: '0 0 16px 0', fontSize: '1rem', fontWeight: 800, color: 'var(--primary)' }}>
        Asiento Contable Relacionado
      </h4>
      {loadingViewingMovs ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-sec)', fontSize: '0.85rem' }}>
          <Loader2 className="animate-spin" size={16} /> Cargando movimientos...
        </div>
      ) : viewingMovements.length === 0 ? (
        <div style={{ color: 'var(--text-sec)', fontSize: '0.85rem', fontStyle: 'italic' }}>
          No se encontraron movimientos contables registrados.
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', color: 'var(--text-sec)' }}>
              <th style={{ textAlign: 'left', padding: '6px 0', fontWeight: 'bold' }}>Cuenta</th>
              <th style={{ textAlign: 'right', padding: '6px 0', width: '70px', fontWeight: 'bold' }}>Debe</th>
              <th style={{ textAlign: 'right', padding: '6px 0', width: '70px', fontWeight: 'bold' }}>Haber</th>
            </tr>
          </thead>
          <tbody>
            {viewingMovements.map((m, idx) => (
              <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                <td style={{ padding: '8px 0', fontWeight: 500, color: '#ffffff' }}>
                  {getAccountLabel(m.id_cuenta)}
                </td>
                <td style={{ padding: '8px 0', textAlign: 'right', color: m.debe > 0 ? '#ffffff' : 'var(--text-sec)' }}>
                  {m.debe > 0 ? `$${m.debe.toFixed(2)}` : '—'}
                </td>
                <td style={{ padding: '8px 0', textAlign: 'right', color: m.haber > 0 ? '#ffffff' : 'var(--text-sec)' }}>
                  {m.haber > 0 ? `$${m.haber.toFixed(2)}` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};
