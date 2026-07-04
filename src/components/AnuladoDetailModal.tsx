import React from 'react';
import { motion } from 'framer-motion';
import { Ban } from 'lucide-react';
import { 
  parseConceptoAnulado, 
  extractXmlNumero, 
  getAnuladoTipo 
} from '../utils/anuladosHelpers';
import type { DocAnulado } from '../utils/anuladosHelpers';

interface AnuladoDetailModalProps {
    doc: DocAnulado;
    onClose: () => void;
}

export const AnuladoDetailModal: React.FC<AnuladoDetailModalProps> = ({ doc, onClose }) => {
    const parsedConcepto = parseConceptoAnulado(doc.transacciones?.concepto || '');
    const xmlNumero = extractXmlNumero(
        parsedConcepto.conceptoOriginal,
        doc.transacciones?.numero_comprobante || '',
        doc.clave_acceso_xml || ''
    );
    const valOrig = parsedConcepto.valoresOriginales;
    const tipo = getAnuladoTipo(doc);
    const isXml = doc.es_compra !== null;

    let badgeColor = '#6b7280';
    if (tipo === 'XML Compras') badgeColor = '#f59e0b';
    else if (tipo === 'XML Ventas') badgeColor = '#8b5cf6';
    else if (tipo === 'Pago a Proveedor') badgeColor = '#10b981';
    else if (tipo === 'Cobro a Cliente') badgeColor = '#3b82f6';

    const formatDate = (dateStr: string) =>
        dateStr ? new Date(dateStr + 'T12:00:00').toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(5,8,16,0.85)', backdropFilter: 'blur(12px)', padding: '20px', boxSizing: 'border-box' }}>
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="glass-card"
                style={{ padding: '32px', width: '90%', maxWidth: '620px', maxHeight: '88vh', overflowY: 'auto' }}
            >
                <div className="flex-between" style={{ marginBottom: '24px' }}>
                    <h3 className="h1" style={{ fontSize: '1.4rem', margin: 0, display: 'flex', alignItems: 'center', gap: 8, color: '#6b7280' }}>
                        <Ban size={20} /> Comprobante Anulado
                    </h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-sec)', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
                </div>

                {/* Info banner */}
                <div style={{ background: 'rgba(107,114,128,0.1)', border: '1px solid rgba(107,114,128,0.2)', borderRadius: 12, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.85rem', color: '#9ca3af' }}>
                    <Ban size={16} />
                    Este comprobante fue anulado. Sus valores contables están en cero y <strong style={{ color: '#f59e0b' }}>&nbsp;NO afectan&nbsp;</strong> el libro diario, ATS ni ningún análisis.
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Fila: entidad + comprobante */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div style={{ background: 'var(--input-bg)', borderRadius: 10, padding: '14px' }}>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-sec)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>Entidad</div>
                            <div style={{ fontWeight: 800, fontSize: '1rem' }}>{doc.transacciones?.entidades?.nombre || '—'}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-sec)', marginTop: 2, fontFamily: 'monospace' }}>{doc.transacciones?.entidades?.ruc_cedula || ''}</div>
                        </div>
                        <div style={{ background: 'var(--input-bg)', borderRadius: 10, padding: '14px' }}>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-sec)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>Comprobante Contable</div>
                            <div style={{ fontWeight: 800, fontSize: '1.1rem', fontFamily: 'monospace', color: '#6b7280', textDecoration: 'line-through' }}>
                                #{doc.transacciones?.numero_comprobante || '—'}
                            </div>
                            {xmlNumero && (
                                <div style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--text-sec)', marginTop: 4 }}>{xmlNumero}</div>
                            )}
                            <div style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Ban size={11} /> Anulado
                            </div>
                        </div>
                    </div>

                    {/* Fila: fecha + origen */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div style={{ background: 'var(--input-bg)', borderRadius: 10, padding: '14px' }}>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-sec)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>Fecha</div>
                            <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{doc.transacciones?.fecha ? formatDate(doc.transacciones.fecha) : '—'}</div>
                        </div>
                        <div style={{ background: 'var(--input-bg)', borderRadius: 10, padding: '14px' }}>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-sec)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>Origen</div>
                            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: badgeColor }}>
                                {tipo}
                            </div>
                        </div>
                    </div>

                    {/* Concepto original */}
                    <div style={{ background: 'var(--input-bg)', borderRadius: 10, padding: '14px' }}>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-sec)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>Concepto Original</div>
                        <div style={{ fontSize: '0.9rem', color: 'var(--text-sec)', fontStyle: 'italic' }}>
                            {parsedConcepto.conceptoOriginal}
                        </div>
                    </div>

                    {/* Motivo de Anulación */}
                    {parsedConcepto.motivo && (
                        <div style={{ background: 'rgba(239, 68, 68, 0.04)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: 10, padding: '14px' }}>
                            <div style={{ fontSize: '0.72rem', color: 'var(--error)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>Motivo de la Anulación</div>
                            <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)' }}>
                                {parsedConcepto.motivo}
                            </div>
                            {parsedConcepto.fechaAnulacion && (
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-sec)', marginTop: 4 }}>
                                    Anulado el {parsedConcepto.fechaAnulacion}
                                </div>
                            )}
                        </div>
                    )}

                    {doc.clave_acceso_xml && (
                        <div style={{ background: 'var(--input-bg)', borderRadius: 10, padding: '14px' }}>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-sec)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>Clave de Acceso SRI</div>
                            <div style={{ fontSize: '0.78rem', fontFamily: 'monospace', color: 'var(--text-sec)', wordBreak: 'break-all' }}>{doc.clave_acceso_xml}</div>
                        </div>
                    )}

                    {/* Valores Originales del documento (solo referencia) */}
                    <div style={{ background: valOrig ? 'rgba(16,185,129,0.04)' : 'rgba(107,114,128,0.05)', border: `1px dashed ${valOrig ? 'rgba(16,185,129,0.25)' : 'rgba(107,114,128,0.2)'}`, borderRadius: 10, padding: '14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                            <div style={{ fontSize: '0.72rem', color: valOrig ? '#10b981' : 'var(--text-sec)', fontWeight: 700, textTransform: 'uppercase' }}>
                                {isXml ? 'Valores Originales de la Factura' : 'Monto Original'}
                            </div>
                            <span style={{ fontSize: '0.65rem', background: 'rgba(245,158,11,0.15)', color: '#f59e0b', padding: '2px 8px', borderRadius: 20, fontWeight: 700 }}>
                                Solo referencia · No afecta reportes
                            </span>
                        </div>

                        {valOrig ? (
                            valOrig.total !== undefined ? (
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', padding: '8px 0' }}>
                                    <span style={{ fontWeight: 700 }}>Monto Original</span>
                                    <span style={{ fontWeight: 800, color: '#10b981' }}>
                                        ${(valOrig.total || 0).toFixed(2)}
                                    </span>
                                </div>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                                    {[
                                        { label: 'Base Gravada 12/15/5%', val: valOrig.base_12 },
                                        { label: 'Base Gravada 0%', val: valOrig.base_0 },
                                        { label: 'Base No Objeto', val: valOrig.base_no_objeto },
                                        { label: 'IVA', val: valOrig.monto_iva },
                                    ].map(item => (
                                        <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.83rem', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                            <span style={{ color: 'var(--text-sec)' }}>{item.label}</span>
                                            <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>${(item.val || 0).toFixed(2)}</span>
                                        </div>
                                    ))}
                                    {/* Total */}
                                    <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', padding: '8px 0', borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: 4 }}>
                                        <span style={{ fontWeight: 700 }}>Total Original</span>
                                        <span style={{ fontWeight: 800, color: '#10b981' }}>
                                            ${((valOrig.base_12||0) + (valOrig.base_0||0) + (valOrig.base_no_objeto||0) + (valOrig.monto_iva||0)).toFixed(2)}
                                        </span>
                                    </div>
                                    {/* Retenciones */}
                                    {valOrig.retenciones_aplicadas && valOrig.retenciones_aplicadas.length > 0 && (
                                        <div style={{ gridColumn: '1 / -1', marginTop: 8 }}>
                                            <div style={{ fontSize: '0.72rem', color: 'var(--text-sec)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>Retenciones Originales</div>
                                            {valOrig.retenciones_aplicadas.map((r: any, i: number) => (
                                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8' }}>
                                                    <span style={{ color: 'var(--text-sec)' }}>{r.tipo} {r.porcentaje ? `(${r.porcentaje}%)` : ''}</span>
                                                    <span style={{ fontWeight: 700 }}>${(r.valor || 0).toFixed(2)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )
                        ) : (
                            isXml ? (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                                    {[
                                        { label: 'Base Gravada 12/15/5%', val: doc.base_12 },
                                        { label: 'Base Gravada 0%', val: doc.base_0 },
                                        { label: 'Base No Objeto', val: doc.base_no_objeto },
                                        { label: 'IVA', val: doc.monto_iva },
                                    ].map(item => (
                                        <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.83rem', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                            <span style={{ color: 'var(--text-sec)' }}>{item.label}</span>
                                            <span style={{ fontWeight: 700, color: '#6b7280', textDecoration: 'line-through' }}>${(item.val || 0).toFixed(2)}</span>
                                        </div>
                                    ))}
                                    <div style={{ gridColumn: '1 / -1', fontSize: '0.72rem', color: '#6b7280', marginTop: 8, fontStyle: 'italic' }}>
                                        * Los valores originales no están disponibles para este documento (anulado antes de la actualización).
                                    </div>
                                </div>
                            ) : (
                                <div style={{ fontSize: '0.82rem', color: '#6b7280', fontStyle: 'italic' }}>
                                    * El monto original no está disponible para esta transacción (anulada antes de la actualización).
                                </div>
                            )
                        )}
                    </div>
                </div>

                <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
                    <button onClick={onClose} className="btn btn-primary" style={{ padding: '10px 28px', borderRadius: 12 }}>
                        Cerrar
                    </button>
                </div>
            </motion.div>
        </div>
    );
};
