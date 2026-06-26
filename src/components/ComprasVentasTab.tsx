import React, { useMemo } from 'react';
import { Download, FileSpreadsheet, Loader2, Info } from 'lucide-react';
import { exportComprasVentasExcel } from '../utils/comprasVentasExport';

interface Props {
  empresaId: string;
  sriDocs: any[];
  desde: string;
  hasta: string;
  loading?: boolean;
}

export const ComprasVentasTab: React.FC<Props> = ({
  empresaId,
  sriDocs,
  desde,
  hasta,
  loading = false
}) => {
  // Format date range helper
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dateStr;
  };

  // Filter documents by date range
  const filteredDocs = useMemo(() => {
    return sriDocs.filter(d => {
      const f = d.transacciones?.fecha || '';
      if (desde && f < desde) return false;
      if (hasta && f > hasta) return false;
      return true;
    }).sort((a, b) => {
      const fA = a.transacciones?.fecha || '';
      const fB = b.transacciones?.fecha || '';
      return fA.localeCompare(fB);
    });
  }, [sriDocs, desde, hasta]);

  // Compute stats
  const stats = useMemo(() => {
    let totalCompras = 0;
    let totalVentas = 0;
    let ivaCompras = 0;
    let ivaVentas = 0;
    let retEmitidas = 0;
    let retRecibidas = 0;

    filteredDocs.forEach(d => {
      const subtotal12 = Number(d.base_12 || 0);
      const subtotal0 = Number(d.base_0 || 0);
      const subtotalNoObj = Number(d.base_no_objeto || 0);
      const subtotal = subtotal12 + subtotal0 + subtotalNoObj;
      const iva = Number(d.monto_iva || 0);
      const total = subtotal + iva;

      // Extract withholdings
      let retsTotal = 0;
      if (Array.isArray(d.retenciones_aplicadas)) {
        retsTotal = d.retenciones_aplicadas
          .filter((r: any) => r.tipo !== 'METADATA')
          .reduce((sum: number, r: any) => sum + Number(r.valor || 0), 0);
      }

      if (d.es_compra) {
        totalCompras += total;
        ivaCompras += iva;
        retEmitidas += retsTotal;
      } else {
        totalVentas += total;
        ivaVentas += iva;
        retRecibidas += retsTotal;
      }
    });

    return { totalCompras, totalVentas, ivaCompras, ivaVentas, retEmitidas, retRecibidas };
  }, [filteredDocs]);

  const handleExport = async () => {
    await exportComprasVentasExcel(empresaId, desde, hasta, sriDocs);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Summary Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        <div className="glass-card" style={{ padding: '16px 20px', borderLeft: '4px solid var(--primary)' }}>
          <div className="text-sec" style={{ fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 800 }}>Total Compras</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, marginTop: 4, color: 'var(--text-main)' }}>${stats.totalCompras.toFixed(2)}</div>
          <div className="text-sec" style={{ fontSize: '0.72rem', marginTop: 4 }}>IVA: ${stats.ivaCompras.toFixed(2)}</div>
        </div>
        <div className="glass-card" style={{ padding: '16px 20px', borderLeft: '4px solid var(--success)' }}>
          <div className="text-sec" style={{ fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 800 }}>Total Ventas</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, marginTop: 4, color: 'var(--success)' }}>${stats.totalVentas.toFixed(2)}</div>
          <div className="text-sec" style={{ fontSize: '0.72rem', marginTop: 4 }}>IVA: ${stats.ivaVentas.toFixed(2)}</div>
        </div>
        <div className="glass-card" style={{ padding: '16px 20px', borderLeft: '4px solid #E5E7EB' }}>
          <div className="text-sec" style={{ fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 800 }}>Retenciones Emitidas</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, marginTop: 4, color: 'var(--text-main)' }}>${stats.retEmitidas.toFixed(2)}</div>
        </div>
        <div className="glass-card" style={{ padding: '16px 20px', borderLeft: '4px solid #F59E0B' }}>
          <div className="text-sec" style={{ fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 800 }}>Retenciones Recibidas</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, marginTop: 4, color: '#F59E0B' }}>${stats.retRecibidas.toFixed(2)}</div>
        </div>
      </div>

      <section className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        {/* Toolbar */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <h3 style={{ margin: 0, flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileSpreadsheet size={18} className="text-primary" /> Reporte de Compras y Ventas (Form. 103/104)
          </h3>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            

            <button 
              onClick={handleExport} 
              disabled={filteredDocs.length === 0 || loading}
              className="btn btn-primary" 
              style={{ padding: '7px 16px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', fontWeight: 700 }}
            >
              <Download size={14} /> Exportar a Excel
            </button>
          </div>
        </div>

        {/* Preview Table */}
        <div style={{ overflowX: 'auto' }}>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center' }}>
              <Loader2 className="animate-spin" size={24} style={{ margin: '0 auto', color: 'var(--primary)' }} />
            </div>
          ) : filteredDocs.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-sec)' }}>
              <Info size={24} style={{ margin: '0 auto 10px', opacity: 0.5 }} />
              No se encontraron documentos SRI registrados en el período seleccionado.
            </div>
          ) : (
            <table className="data-table" style={{ minWidth: 900 }}>
              <thead>
                <tr>
                  <th>F. Emisión</th>
                  <th>Tipo</th>
                  <th>RUC</th>
                  <th>Razón Social</th>
                  <th>No. Comprobante</th>
                  <th style={{ textAlign: 'right' }}>Subtotal</th>
                  <th style={{ textAlign: 'right' }}>IVA</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                  <th style={{ textAlign: 'center' }}>Retención</th>
                </tr>
              </thead>
              <tbody>
                {filteredDocs.map((doc) => {
                  const tx = doc.transacciones || {};
                  const ent = tx.entidades || {};
                  const sub12 = Number(doc.base_12 || 0);
                  const sub0 = Number(doc.base_0 || 0);
                  const subNoObj = Number(doc.base_no_objeto || 0);
                  const subtotal = sub12 + sub0 + subNoObj;
                  const iva = Number(doc.monto_iva || 0);
                  const total = subtotal + iva;
                  
                  const hasRet = Array.isArray(doc.retenciones_aplicadas) && 
                                 doc.retenciones_aplicadas.some((r: any) => r.tipo !== 'METADATA');

                  return (
                    <tr key={doc.id}>
                      <td>{formatDate(tx.fecha)}</td>
                      <td>
                        <span style={{ 
                          fontSize: '0.75rem', 
                          padding: '2px 8px', 
                          borderRadius: '4px',
                          fontWeight: 700,
                          background: doc.es_compra ? 'rgba(99, 102, 241, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                          color: doc.es_compra ? 'var(--primary)' : 'var(--success)'
                        }}>
                          {doc.es_compra ? 'Compra' : 'Venta'}
                        </span>
                      </td>
                      <td>{ent.ruc_cedula || '—'}</td>
                      <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={ent.razon_social}>
                        {ent.razon_social || '—'}
                      </td>
                      <td>{tx.concepto?.match(/\d{3}-\d{3}-\d{9}/)?.[0] || doc.clave_acceso_xml?.substring(24, 39) || '—'}</td>
                      <td style={{ textAlign: 'right' }}>${subtotal.toFixed(2)}</td>
                      <td style={{ textAlign: 'right' }}>${iva.toFixed(2)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>${total.toFixed(2)}</td>
                      <td style={{ textAlign: 'center' }}>
                        {hasRet ? (
                          <span style={{ color: 'var(--success)', fontWeight: 800, fontSize: '0.75rem' }}>Sí</span>
                        ) : (
                          <span style={{ opacity: 0.3 }}>No</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
};
