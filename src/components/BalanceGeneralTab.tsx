import React from 'react';
import { Download, ChevronDown, ChevronRight, CheckCircle2, XCircle } from 'lucide-react';
import { generatePDFReport } from '../utils/pdfGenerator';

interface Props {
  empresaId: string;
  filteredLedger: any[];
  rootAccounts: any[];
  expandedAccounts: Record<string, boolean>;
  toggleAccount: (code: string) => void;
  isVisibleByParentCollapse: (code: string) => boolean;
  desde: string;
  hasta: string;
  permisoReportesPdf: boolean;
  onPremiumBlock: () => void;
}

export const BalanceGeneralTab: React.FC<Props> = ({
  empresaId,
  filteredLedger,
  rootAccounts,
  expandedAccounts,
  toggleAccount,
  isVisibleByParentCollapse,
  desde,
  hasta,
  permisoReportesPdf,
  onPremiumBlock
}) => {
  // Calcular utilidad del período actual
  const decimals = parseInt(localStorage.getItem('pref_decimals') || '2', 10);
  const totalIng = rootAccounts.filter(i => i.tipo === 'Ingreso').reduce((s, i) => s + i.saldo, 0);
  const totalGas = rootAccounts.filter(i => i.tipo === 'Gasto').reduce((s, i) => s + i.saldo, 0);
  const utilidadPeriodo = totalIng - totalGas;

  const tieneCuentaResultado = filteredLedger.some(acc => acc.codigo_cuenta === '3.1.7.1');

  const activos = filteredLedger.filter(i => i.tipo === 'Activo');
  const pasivos = filteredLedger.filter(i => i.tipo === 'Pasivo');
  const patrimonio = filteredLedger.filter(i => i.tipo === 'Patrimonio');

  // Sumatorias raíces
  const totalActivos = rootAccounts.filter(i => i.tipo === 'Activo').reduce((s, i) => s + i.saldo, 0);
  const totalPasivos = rootAccounts.filter(i => i.tipo === 'Pasivo').reduce((s, i) => s + i.saldo, 0);
  const totalPatrimonioPlano = rootAccounts.filter(i => i.tipo === 'Patrimonio').reduce((s, i) => s + i.saldo, 0);
  
  // Sumar la utilidad al patrimonio de forma dinámica (si no está ya integrada en la cuenta 3.1.7.1)
  const totalPatrimonioConUtilidad = tieneCuentaResultado ? totalPatrimonioPlano : (totalPatrimonioPlano + utilidadPeriodo);
  const totalPasivoPatrimonio = totalPasivos + totalPatrimonioConUtilidad;

  const balanceCuadrado = Math.abs(totalActivos - totalPasivoPatrimonio) < 0.01;

  const escapeHtml = (str: string | undefined | null) => {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  const exportBG = () => {
    if (!permisoReportesPdf) {
      onPremiumBlock();
      return;
    }
    const headerRow = `<tr><th>Grupo</th><th>Código</th><th>Cuenta</th><th>Saldo</th></tr>`;
    const dataRows: string[] = [];

    // Total Activos row
    dataRows.push(`<tr><td style="font-weight:bold; color: #1e3a8a;">Activos</td><td></td><td></td><td class="number" style="font-weight:bold; color: #1e3a8a;">${totalActivos.toFixed(decimals)}</td></tr>`);
    
    activos.forEach(i => {
      dataRows.push(`<tr>
        <td>Activo</td>
        <td class="text">${escapeHtml(i.codigo_cuenta)}</td>
        <td>${escapeHtml(i.nombre)}</td>
        <td class="number">${Number(i.saldo || 0).toFixed(decimals)}</td>
      </tr>`);
    });
    
    // Total Pasivos row
    dataRows.push(`<tr><td style="font-weight:bold; color: #1e3a8a;">Pasivos</td><td></td><td></td><td class="number" style="font-weight:bold; color: #1e3a8a;">${totalPasivos.toFixed(decimals)}</td></tr>`);
    
    pasivos.forEach(i => {
      dataRows.push(`<tr>
        <td>Pasivo</td>
        <td class="text">${escapeHtml(i.codigo_cuenta)}</td>
        <td>${escapeHtml(i.nombre)}</td>
        <td class="number">${Number(i.saldo || 0).toFixed(decimals)}</td>
      </tr>`);
    });
    
    // Total Patrimonio row
    dataRows.push(`<tr><td style="font-weight:bold; color: #1e3a8a;">Patrimonio</td><td></td><td></td><td class="number" style="font-weight:bold; color: #1e3a8a;">${totalPatrimonioConUtilidad.toFixed(decimals)}</td></tr>`);
    
    patrimonio.forEach(i => {
      dataRows.push(`<tr>
        <td>Patrimonio</td>
        <td class="text">${escapeHtml(i.codigo_cuenta)}</td>
        <td>${escapeHtml(i.nombre)}</td>
        <td class="number">${Number(i.saldo || 0).toFixed(decimals)}</td>
      </tr>`);
    });
    
    if (!tieneCuentaResultado) {
      dataRows.push(`<tr>
        <td style="font-weight:bold;">Utilidad del Ejercicio (Dinámica)</td>
        <td></td>
        <td></td>
        <td class="number" style="font-weight:bold;">${utilidadPeriodo.toFixed(decimals)}</td>
      </tr>`);
    }
    
    dataRows.push(`<tr>
      <td style="font-weight:bold; color: #111827;">TOTAL PASIVO + PATRIMONIO</td>
      <td></td>
      <td></td>
      <td class="number" style="font-weight:bold; color: #111827;">${totalPasivoPatrimonio.toFixed(decimals)}</td>
    </tr>`);

    const excelHtml = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta http-equiv="content-type" content="application/vnd.ms-excel; charset=UTF-8">
        <style>
          table { border-collapse: collapse; }
          th, td { border: 0.5pt solid #D1D5DB; padding: 6px 10px; font-family: 'Segoe UI', Calibri, sans-serif; font-size: 10pt; }
          th { background-color: #F3F4F6; font-weight: bold; color: #374151; }
          .text { mso-number-format:"\\@"; }
          .number { mso-number-format:"0\\.00"; text-align: right; }
          .title { font-size: 16pt; font-weight: bold; border: none; color: #111827; }
          .subtitle { font-size: 10.5pt; color: #4B5563; border: none; }
        </style>
      </head>
      <body>
        <table>
          <tr><td class="title" colspan="4">Balance General Clasificado</td></tr>
          <tr><td class="subtitle" colspan="4">Período: ${escapeHtml(desde || 'Inicio')} al ${escapeHtml(hasta || 'Hoy')}</td></tr>
          <tr><td class="subtitle" colspan="4">Descargado el: ${escapeHtml(new Date().toLocaleDateString('es-EC'))} ${escapeHtml(new Date().toLocaleTimeString('es-EC'))}</td></tr>
          <tr><td style="border:none;"></td></tr>
          ${headerRow}
          ${dataRows.join('\n')}
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([excelHtml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Balance_General_${desde || 'inicio'}_${hasta || 'fin'}.xls`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const exportBGPDF = async () => {
    if (!permisoReportesPdf) {
      onPremiumBlock();
      return;
    }
    const columns = ['Código', 'Cuenta', 'Monto'];
    const rows: any[][] = [];

    // Activos
    rows.push([
      { content: 'ACTIVOS', colSpan: 3, styles: { fillColor: [240, 245, 255], fontStyle: 'bold', textColor: [99, 102, 241] } }
    ]);
    activos.forEach(i => {
      rows.push([i.codigo_cuenta, i.nombre, `$${i.saldo.toFixed(decimals)}`]);
    });
    rows.push([
      { content: 'TOTAL ACTIVOS', colSpan: 2, styles: { fontStyle: 'bold' } },
      `$${totalActivos.toFixed(decimals)}`
    ]);

    // Pasivos
    rows.push([
      { content: 'PASIVOS', colSpan: 3, styles: { fillColor: [255, 251, 235], fontStyle: 'bold', textColor: [245, 158, 11] } }
    ]);
    pasivos.forEach(i => {
      rows.push([i.codigo_cuenta, i.nombre, `$${i.saldo.toFixed(decimals)}`]);
    });
    rows.push([
      { content: 'TOTAL PASIVOS', colSpan: 2, styles: { fontStyle: 'bold' } },
      `$${totalPasivos.toFixed(decimals)}`
    ]);

    // Patrimonio
    rows.push([
      { content: 'PATRIMONIO', colSpan: 3, styles: { fillColor: [243, 244, 246], fontStyle: 'bold', textColor: [139, 92, 246] } }
    ]);
    patrimonio.forEach(i => {
      rows.push([i.codigo_cuenta, i.nombre, `$${i.saldo.toFixed(decimals)}`]);
    });
    if (!tieneCuentaResultado) {
      rows.push([
        '3.99.99',
        'Resultado Neto del Ejercicio (Dinámico)',
        `$${utilidadPeriodo.toFixed(decimals)}`
      ]);
    }
    rows.push([
      { content: 'TOTAL PATRIMONIO', colSpan: 2, styles: { fontStyle: 'bold' } },
      `$${totalPatrimonioConUtilidad.toFixed(decimals)}`
    ]);

    // Total Pasivo + Patrimonio
    rows.push([
      { content: 'TOTAL PASIVO + PATRIMONIO', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [255, 251, 235] } },
      { content: `$${totalPasivoPatrimonio.toFixed(decimals)}`, styles: { fontStyle: 'bold', fillColor: [255, 251, 235] } }
    ]);

    let subtitle = 'Balance General Clasificado';
    if (desde || hasta) subtitle += ` (${desde || 'Inicio'} al ${hasta || 'Hoy'})`;

    await generatePDFReport(empresaId, 'Balance General', subtitle, columns, rows, []);
  };

  const renderTree = (items: typeof assets, color: string) => {
    return items.map(item => {
      if (!isVisibleByParentCollapse(item.codigo_cuenta)) return null;
      const isExpanded = expandedAccounts[item.codigo_cuenta] !== false;
      const paddingLeft = (item.codigo_cuenta.split('.').length - 1) * 16 + 12;

      return (
        <div key={item.id} style={{ 
          padding: '10px 20px', 
          paddingLeft,
          borderBottom: '1px solid rgba(255,255,255,0.03)', 
          display: 'flex', 
          justifyContent: 'space-between', 
          fontSize: '0.88rem',
          fontWeight: item.isParent ? 700 : 400,
          background: item.isParent ? 'rgba(255,255,255,0.01)' : 'transparent'
        }}>
          <span style={{ color: 'var(--text-sec)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            {item.isParent && (
              <span onClick={() => toggleAccount(item.codigo_cuenta)} style={{ cursor: 'pointer', color: 'var(--primary)', display: 'inline-flex', alignItems: 'center' }}>
                {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </span>
            )}
            {item.codigo_cuenta} · {item.nombre}
          </span>
          <strong style={{ color }}>${item.saldo.toFixed(decimals)}</strong>
        </div>
      );
    });
  };

  const assets = activos;

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="glass-card" style={{ padding: '14px 20px', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <h3 style={{ margin: 0, flex: 1 }}>Balance General Clasificado</h3>
        <div style={{
          padding: '6px 14px', borderRadius: 20, fontWeight: 800, fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 6,
          background: balanceCuadrado ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.1)',
          color: balanceCuadrado ? 'var(--success)' : 'var(--error)'
        }}>
          {balanceCuadrado ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
          {balanceCuadrado ? 'A = P + Pat Cuadrado ✓' : `Diferencia Ecuación: $${Math.abs(totalActivos - totalPasivoPatrimonio).toFixed(decimals)}`}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={exportBG} className="btn" style={{ padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', fontWeight: 700 }}>
            <Download size={14} /> CSV
          </button>
          <button onClick={exportBGPDF} className="btn btn-primary" style={{ padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', fontWeight: 700 }}>
            <Download size={14} /> PDF
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(340px,1fr))', gap: 20 }}>
        {/* SECCIÓN ACTIVOS (Corriente + No Corriente) */}
        <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', background: 'rgba(99,102,241,0.08)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 800, color: 'var(--primary)' }}>ACTIVOS</span>
            <span style={{ fontWeight: 900, color: 'var(--primary)', fontSize: '1.1rem' }}>${totalActivos.toFixed(decimals)}</span>
          </div>
          <div style={{ maxHeight: 440, overflowY: 'auto' }}>
            {renderTree(activos, 'var(--primary)')}
          </div>
          <div style={{ padding: '14px 20px', background: 'rgba(99,102,241,0.03)', borderTop: '2px solid rgba(99,102,241,0.2)', display: 'flex', justifyContent: 'space-between', fontWeight: 900 }}>
            <span>TOTAL ACTIVOS</span>
            <span style={{ color: 'var(--primary)' }}>${totalActivos.toFixed(decimals)}</span>
          </div>
        </div>

        {/* SECCIÓN PASIVOS + PATRIMONIO */}
        <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', background: 'rgba(245,158,11,0.08)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 800, color: 'var(--warning)' }}>PASIVOS & PATRIMONIO</span>
            <span style={{ fontWeight: 900, color: 'var(--warning)', fontSize: '1.1rem' }}>${totalPasivoPatrimonio.toFixed(decimals)}</span>
          </div>
          <div style={{ maxHeight: 440, overflowY: 'auto' }}>
            <div style={{ padding: '8px 20px', fontWeight: 800, fontSize: '0.75rem', letterSpacing: 0.5, background: 'rgba(255,255,255,0.02)', color: 'var(--text-sec)' }}>PASIVOS</div>
            {renderTree(pasivos, 'var(--warning)')}

            <div style={{ padding: '8px 20px', fontWeight: 800, fontSize: '0.75rem', letterSpacing: 0.5, background: 'rgba(255,255,255,0.02)', color: 'var(--text-sec)', borderTop: '1px solid var(--border-color)' }}>PATRIMONIO</div>
            {renderTree(patrimonio, '#8b5cf6')}

            {/* Fila Virtual de Utilidad del Ejercicio (solo si no existe cuenta contable real) */}
            {!tieneCuentaResultado && (
              <div style={{ padding: '10px 20px 10px 28px', borderBottom: '1px solid rgba(255,255,255,0.03)', display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', fontWeight: 700, background: 'rgba(16,185,129,0.03)' }}>
                <span style={{ color: 'var(--success)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  3.99.99 · Resultado Neto del Ejercicio (Dinámico)
                </span>
                <strong style={{ color: 'var(--success)' }}>${utilidadPeriodo.toFixed(decimals)}</strong>
              </div>
            )}
          </div>
          <div style={{ padding: '14px 20px', background: 'rgba(245,158,11,0.03)', borderTop: '2px solid rgba(245,158,11,0.2)', display: 'flex', justifyContent: 'space-between', fontWeight: 900 }}>
            <span>TOTAL PASIVO + PATRIMONIO</span>
            <span style={{ color: 'var(--warning)' }}>${totalPasivoPatrimonio.toFixed(decimals)}</span>
          </div>
        </div>
      </div>
    </section>
  );
};
