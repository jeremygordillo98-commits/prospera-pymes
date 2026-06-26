import React from 'react';
import { Download } from 'lucide-react';
import { generatePDFReport } from '../utils/pdfGenerator';

interface Props {
  empresaId: string;
  retencionesAgrupadas: {
    emitidasRenta: any[];
    emitidasIva: any[];
    recibidasRenta: any[];
    recibidasIva: any[];
  };
  permisoReportesPdf: boolean;
  onPremiumBlock: () => void;
  desde: string;
  hasta: string;
}

export const RetencionesSRITab: React.FC<Props> = ({ empresaId, retencionesAgrupadas, permisoReportesPdf, onPremiumBlock, desde, hasta }) => {
  const totalEmitidoRenta = retencionesAgrupadas.emitidasRenta?.reduce((s, r) => s + r.valor, 0) || 0;
  const totalEmitidoIva   = retencionesAgrupadas.emitidasIva?.reduce((s, r) => s + r.valor, 0) || 0;
  const totalEmitido      = totalEmitidoRenta + totalEmitidoIva;

  const totalRecibidoRenta = retencionesAgrupadas.recibidasRenta?.reduce((s, r) => s + r.valor, 0) || 0;
  const totalRecibidoIva   = retencionesAgrupadas.recibidasIva?.reduce((s, r) => s + r.valor, 0) || 0;
  const totalRecibido      = totalRecibidoRenta + totalRecibidoIva;

  const exportCSV = () => {
    if (!permisoReportesPdf) {
      onPremiumBlock();
      return;
    }
    const rows = [
      ['Reporte de Retenciones SRI'],
      ['Período', `${desde || 'Inicio'} al ${hasta || 'Hoy'}`],
      ['Descargado el', `${new Date().toLocaleDateString('es-EC')} ${new Date().toLocaleTimeString('es-EC')}`],
      [],
      ['Reporte de Retenciones SRI - Emitidas (Compras)'],
      ['Tipo', 'Código / Porcentaje', 'Base Imponible', 'Valor Retenido', 'Documentos'],
    ];

    retencionesAgrupadas.emitidasRenta?.forEach(r => {
      rows.push(['Renta (Compras)', r.codigo, r.base.toFixed(2), r.valor.toFixed(2), r.count.toString()]);
    });
    retencionesAgrupadas.emitidasIva?.forEach(r => {
      rows.push(['IVA (Compras)', r.codigo, r.base.toFixed(2), r.valor.toFixed(2), r.count.toString()]);
    });
    rows.push(['TOTAL EMITIDAS', '', '', totalEmitido.toFixed(2), '']);
    rows.push([]);
    rows.push(['Reporte de Retenciones SRI - Recibidas (Ventas)']);
    rows.push(['Tipo', 'Código / Porcentaje', 'Base Imponible', 'Valor Retenido', 'Documentos']);

    retencionesAgrupadas.recibidasRenta?.forEach(r => {
      rows.push(['Renta (Ventas)', r.codigo, r.base.toFixed(2), r.valor.toFixed(2), r.count.toString()]);
    });
    retencionesAgrupadas.recibidasIva?.forEach(r => {
      rows.push(['IVA (Ventas)', r.codigo, r.base.toFixed(2), r.valor.toFixed(2), r.count.toString()]);
    });
    rows.push(['TOTAL RECIBIDAS', '', '', totalRecibido.toFixed(2), '']);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + rows.map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = encodeURI(csvContent);
    a.download = `Retenciones_SRI_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const exportPDF = async () => {
    if (!permisoReportesPdf) {
      onPremiumBlock();
      return;
    }
    const columns = ['Tipo / Concepto', 'Código SRI', 'Base Imponible', 'Valor Retenido', 'Comprobantes'];
    const rows: any[][] = [];

    rows.push([
      { content: 'RETENCIONES EMITIDAS (COMPRAS) - RENTA (F.103)', colSpan: 5, styles: { fillColor: [240, 245, 255], fontStyle: 'bold', textColor: [99, 102, 241] } }
    ]);
    retencionesAgrupadas.emitidasRenta?.forEach(r => {
      rows.push(['Retención de Renta', r.codigo, `$${r.base.toFixed(2)}`, `$${r.valor.toFixed(2)}`, r.count.toString()]);
    });
    rows.push([
      { content: 'SUBTOTAL RENTA EMITIDA', colSpan: 3, styles: { fontStyle: 'bold' } },
      `$${totalEmitidoRenta.toFixed(2)}`,
      ''
    ]);

    rows.push([
      { content: 'RETENCIONES EMITIDAS (COMPRAS) - IVA (F.104)', colSpan: 5, styles: { fillColor: [243, 244, 246], fontStyle: 'bold', textColor: [139, 92, 246] } }
    ]);
    retencionesAgrupadas.emitidasIva?.forEach(r => {
      rows.push(['Retención de IVA', r.codigo, `$${r.base.toFixed(2)}`, `$${r.valor.toFixed(2)}`, r.count.toString()]);
    });
    rows.push([
      { content: 'SUBTOTAL IVA EMITIDO', colSpan: 3, styles: { fontStyle: 'bold' } },
      `$${totalEmitidoIva.toFixed(2)}`,
      ''
    ]);
    rows.push([
      { content: 'TOTAL EMITIDAS (COMPRAS)', colSpan: 3, styles: { fontStyle: 'bold', fillColor: [240, 245, 255] } },
      { content: `$${totalEmitido.toFixed(2)}`, styles: { fontStyle: 'bold', fillColor: [240, 245, 255] } },
      ''
    ]);

    rows.push([
      { content: 'RETENCIONES RECIBIDAS (VENTAS) - RENTA (F.103)', colSpan: 5, styles: { fillColor: [240, 253, 250], fontStyle: 'bold', textColor: [16, 185, 129] } }
    ]);
    retencionesAgrupadas.recibidasRenta?.forEach(r => {
      rows.push(['Retención de Renta Recibida', r.codigo, `$${r.base.toFixed(2)}`, `$${r.valor.toFixed(2)}`, r.count.toString()]);
    });
    rows.push([
      { content: 'SUBTOTAL RENTA RECIBIDA', colSpan: 3, styles: { fontStyle: 'bold' } },
      `$${totalRecibidoRenta.toFixed(2)}`,
      ''
    ]);

    rows.push([
      { content: 'RETENCIONES RECIBIDAS (VENTAS) - IVA (F.104)', colSpan: 5, styles: { fillColor: [254, 242, 242], fontStyle: 'bold', textColor: [239, 68, 68] } }
    ]);
    retencionesAgrupadas.recibidasIva?.forEach(r => {
      rows.push(['Retención de IVA Recibida', r.codigo, `$${r.base.toFixed(2)}`, `$${r.valor.toFixed(2)}`, r.count.toString()]);
    });
    rows.push([
      { content: 'SUBTOTAL IVA RECIBIDO', colSpan: 3, styles: { fontStyle: 'bold' } },
      `$${totalRecibidoIva.toFixed(2)}`,
      ''
    ]);
    rows.push([
      { content: 'TOTAL RECIBIDAS (VENTAS)', colSpan: 3, styles: { fontStyle: 'bold', fillColor: [240, 253, 250] } },
      { content: `$${totalRecibido.toFixed(2)}`, styles: { fontStyle: 'bold', fillColor: [240, 253, 250] } },
      ''
    ]);

    let subtitle = 'Resumen consolidado de retenciones emitidas y recibidas';
    if (desde || hasta) subtitle += ` | Período: ${desde || 'Inicio'} al ${hasta || 'Hoy'}`;

    await generatePDFReport(empresaId, 'Reporte de Retenciones SRI', subtitle, columns, rows, []);
  };

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Cabecera del reporte con botones de descarga */}
      <div className="glass-card" style={{ padding: '14px 20px', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <h3 style={{ margin: 0, flex: 1 }}>Reporte Consolidado de Retenciones SRI</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={exportCSV} className="btn" style={{ padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', fontWeight: 700 }}>
            <Download size={14} /> CSV
          </button>
          <button onClick={exportPDF} className="btn btn-primary" style={{ padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', fontWeight: 700 }}>
            <Download size={14} /> PDF
          </button>
        </div>
      </div>

      {/* KPI Retenciones */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        <div className="glass-card" style={{ borderLeft: '4px solid #8b5cf6', padding: '20px 24px' }}>
          <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', color: 'var(--text-sec)', fontWeight: 800 }}>Retenciones Emitidas (Compras)</div>
          <div style={{ fontSize: '2.2rem', fontWeight: 900, marginTop: 8, color: '#8b5cf6' }}>${totalEmitido.toFixed(2)}</div>
          <div style={{ display: 'flex', gap: 12, marginTop: 10, fontSize: '0.75rem', color: 'var(--text-sec)' }}>
            <span>Renta: <strong style={{ color: 'var(--text-main)' }}>${totalEmitidoRenta.toFixed(2)}</strong></span>
            <span>IVA: <strong style={{ color: 'var(--text-main)' }}>${totalEmitidoIva.toFixed(2)}</strong></span>
          </div>
          <p className="text-sec" style={{ fontSize: '0.75rem', marginTop: 10, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 8 }}>Para declarar en Formulario 103 / 104 (Mensual)</p>
        </div>
        <div className="glass-card" style={{ borderLeft: '4px solid var(--primary)', padding: '20px 24px' }}>
          <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', color: 'var(--text-sec)', fontWeight: 800 }}>Retenciones Recibidas (Ventas)</div>
          <div style={{ fontSize: '2.2rem', fontWeight: 900, marginTop: 8, color: 'var(--primary)' }}>${totalRecibido.toFixed(2)}</div>
          <div style={{ display: 'flex', gap: 12, marginTop: 10, fontSize: '0.75rem', color: 'var(--text-sec)' }}>
            <span>Renta: <strong style={{ color: 'var(--text-main)' }}>${totalRecibidoRenta.toFixed(2)}</strong></span>
            <span>IVA: <strong style={{ color: 'var(--text-main)' }}>${totalRecibidoIva.toFixed(2)}</strong></span>
          </div>
          <p className="text-sec" style={{ fontSize: '0.75rem', marginTop: 10, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 8 }}>Crédito Tributario para deducir impuestos del periodo</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: 24 }}>
        {/* PANEL EMITIDAS */}
        <div className="glass-card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ fontWeight: 800, fontSize: '1.1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: 10, color: '#8b5cf6' }}>
            Retenciones Emitidas (Compras)
          </div>

          {/* Emitidas Renta */}
          <div>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-sec)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              • Impuesto a la Renta (F.103)
            </div>
            <div style={{ overflowX: 'auto', background: 'rgba(255,255,255,0.01)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.03)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.02)', fontSize: '0.7rem' }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 800, color: 'var(--text-sec)' }}>CÓDIGO SRI</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, color: 'var(--text-sec)' }}>BASE IMPONIBLE</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, color: 'var(--text-sec)' }}>TOTAL RETENIDO</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, color: 'var(--text-sec)' }}>DOCS</th>
                  </tr>
                </thead>
                <tbody>
                  {retencionesAgrupadas.emitidasRenta?.map(r => (
                    <tr key={r.codigo} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', fontSize: '0.8rem' }}>
                      <td style={{ padding: '8px 12px' }}><span style={{ fontWeight: 800, color: '#8b5cf6', fontFamily: 'monospace' }}>{r.codigo}</span></td>
                      <td style={{ padding: '8px 12px', textAlign: 'right' }}>${r.base.toFixed(2)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, color: '#8b5cf6' }}>${r.valor.toFixed(2)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-sec)' }}>{r.count}</td>
                    </tr>
                  ))}
                  {(!retencionesAgrupadas.emitidasRenta || retencionesAgrupadas.emitidasRenta.length === 0) && (
                    <tr><td colSpan={4} style={{ textAlign: 'center', padding: 16, color: 'var(--text-sec)', fontSize: '0.8rem' }}>Sin retenciones de renta emitidas</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Emitidas IVA */}
          <div>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-sec)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              • Impuesto al Valor Agregado (F.104)
            </div>
            <div style={{ overflowX: 'auto', background: 'rgba(255,255,255,0.01)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.03)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.02)', fontSize: '0.7rem' }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 800, color: 'var(--text-sec)' }}>PORCENTAJE / CÓD</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, color: 'var(--text-sec)' }}>BASE IMPONIBLE</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, color: 'var(--text-sec)' }}>TOTAL RETENIDO</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, color: 'var(--text-sec)' }}>DOCS</th>
                  </tr>
                </thead>
                <tbody>
                  {retencionesAgrupadas.emitidasIva?.map(r => (
                    <tr key={r.codigo} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', fontSize: '0.8rem' }}>
                      <td style={{ padding: '8px 12px' }}><span style={{ fontWeight: 800, color: 'var(--primary)', fontFamily: 'monospace' }}>{r.codigo}</span></td>
                      <td style={{ padding: '8px 12px', textAlign: 'right' }}>${r.base.toFixed(2)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, color: 'var(--primary)' }}>${r.valor.toFixed(2)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-sec)' }}>{r.count}</td>
                    </tr>
                  ))}
                  {(!retencionesAgrupadas.emitidasIva || retencionesAgrupadas.emitidasIva.length === 0) && (
                    <tr><td colSpan={4} style={{ textAlign: 'center', padding: 16, color: 'var(--text-sec)', fontSize: '0.8rem' }}>Sin retenciones de IVA emitidas</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* PANEL RECIBIDAS */}
        <div className="glass-card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ fontWeight: 800, fontSize: '1.1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: 10, color: 'var(--primary)' }}>
            Retenciones Recibidas (Ventas)
          </div>

          {/* Recibidas Renta */}
          <div>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-sec)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              • Impuesto a la Renta (F.103)
            </div>
            <div style={{ overflowX: 'auto', background: 'rgba(255,255,255,0.01)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.03)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.02)', fontSize: '0.7rem' }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 800, color: 'var(--text-sec)' }}>CÓDIGO SRI</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, color: 'var(--text-sec)' }}>BASE IMPONIBLE</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, color: 'var(--text-sec)' }}>TOTAL RETENIDO</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, color: 'var(--text-sec)' }}>DOCS</th>
                  </tr>
                </thead>
                <tbody>
                  {retencionesAgrupadas.recibidasRenta?.map(r => (
                    <tr key={r.codigo} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', fontSize: '0.8rem' }}>
                      <td style={{ padding: '8px 12px' }}><span style={{ fontWeight: 800, color: '#8b5cf6', fontFamily: 'monospace' }}>{r.codigo}</span></td>
                      <td style={{ padding: '8px 12px', textAlign: 'right' }}>${r.base.toFixed(2)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, color: '#8b5cf6' }}>${r.valor.toFixed(2)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-sec)' }}>{r.count}</td>
                    </tr>
                  ))}
                  {(!retencionesAgrupadas.recibidasRenta || retencionesAgrupadas.recibidasRenta.length === 0) && (
                    <tr><td colSpan={4} style={{ textAlign: 'center', padding: 16, color: 'var(--text-sec)', fontSize: '0.8rem' }}>Sin retenciones de renta recibidas</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recibidas IVA */}
          <div>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-sec)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              • Impuesto al Valor Agregado (F.104)
            </div>
            <div style={{ overflowX: 'auto', background: 'rgba(255,255,255,0.01)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.03)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.02)', fontSize: '0.7rem' }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 800, color: 'var(--text-sec)' }}>PORCENTAJE / CÓD</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, color: 'var(--text-sec)' }}>BASE IMPONIBLE</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, color: 'var(--text-sec)' }}>TOTAL RETENIDO</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, color: 'var(--text-sec)' }}>DOCS</th>
                  </tr>
                </thead>
                <tbody>
                  {retencionesAgrupadas.recibidasIva?.map(r => (
                    <tr key={r.codigo} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', fontSize: '0.8rem' }}>
                      <td style={{ padding: '8px 12px' }}><span style={{ fontWeight: 800, color: 'var(--primary)', fontFamily: 'monospace' }}>{r.codigo}</span></td>
                      <td style={{ padding: '8px 12px', textAlign: 'right' }}>${r.base.toFixed(2)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, color: 'var(--primary)' }}>${r.valor.toFixed(2)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-sec)' }}>{r.count}</td>
                    </tr>
                  ))}
                  {(!retencionesAgrupadas.recibidasIva || retencionesAgrupadas.recibidasIva.length === 0) && (
                    <tr><td colSpan={4} style={{ textAlign: 'center', padding: 16, color: 'var(--text-sec)', fontSize: '0.8rem' }}>Sin retenciones de IVA recibidas</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
