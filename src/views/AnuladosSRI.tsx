import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Ban, Search, Filter, ChevronLeft, ChevronRight,
    RefreshCw, FileText, FileMinus, Receipt, Eye
} from 'lucide-react';
import { supabase } from '../services/supabase';

interface AnuladosSRIProps {
    empresaId: string;
}

interface DocAnulado {
    id: string;
    clave_acceso_xml: string;
    base_12: number;
    base_0: number;
    base_no_objeto: number;
    monto_iva: number;
    es_compra: boolean | null;
    retenciones_aplicadas: Array<{ base: number; valor: number; tipo: string }> | null;
    created_at: string;
    transacciones: {
        id: string;
        fecha: string;
        concepto: string;
        tipo_comprobante: string;
        numero_comprobante: string;
        entidades?: { nombre: string; ruc_cedula: string } | null;
    } | null;
}

const ITEMS_PER_PAGE = 15;

const parseConceptoAnulado = (concepto: string) => {
    const regex = /^\[ANULADO\]\s*Motivo:\s*(.*?)\s*\|\s*Fecha:\s*(.*?)\s*\|\s*(.*)$/;
    const match = concepto.match(regex);
    if (match) {
        return {
            motivo: match[1],
            fechaAnulacion: match[2],
            conceptoOriginal: match[3]
        };
    }
    return {
        motivo: null,
        fechaAnulacion: null,
        conceptoOriginal: concepto.replace(/^\[ANULADO\]\s*/, '')
    };
};

interface AnuladoDetailModalProps {
    doc: DocAnulado;
    onClose: () => void;
}

const AnuladoDetailModal: React.FC<AnuladoDetailModalProps> = ({ doc, onClose }) => {
    const parsedConcepto = parseConceptoAnulado(doc.transacciones?.concepto || '');

    const formatDate = (dateStr: string) =>
        dateStr ? new Date(dateStr).toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(5,8,16,0.85)', backdropFilter: 'blur(12px)', padding: '20px', boxSizing: 'border-box' }}>
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="glass-card"
                style={{ padding: '32px', width: '90%', maxWidth: '600px', maxHeight: '85vh', overflowY: 'auto' }}
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
                    Este comprobante fue anulado. Sus valores contables están en cero y no afecta el libro diario ni el ATS.
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
                            <div style={{ fontWeight: 800, fontSize: '1.1rem', fontFamily: 'monospace' }}>#{doc.transacciones?.numero_comprobante || '—'}</div>
                            <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: 2 }}>Anulado</div>
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
                            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: doc.es_compra ? '#f59e0b' : '#8b5cf6' }}>
                                {doc.es_compra === true ? 'XML Compras' : doc.es_compra === false ? 'XML Ventas' : '—'}
                            </div>
                        </div>
                    </div>

                    {/* Concepto */}
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

                    {/* Valores (todos en cero al estar anulado) */}
                    <div style={{ background: 'rgba(107,114,128,0.05)', border: '1px dashed rgba(107,114,128,0.2)', borderRadius: 10, padding: '14px' }}>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-sec)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 10 }}>Valores Tributarios (Anulados)</div>
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
                        </div>
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

