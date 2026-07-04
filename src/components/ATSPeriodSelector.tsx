import React from 'react';
import { Calendar, RefreshCw, FileSpreadsheet, FileDown } from 'lucide-react';

interface ATSPeriodSelectorProps {
  mes: number;
  setMes: (v: number) => void;
  anio: number;
  setAnio: (v: number) => void;
  fetchData: () => void;
  generarExcel: () => void;
  generarXML: () => void;
  docsLength: number;
  hasCriticalErrors: boolean;
  MESES: string[];
}

export const ATSPeriodSelector: React.FC<ATSPeriodSelectorProps> = ({
  mes,
  setMes,
  anio,
  setAnio,
  fetchData,
  generarExcel,
  generarXML,
  docsLength,
  hasCriticalErrors,
  MESES
}) => {
  const disableDownload = docsLength === 0 || hasCriticalErrors;

  return (
    <div className="glass-card" style={{ padding: '20px 24px', marginBottom: 24, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
      <Calendar size={18} style={{ color: 'var(--primary)' }} />
      <select value={mes} onChange={e => setMes(+e.target.value)} style={{ padding: '8px 14px', borderRadius: 10, border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-main)', fontWeight: 700 }}>
        {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
      </select>
      <select value={anio} onChange={e => setAnio(+e.target.value)} style={{ padding: '8px 14px', borderRadius: 10, border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-main)', fontWeight: 700 }}>
        {[2023, 2024, 2025, 2026].map(y => <option key={y}>{y}</option>)}
      </select>
      <button onClick={fetchData} className="btn" style={{ padding: '8px 14px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
        <RefreshCw size={15} /> Cargar Periodo
      </button>
      <div style={{ flex: 1 }} />
      <button
        onClick={generarExcel}
        disabled={disableDownload}
        className="btn"
        style={{ padding: '10px 22px', borderRadius: 14, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8, opacity: disableDownload ? 0.5 : 1, border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-main)' }}
      >
        <FileSpreadsheet size={18} style={{ color: '#10b981' }} /> Descargar ATS Excel
      </button>
      <button
        onClick={generarXML}
        disabled={disableDownload}
        className="btn btn-primary"
        style={{ padding: '10px 22px', borderRadius: 14, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8, opacity: disableDownload ? 0.5 : 1 }}
      >
        <FileDown size={18} /> Descargar ATS XML
      </button>
    </div>
  );
};
