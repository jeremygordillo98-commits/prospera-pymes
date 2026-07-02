import React from 'react';
import { Download, ChevronDown, ChevronRight } from 'lucide-react';
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

export const EstadoResultadosTab: React.FC<Props> = ({
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
  const decimals = parseInt(localStorage.getItem('pref_decimals') || '2', 10);
  // Mapear el ledger y las cuentas raíz para usar únicamente los movimientos del período (haber - debe) en ingresos y gastos
  const mappedLedger = React.useMemo(() => {
    return filteredLedger.map(item => {
      if (item.tipo === 'Ingreso') {
        return { ...item, saldo: item.haber - item.debe };
      }
      if (item.tipo === 'Gasto') {
        return { ...item, saldo: item.debe - item.haber };
      }
      return item;
    });
  }, [filteredLedger]);

  const mappedRootAccounts = React.useMemo(() => {
    return rootAccounts.map(item => {
      if (item.tipo === 'Ingreso') {
        return { ...item, saldo: item.haber - item.debe };
      }
      if (item.tipo === 'Gasto') {
        return { ...item, saldo: item.debe - item.haber };
      }
      return item;
    });
  }, [rootAccounts]);

  const ingresos = mappedLedger.filter(i => i.tipo === 'Ingreso');
  const gastos = mappedLedger.filter(i => i.tipo === 'Gasto');
  
  // Totales de primer nivel
  const totalIng = mappedRootAccounts.filter(i => i.tipo === 'Ingreso').reduce((s, i) => s + i.saldo, 0);
  const totalGas = mappedRootAccounts.filter(i => i.tipo === 'Gasto').reduce((s, i) => s + i.saldo, 0);
  
  const utilidadOperativa = totalIng - totalGas;
  const partTrabajadores = utilidadOperativa > 0 ? utilidadOperativa * 0.15 : 0;
  const baseIR = utilidadOperativa > 0 ? utilidadOperativa - partTrabajadores : 0;
  const impuestoRenta = baseIR > 0 ? baseIR * 0.25 : 0;
  const utilidadNeta = utilidadOperativa - partTrabajadores - impuestoRenta;

  const escapeHtml = (str: string | undefined | null) => {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  const exportER = () => {
    if (!permisoReportesPdf) {
      onPremiumBlock();
      return;
    }
    const headerRow = `<tr><th>Estructura</th><th>Código</th><th>Cuenta</th><th>Valor</th></tr>`;
    const dataRows: string[] = [];

    // Ingresos
    dataRows.push(`<tr><td style="font-weight:bold; color: #1e3a8a;">Ingresos Operacionales</td><td></td><td></td><td class="number" style="font-weight:bold; color: #1e3a8a;">${totalIng.toFixed(decimals)}</td></tr>`);
    ingresos.forEach(i => {
      dataRows.push(`<tr>
        <td></td>
        <td class="text">${escapeHtml(i.codigo_cuenta)}</td>
        <td>${escapeHtml(i.nombre)}</td>
        <td class="number">${Number(i.saldo || 0).toFixed(decimals)}</td>
      </tr>`);
    });

    // Gastos
    dataRows.push(`<tr><td style="font-weight:bold; color: #1e3a8a;">Gastos Operacionales</td><td></td><td></td><td class="number" style="font-weight:bold; color: #1e3a8a;">${totalGas.toFixed(decimals)}</td></tr>`);
    gastos.forEach(i => {
      dataRows.push(`<tr>
        <td></td>
        <td class="text">${escapeHtml(i.codigo_cuenta)}</td>
        <td>${escapeHtml(i.nombre)}</td>
        <td class="number">${Number(i.saldo || 0).toFixed(decimals)}</td>
      </tr>`);
    });

    // Totales/Kpis
    dataRows.push(`<tr><td style="font-weight:bold; color: #111827;">Utilidad Operacional</td><td></td><td></td><td class="number" style="font-weight:bold; color: #111827;">${utilidadOperativa.toFixed(decimals)}</td></tr>`);
    dataRows.push(`<tr><td style="color: #374151;">(-) 15% Participación Trabajadores</td><td></td><td></td><td class="number" style="color: #374151;">${partTrabajadores.toFixed(decimals)}</td></tr>`);
    dataRows.push(`<tr><td style="color: #374151;">(-) 25% Impuesto a la Renta</td><td></td><td></td><td class="number" style="color: #374151;">${impuestoRenta.toFixed(decimals)}</td></tr>`);
    dataRows.push(`<tr><td style="font-weight:bold; color: #16a34a; font-size: 11pt;">UTILIDAD NETA DEL EJERCICIO</td><td></td><td></td><td class="number" style="font-weight:bold; color: #16a34a; font-size: 11pt;">${utilidadNeta.toFixed(decimals)}</td></tr>`);

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
          <tr><td class="title" colspan="4">Estado de Resultados en Cascada</td></tr>
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
    link.setAttribute("download", `Estado_Resultados_${desde || 'inicio'}_${hasta || 'fin'}.xls`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const exportERPDF = async () => {
    if (!permisoReportesPdf) {
      onPremiumBlock();
      return;
    }
    const columns = ['Código', 'Cuenta', 'Monto'];
    const rows: any[][] = [];

    // Ingresos
    rows.push([
      { content: 'INGRESOS OPERACIONALES', colSpan: 3, styles: { fillColor: [240, 253, 250], fontStyle: 'bold', textColor: [16, 185, 129] } }
    ]);
    ingresos.forEach(i => {
      rows.push([i.codigo_cuenta, i.nombre, `$${i.saldo.toFixed(decimals)}`]);
    });
    rows.push([
      { content: 'TOTAL INGRESOS OPERACIONALES', colSpan: 2, styles: { fontStyle: 'bold' } },
      `$${totalIng.toFixed(decimals)}`
    ]);

    // Gastos
    rows.push([
      { content: 'COSTOS Y GASTOS OPERACIONALES', colSpan: 3, styles: { fillColor: [254, 242, 242], fontStyle: 'bold', textColor: [239, 68, 68] } }
    ]);
    gastos.forEach(i => {
      rows.push([i.codigo_cuenta, i.nombre, `$${i.saldo.toFixed(decimals)}`]);
    });
    rows.push([
      { content: 'TOTAL COSTOS Y GASTOS', colSpan: 2, styles: { fontStyle: 'bold' } },
      `$${totalGas.toFixed(decimals)}`
    ]);

    // Utilidad
    rows.push([
      { content: '(=) UTILIDAD DE LA OPERACIÓN', colSpan: 2, styles: { fontStyle: 'bold' } },
      `$${utilidadOperativa.toFixed(decimals)}`
    ]);
    rows.push([
      { content: '(-) 15% Participación Trabajadores', colSpan: 2, styles: { textColor: [100, 100, 100] } },
      `-$${partTrabajadores.toFixed(decimals)}`
    ]);
    rows.push([
      { content: '(-) 25% Impuesto a la Renta', colSpan: 2, styles: { textColor: [100, 100, 100] } },
      `-$${impuestoRenta.toFixed(decimals)}`
    ]);
    rows.push([
      { content: '(=) RESULTADO NETO DEL EJERCICIO', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [240, 245, 250] } },
      `$${utilidadNeta.toFixed(decimals)}`
    ]);

    let subtitle = 'Estado de Resultados Integral';
    if (desde || hasta) subtitle += ` (${desde || 'Inicio'} al ${hasta || 'Hoy'})`;

    await generatePDFReport(empresaId, 'Estado de Resultados', subtitle, columns, rows, []);
  };

  const renderTree = (items: typeof ingresos, color: string) => {
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

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="glass-card" style={{ padding: '14px 20px', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <h3 style={{ margin: 0, flex: 1 }}>Estado de Resultados Integral</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={exportER} className="btn" style={{ padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', fontWeight: 700 }}>
            <Download size={14} /> CSV
          </button>
          <button onClick={exportERPDF} className="btn btn-primary" style={{ padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', fontWeight: 700 }}>
            <Download size={14} /> PDF
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(340px,1fr))', gap: 20 }}>
        {/* INGRESOS */}
        <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', background: 'rgba(16,185,129,0.08)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 800, color: 'var(--success)' }}>INGRESOS OPERACIONALES</span>
            <span style={{ fontWeight: 900, color: 'var(--success)', fontSize: '1.1rem' }}>${totalIng.toFixed(decimals)}</span>
          </div>
          <div style={{ maxHeight: 380, overflowY: 'auto' }}>
            {renderTree(ingresos, 'var(--success)')}
          </div>
        </div>

        {/* GASTOS */}
        <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', background: 'rgba(239,68,68,0.08)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 800, color: 'var(--error)' }}>COSTOS Y GASTOS OPERACIONALES</span>
            <span style={{ fontWeight: 900, color: 'var(--error)', fontSize: '1.1rem' }}>${totalGas.toFixed(decimals)}</span>
          </div>
          <div style={{ maxHeight: 380, overflowY: 'auto' }}>
            {renderTree(gastos, 'var(--error)')}
          </div>
        </div>
      </div>

      {/* CASCADA DE RESULTADO NETO */}
      <div className="glass-card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ fontWeight: 800, borderBottom: '1px solid var(--border-color)', paddingBottom: 8 }}>Cálculo del Resultado Neto Fiscal</div>
        
        <div className="flex-between" style={{ fontSize: '0.92rem' }}>
          <span>(+) Ingresos Operacionales</span>
          <strong>${totalIng.toFixed(decimals)}</strong>
        </div>
        <div className="flex-between" style={{ fontSize: '0.92rem', color: 'var(--error)' }}>
          <span>(-) Costos y Gastos Operacionales</span>
          <strong>-${totalGas.toFixed(decimals)}</strong>
        </div>
        
        <div className="flex-between" style={{ borderTop: '1px solid var(--border-color)', paddingTop: 8, fontWeight: 700 }}>
          <span>(=) UTILIDAD DE LA OPERACIÓN</span>
          <span style={{ color: utilidadOperativa >= 0 ? 'var(--success)' : 'var(--error)' }}>${utilidadOperativa.toFixed(decimals)}</span>
        </div>

        <div className="flex-between" style={{ fontSize: '0.9rem', color: 'var(--text-sec)' }}>
          <span>(-) 15% Participación de Trabajadores (Ecuador)</span>
          <strong>-${partTrabajadores.toFixed(decimals)}</strong>
        </div>
        <div className="flex-between" style={{ fontSize: '0.9rem', color: 'var(--text-sec)' }}>
          <span>(-) 25% Impuesto a la Renta</span>
          <strong>-${impuestoRenta.toFixed(decimals)}</strong>
        </div>

        <div className="flex-between" style={{ borderTop: '2px solid var(--primary)', paddingTop: 10, fontSize: '1.3rem', fontWeight: 900 }}>
          <span>RESULTADO NETO DEL EJERCICIO</span>
          <span style={{ color: utilidadNeta >= 0 ? 'var(--success)' : 'var(--error)' }}>
            ${utilidadNeta.toFixed(decimals)}
          </span>
        </div>
      </div>
    </section>
  );
};
