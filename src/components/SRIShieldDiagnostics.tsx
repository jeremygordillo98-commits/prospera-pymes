import React from 'react';
import { ShieldAlert, CheckCircle2 } from 'lucide-react';

interface SRIShieldDiagnosticsProps {
  alertasCriticas: string[];
  advertencias: string[];
  docsLength: number;
}

export const SRIShieldDiagnostics: React.FC<SRIShieldDiagnosticsProps> = ({
  alertasCriticas,
  advertencias,
  docsLength
}) => {
  if (alertasCriticas.length === 0 && advertencias.length === 0) {
    if (docsLength > 0) {
      return (
        <div style={{ background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: 20, padding: '20px 24px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12, color: '#10b981', fontWeight: 800 }}>
          <CheckCircle2 size={20} /> ¡Tu ATS cumple con los requisitos iniciales del SRI para descarga!
        </div>
      );
    }
    return null;
  }

  return (
    <div style={{ background: 'rgba(239, 68, 68, 0.05)', border: `1px solid ${alertasCriticas.length > 0 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`, borderRadius: 20, padding: '20px 24px', marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 900, color: alertasCriticas.length > 0 ? '#ef4444' : 'var(--warning)', marginBottom: 12 }}>
        <ShieldAlert size={20} /> Diagnóstico Tributario Inteligente (Pre-Auditoría)
      </div>

      {alertasCriticas.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ color: '#ef4444', fontSize: '0.85rem', fontWeight: 800, marginBottom: 6 }}>🚨 ERRORES CRÍTICOS (Impiden la descarga):</div>
          {alertasCriticas.map((err, i) => (
            <p key={i} style={{ margin: '4px 0', fontSize: '0.82rem', color: 'var(--text-main)', paddingLeft: 12 }}>• {err}</p>
          ))}
        </div>
      )}

      {advertencias.length > 0 && (
        <div>
          <div style={{ color: 'var(--warning)', fontSize: '0.85rem', fontWeight: 800, marginBottom: 6 }}>⚠️ ADVERTENCIAS (Permiten descarga con cautela):</div>
          {advertencias.map((warn, i) => (
            <p key={i} style={{ margin: '4px 0', fontSize: '0.82rem', color: 'var(--text-sec)', paddingLeft: 12 }}>• {warn}</p>
          ))}
        </div>
      )}
    </div>
  );
};