export const AnuladosSRI: React.FC<AnuladosSRIProps> = ({ empresaId }) => {
    const [documentos, setDocumentos] = useState<DocAnulado[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterTipo, setFilterTipo] = useState<'todos' | 'compras' | 'ventas'>('todos');
    const [currentPage, setCurrentPage] = useState(1);
    const [viewingDoc, setViewingDoc] = useState<DocAnulado | null>(null);

    const fetchAnulados = useCallback(async () => {
        if (!empresaId) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('documentos_sri')
                .select(`
                    id, clave_acceso_xml, base_12, base_0, base_no_objeto,
                    monto_iva, es_compra, retenciones_aplicadas, created_at,
                    transacciones (
                        id, fecha, concepto, tipo_comprobante, numero_comprobante,
                        entidades ( nombre, ruc_cedula )
                    )
                `)
                .eq('id_empresa', empresaId)
                .eq('transacciones.tipo_comprobante', 'Anulado')
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Supabase devuelve transacciones como array; tomamos el primer elemento
            const normalized = (data || []).map((d: any) => ({
                ...d,
                transacciones: Array.isArray(d.transacciones) ? d.transacciones[0] ?? null : d.transacciones
            }));

            // Filtrar solo los que tienen transacción con tipo_comprobante === 'Anulado'
            const anulados = normalized.filter(
                (d: any) => d.transacciones?.tipo_comprobante === 'Anulado'
            ) as DocAnulado[];

            setDocumentos(anulados);
        } catch (err) {
            console.error('Error fetching anulados:', err);
        } finally {
            setLoading(false);
        }
    }, [empresaId]);

    useEffect(() => {
        fetchAnulados();
    }, [fetchAnulados]);

    // Bloqueo scroll cuando modal abierto
    useEffect(() => {
        if (viewingDoc) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [viewingDoc]);



    // Filtrado
    const filtered = documentos.filter(doc => {
        const concepto = doc.transacciones?.concepto?.toLowerCase() || '';
        const numero = doc.transacciones?.numero_comprobante?.toLowerCase() || '';
        const entidad = doc.transacciones?.entidades?.nombre?.toLowerCase() || '';
        const matchSearch = !search ||
            concepto.includes(search.toLowerCase()) ||
            numero.includes(search.toLowerCase()) ||
            entidad.includes(search.toLowerCase());

        let matchTipo = true;
        if (filterTipo === 'compras') matchTipo = doc.es_compra === true;
        if (filterTipo === 'ventas') matchTipo = doc.es_compra === false;

        return matchSearch && matchTipo;
    });

    const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
    const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    const formatDate = (dateStr: string) =>
        dateStr ? new Date(dateStr).toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

    return (
        <div className="sri-automation-container">
            {/* ─── HEADER ─── */}
            <header className="flex-between" style={{ marginBottom: '40px', flexWrap: 'wrap', gap: 16 }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#6b7280', fontWeight: 800, textTransform: 'uppercase', fontSize: '0.8rem', letterSpacing: '2px', marginBottom: '8px' }}>
                        <Ban size={14} /> Automatización SRI
                    </div>
                    <h1 className="h1" style={{ fontSize: '2.5rem', fontWeight: 900 }}>Documentos Anulados</h1>
                    <p className="text-sec" style={{ fontSize: '1.1rem' }}>
                        Registro histórico de comprobantes anulados contable y tributariamente.
                    </p>
                </div>
                <button
                    onClick={fetchAnulados}
                    className="btn"
                    style={{ padding: '12px', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: 8 }}
                    title="Refrescar"
                >
                    <RefreshCw size={18} />
                </button>
            </header>

            {/* ─── EMPTY STATE ─── */}
            {!loading && documentos.length === 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-card"
                    style={{ padding: '60px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
                >
                    <div style={{ width: 80, height: 80, background: 'rgba(107,114,128,0.1)', borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', marginBottom: '24px' }}>
                        <Ban size={40} />
                    </div>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '16px' }}>Sin Anulaciones</h2>
                    <p className="text-sec" style={{ maxWidth: '400px', fontSize: '1rem' }}>
                        No hay documentos anulados. Cuando anules un comprobante desde XML Compras o XML Ventas, aparecerá aquí.
                    </p>
                </motion.div>
            )}

            {/* ─── TABLA ─── */}
            {(loading || documentos.length > 0) && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card" style={{ padding: '28px' }}>
                    {/* Filtros */}
                    <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
                        <h3 style={{ margin: 0, fontWeight: 800, flex: 1, minWidth: 200 }}>
                            Historial de Anulados
                            <span style={{ marginLeft: 10, fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-sec)', background: 'rgba(107,114,128,0.15)', padding: '3px 10px', borderRadius: 20 }}>
                                {filtered.length}
                            </span>
                        </h3>
                        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-sec)' }} />
                            <input
                                value={search}
                                onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
                                placeholder="Buscar por entidad, número..."
                                style={{ width: '100%', paddingLeft: 36, padding: '10px 12px 10px 36px', borderRadius: 12, border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-main)', fontSize: '0.9rem', boxSizing: 'border-box' }}
                            />
                        </div>
                        <div style={{ position: 'relative' }}>
                            <Filter size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-sec)' }} />
                            <select
                                value={filterTipo}
                                onChange={e => { setFilterTipo(e.target.value as any); setCurrentPage(1); }}
                                style={{ paddingLeft: 36, padding: '10px 12px 10px 36px', borderRadius: 12, border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-main)', fontSize: '0.9rem' }}
                            >
                                <option value="todos">Compras y Ventas</option>
                                <option value="compras">Solo Compras</option>
                                <option value="ventas">Solo Ventas</option>
                            </select>
                        </div>
                    </div>

                    {/* Tabla */}
                    {loading ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {[1, 2, 3, 4, 5].map(i => (
                                <div key={i} style={{ height: 56, borderRadius: 12, background: 'rgba(255,255,255,0.04)', animation: 'pulse 1.5s ease-in-out infinite' }} />
                            ))}
                        </div>
                    ) : paginated.length === 0 ? (
                        <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-sec)' }}>
                            <Search size={32} style={{ opacity: 0.2, marginBottom: 12 }} />
                            <p style={{ fontSize: '0.9rem' }}>No se encontraron documentos con esos filtros.</p>
                        </div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        {['Tipo', 'Entidad', 'Comprobante', 'Fecha', 'Origen', 'Acciones'].map(h => (
                                            <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-sec)', whiteSpace: 'nowrap' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <AnimatePresence>
                                    <tbody>
                                        {paginated.map((doc, idx) => {
                                            const concepto = doc.transacciones?.concepto || '';
                                            // Detectar tipo original por el concepto
                                            const isRet = concepto.toLowerCase().includes('retención') || concepto.toLowerCase().includes('retencion');
                                            const isNC = concepto.toLowerCase().includes('nc:') || concepto.toLowerCase().includes('nota de crédito') || concepto.toLowerCase().includes('nota de credito');
                                            const tipoOriginal = isRet ? 'Retención' : isNC ? 'Nota de Crédito' : 'Factura';
                                            const tipoIcon = isRet ? <Receipt size={13} /> : isNC ? <FileMinus size={13} /> : <FileText size={13} />;
                                            const origen = doc.es_compra === true ? 'Compras' : doc.es_compra === false ? 'Ventas' : '—';

                                            return (
                                                <motion.tr
                                                    key={doc.id}
                                                    initial={{ opacity: 0, y: 8 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: idx * 0.03 }}
                                                    style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.2s', opacity: 0.75 }}
                                                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                                                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                                >
                                                    {/* Tipo */}
                                                    <td style={{ padding: '12px 12px' }}>
                                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', fontWeight: 700, color: '#6b7280', background: 'rgba(107,114,128,0.1)', padding: '4px 10px', borderRadius: 20, whiteSpace: 'nowrap', textDecoration: 'line-through' }}>
                                                            {tipoIcon} {tipoOriginal}
                                                        </span>
                                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', fontWeight: 700, color: '#6b7280', marginLeft: 6 }}>
                                                            <Ban size={11} /> Anulado
                                                        </span>
                                                    </td>
                                                    {/* Entidad */}
                                                    <td style={{ padding: '12px', fontSize: '0.85rem', fontWeight: 600, maxWidth: 180 }}>
                                                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.transacciones?.entidades?.nombre || '—'}</div>
                                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-sec)', marginTop: 2 }}>{doc.transacciones?.entidades?.ruc_cedula || ''}</div>
                                                    </td>
                                                    {/* Comprobante */}
                                                    <td style={{ padding: '12px', fontSize: '0.82rem', fontWeight: 600, fontFamily: 'monospace', color: '#6b7280' }}>
                                                        #{doc.transacciones?.numero_comprobante || '—'}
                                                    </td>
                                                    {/* Fecha */}
                                                    <td style={{ padding: '12px', fontSize: '0.82rem', color: 'var(--text-sec)', whiteSpace: 'nowrap' }}>
                                                        {doc.transacciones?.fecha ? formatDate(doc.transacciones.fecha) : '—'}
                                                    </td>
                                                    {/* Origen */}
                                                    <td style={{ padding: '12px' }}>
                                                        <span style={{
                                                            display: 'inline-flex', alignItems: 'center', gap: 4,
                                                            fontSize: '0.75rem', fontWeight: 700,
                                                            color: doc.es_compra ? '#f59e0b' : '#8b5cf6',
                                                            background: doc.es_compra ? 'rgba(245,158,11,0.1)' : 'rgba(139,92,246,0.1)',
                                                            padding: '3px 10px', borderRadius: 20
                                                        }}>
                                                            {origen}
                                                        </span>
                                                    </td>
                                                    {/* Acciones */}
                                                    <td style={{ padding: '12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                                                            <button
                                                                onClick={() => setViewingDoc(doc)}
                                                                title="Ver detalle"
                                                                style={{ background: 'rgba(59,130,246,0.1)', border: 'none', color: '#3b82f6', cursor: 'pointer', padding: '6px 12px', borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', fontWeight: 700 }}
                                                            >
                                                                <Eye size={14} /> Ver
                                                            </button>
                                                        </div>
                                                    </td>
                                                </motion.tr>
                                            );
                                        })}
                                    </tbody>
                                </AnimatePresence>
                            </table>
                        </div>
                    )}

                    {/* Paginación */}
                    {totalPages > 1 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border-color)' }}>
                            <span style={{ fontSize: '0.82rem', color: 'var(--text-sec)' }}>
                                Página {currentPage} de {totalPages} — {filtered.length} documentos
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
                </motion.div>
            )}

            {/* ─── MODAL VER DETALLE ─── */}
            <AnimatePresence>
                {viewingDoc && (
                    <AnuladoDetailModal
                        doc={viewingDoc}
                        onClose={() => setViewingDoc(null)}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};
