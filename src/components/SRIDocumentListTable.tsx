import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Receipt, 
  FileMinus, 
  Ban, 
  FileText, 
  Eye, 
  Edit2, 
  ChevronLeft, 
  ChevronRight,
  Search
} from 'lucide-react';
import type { DocSRI } from '../hooks/useSRIAutomation';

interface Props {
  paginated: DocSRI[];
  filteredLength: number;
  currentPage: number;
  itemsPerPage: number;
  deletingId: string | null;
  handleAnular: (doc: DocSRI) => void;
  setViewingDoc: (doc: DocSRI | null) => void;
  setEditingDoc: (doc: DocSRI | null) => void;
  totalPages: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  totals?: { baseGrav: number; iva: number; retencion: number; total: number };
}

export const SRIDocumentListTable: React.FC<Props> = ({
  paginated,
  filteredLength,
  currentPage,
  itemsPerPage,
  deletingId,
  handleAnular,
  setViewingDoc,
  setEditingDoc,
  totalPages,
  setCurrentPage,
  totals
}) => {
  const getTipoIcon = (tipo: string) => {
    if (tipo?.includes('Retención') || tipo?.includes('Retencion')) return <Receipt size={14} />;
    if (tipo?.includes('Crédito') || tipo?.includes('Credito')) return <FileMinus size={14} />;
    if (tipo?.toLowerCase() === 'anulado') return <Ban size={14} />;
    return <FileText size={14} />;
  };

  const getTipoColor = (tipo: string) => {
    if (tipo?.includes('Retención') || tipo?.includes('Retencion')) return 'var(--warning)';
    if (tipo?.includes('Crédito') || tipo?.includes('Credito')) return 'var(--error)';
    if (tipo?.toLowerCase() === 'anulado') return '#6b7280';
    return 'var(--primary)';
  };

  return (
    <>
      {paginated.length === 0 ? (
        <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-sec)' }}>
          <Search size={32} style={{ opacity: 0.2, marginBottom: 12 }} />
          <p style={{ fontSize: '0.9rem' }}>No se encontraron documentos con esos filtros.</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                {['Tipo', 'Entidad', 'Comprobante', 'Fecha', 'Base Grav.', 'IVA', 'Retención', 'Total', ''].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: h === 'Base Grav.' || h === 'IVA' || h === 'Retención' || h === 'Total' ? 'right' : 'left', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-sec)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <AnimatePresence>
              <tbody>
                {paginated.map((doc, idx) => {
                  const tc = doc.transacciones?.tipo_comprobante || '';
                  const isRet = tc.toLowerCase().includes('retención') || tc.toLowerCase().includes('retencion');
                  const isAnulado = tc === 'Anulado';
                  
                  let baseGrav = 0;
                  let ivaDisplay = 0;
                  let total = 0;

                  if (isRet) {
                    const rets = doc.retenciones_aplicadas || [];
                    baseGrav = rets.reduce((sum, r) => sum + (r.base || 0), 0);
                    ivaDisplay = rets.filter(r => r.tipo === 'IVA').reduce((sum, r) => sum + (r.valor || 0), 0);
                    total = rets.reduce((sum, r) => sum + (r.valor || 0), 0);
                  } else {
                    baseGrav = (doc.base_12 || 0) + (doc.base_0 || 0) + (doc.base_no_objeto || 0);
                    ivaDisplay = doc.monto_iva || 0;
                    total = baseGrav + ivaDisplay;
                  }

                  const concepto = doc.transacciones?.concepto || '';
                  const numComp = (doc.transacciones?.numero_comprobante || '').trim();
                  const sriRegex = /\d{3}-\d{3}-\d{9}/;
                  const matchConcepto = concepto.match(sriRegex);
                  const isSRIFormat = sriRegex.test(numComp);
                  let xmlNumero: string | null = null;
                  if (matchConcepto) {
                    xmlNumero = matchConcepto[0];
                  } else if (isSRIFormat) {
                    xmlNumero = numComp;
                  } else {
                    const clave = doc.clave_acceso_xml || '';
                    if (clave.length >= 39) {
                      xmlNumero = `${clave.substring(24,27)}-${clave.substring(27,30)}-${clave.substring(30,39)}`;
                    }
                  }

                  const secuencialDisplay = isSRIFormat
                    ? String(filteredLength - ((currentPage - 1) * itemsPerPage + idx))
                    : numComp || String(filteredLength - ((currentPage - 1) * itemsPerPage + idx));

                  return (
                    <motion.tr
                      key={doc.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.2s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      {/* TIPO */}
                      <td style={{ padding: '12px 12px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', fontWeight: 700, color: getTipoColor(tc), background: `${getTipoColor(tc)}18`, padding: '4px 10px', borderRadius: 20, whiteSpace: 'nowrap' }}>
                          {getTipoIcon(tc)} {tc || '—'}
                        </span>
                        {xmlNumero && (
                          <div style={{ fontFamily: 'monospace', fontSize: '0.68rem', color: 'var(--text-sec)', marginTop: 5, letterSpacing: '0.3px', whiteSpace: 'nowrap' }}>
                            {xmlNumero}
                          </div>
                        )}
                      </td>
                      {/* ENTIDAD */}
                      <td style={{ padding: '12px', fontSize: '0.85rem', fontWeight: 600, maxWidth: 180 }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.transacciones?.entidades?.nombre || '—'}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-sec)', marginTop: 2 }}>{doc.transacciones?.entidades?.ruc_cedula || ''}</div>
                      </td>
                      {/* COMPROBANTE */}
                      <td style={{ padding: '12px', fontSize: '0.82rem', fontWeight: 700, fontFamily: 'monospace', textAlign: 'center' }}>
                        {secuencialDisplay}
                      </td>
                      <td style={{ padding: '12px', fontSize: '0.82rem', color: 'var(--text-sec)', whiteSpace: 'nowrap' }}>
                        {doc.transacciones?.fecha ? new Date(doc.transacciones.fecha + 'T12:00:00').toLocaleDateString('es-EC') : '—'}
                      </td>
                      <td style={{ padding: '12px', fontSize: '0.85rem', fontWeight: 700, textAlign: 'right' }}>
                        ${baseGrav.toFixed(2)}
                      </td>
                      <td style={{ padding: '12px', fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 700, textAlign: 'right' }}>
                        ${ivaDisplay.toFixed(2)}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {doc.retenciones_aplicadas && doc.retenciones_aplicadas.length > 0 ? (
                          <span style={{ 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            gap: 4, 
                            fontSize: '0.78rem', 
                            fontWeight: 700, 
                            color: 'var(--warning)', 
                            background: 'rgba(245, 158, 11, 0.12)', 
                            border: '1px solid rgba(245, 158, 11, 0.2)',
                            padding: '4px 10px', 
                            borderRadius: 20 
                          }}>
                            ${doc.retenciones_aplicadas.reduce((sum, r) => sum + (r.valor || 0), 0).toFixed(2)}
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-sec)' }}>
                            Sin Retención
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '12px', fontSize: '0.9rem', fontWeight: 900, textAlign: 'right', whiteSpace: 'nowrap' }}>
                        ${total.toFixed(2)}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                          <button
                            onClick={() => setViewingDoc(doc)}
                            title="Ver detalle completo"
                            style={{ 
                              background: 'rgba(59,130,246,0.1)', 
                              border: 'none', 
                              color: '#3b82f6', 
                              cursor: 'pointer', 
                              padding: '6px 12px', 
                              borderRadius: 8, 
                              display: 'inline-flex', 
                              alignItems: 'center', 
                              gap: '4px',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              transition: 'all 0.2s'
                            }}
                          >
                            <Eye size={14} /> Ver
                          </button>
                          {!isAnulado && (
                            <button
                              onClick={() => setEditingDoc(doc)}
                              title="Editar cuentas contables"
                              style={{ 
                                background: 'rgba(245,158,11,0.1)', 
                                border: 'none', 
                                color: '#f59e0b', 
                                cursor: 'pointer', 
                                padding: '6px 12px', 
                                borderRadius: 8, 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: '4px',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                transition: 'all 0.2s'
                              }}
                            >
                              <Edit2 size={14} /> Editar
                            </button>
                          )}
                          {!isAnulado && (
                            <button
                              onClick={() => handleAnular(doc)}
                              disabled={deletingId === doc.id}
                              title="Anular comprobante contable y tributario"
                              style={{ 
                                background: 'rgba(245,158,11,0.06)', 
                                border: 'none', 
                                color: '#f59e0b', 
                                cursor: 'pointer', 
                                padding: '6px 12px', 
                                borderRadius: 8, 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: '4px',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                transition: 'all 0.2s'
                              }}
                            >
                              <Ban size={14} /> Anular
                            </button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </AnimatePresence>
            {totals && (
              <tfoot>
                <tr style={{ background: 'var(--primary-light)', fontWeight: 900, borderTop: '2px solid var(--border-color)', borderBottom: '2px solid var(--border-color)' }}>
                  <td colSpan={4} style={{ padding: '12px 12px', fontSize: '0.78rem', textTransform: 'uppercase', color: 'var(--text-main)' }}>TOTALES FILTRADOS</td>
                  <td style={{ padding: '12px 12px', textAlign: 'right', color: 'var(--text-main)' }}>${totals.baseGrav.toFixed(2)}</td>
                  <td style={{ padding: '12px 12px', textAlign: 'right', color: 'var(--primary)' }}>${totals.iva.toFixed(2)}</td>
                  <td style={{ padding: '12px 12px', textAlign: 'right', color: 'var(--warning)' }}>${totals.retencion.toFixed(2)}</td>
                  <td style={{ padding: '12px 12px', textAlign: 'right', color: 'var(--success)', fontSize: '0.92rem' }}>${totals.total.toFixed(2)}</td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {/* Paginación */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border-color)' }}>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-sec)' }}>
            Página {currentPage} de {totalPages} — {filteredLength} documentos
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="btn" style={{ padding: '8px 14px', borderRadius: 12, opacity: currentPage === 1 ? 0.4 : 1 }}>
              <ChevronLeft size={16} />
            </button>
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="btn btn-primary" style={{ padding: '8px 14px', borderRadius: 12, opacity: currentPage === totalPages ? 0.4 : 1 }}>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  );
};
