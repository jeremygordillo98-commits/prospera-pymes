import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileText, Zap, Sparkles, CheckCircle2, Trash2, Search, Filter, ChevronLeft, ChevronRight, Receipt, FileMinus, RefreshCw } from 'lucide-react';
import { XMLUploadModal } from '../components/XMLUploadModal';
import { supabase } from '../services/supabase';

interface SRIAutomationProps {
    tipo: 'Compras' | 'Ventas';
    empresaId: string;
}

interface DocSRI {
    id: string;
    clave_acceso_xml: string;
    base_12: number;
    monto_iva: number;
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

const ITEMS_PER_PAGE = 10;

export const SRIAutomation: React.FC<SRIAutomationProps> = ({ tipo, empresaId }) => {
    const [isUploadOpen, setIsUploadOpen] = useState(false);
    const [documentos, setDocumentos] = useState<DocSRI[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterTipo, setFilterTipo] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const fetchDocumentos = useCallback(async () => {
        if (!empresaId) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('documentos_sri')
                .select(`
                    id, clave_acceso_xml, base_12, monto_iva, created_at,
                    transacciones (
                        id, fecha, concepto, tipo_comprobante, numero_comprobante,
                        entidades ( nombre, ruc_cedula )
                    )
                `)
                .eq('id_empresa', empresaId)
                .order('created_at', { ascending: false });

            if (!error && data) {
                setDocumentos(data as any);
            }
        } catch (err) {
            console.error('Error fetching documentos SRI:', err);
        } finally {
            setLoading(false);
        }
    }, [empresaId]);

    useEffect(() => {
        fetchDocumentos();
    }, [fetchDocumentos]);

    const handleDelete = async (doc: DocSRI) => {
        if (!confirm(`¿Eliminar el documento ${doc.transacciones?.numero_comprobante || doc.clave_acceso_xml.slice(-10)}? Esta acción también eliminará el asiento contable relacionado.`)) return;
        setDeletingId(doc.id);
        try {
            // Eliminar el documento SRI (el asiento se puede eliminar en cascada desde Supabase o manualmente)
            await supabase.from('documentos_sri').delete().eq('id', doc.id);
            if (doc.transacciones?.id) {
                await supabase.from('movimientos').delete().eq('id_transaccion', doc.transacciones.id);
                await supabase.from('transacciones').delete().eq('id', doc.transacciones.id);
            }
            setDocumentos(prev => prev.filter(d => d.id !== doc.id));
        } catch (err) {
            console.error('Error deleting doc:', err);
            alert('Error al eliminar el documento.');
        } finally {
            setDeletingId(null);
        }
    };

    // Filtrado
    const filtered = documentos.filter(doc => {
        const concepto = doc.transacciones?.concepto?.toLowerCase() || '';
        const numero = doc.transacciones?.numero_comprobante?.toLowerCase() || '';
        const entidad = doc.transacciones?.entidades?.nombre?.toLowerCase() || '';
        const matchSearch = !search || concepto.includes(search.toLowerCase()) || numero.includes(search.toLowerCase()) || entidad.includes(search.toLowerCase());
        const matchTipo = !filterTipo || doc.transacciones?.tipo_comprobante === filterTipo;
        return matchSearch && matchTipo;
    });

    const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
    const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    const getTipoIcon = (tipo: string) => {
        if (tipo?.includes('Retención')) return <Receipt size={14} />;
        if (tipo?.includes('Crédito')) return <FileMinus size={14} />;
        return <FileText size={14} />;
    };

    const getTipoColor = (tipo: string) => {
        if (tipo?.includes('Retención')) return 'var(--warning)';
        if (tipo?.includes('Crédito')) return 'var(--error)';
        return 'var(--primary)';
    };

    return (
        <div className="sri-automation-container">
            {/* ─── HEADER ─── */}
            <header className="flex-between" style={{ marginBottom: '40px', flexWrap: 'wrap', gap: 16 }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', fontWeight: 800, textTransform: 'uppercase', fontSize: '0.8rem', letterSpacing: '2px', marginBottom: '8px' }}>
                        <Zap size={14} /> Automatización SRI
                    </div>
                    <h1 className="h1" style={{ fontSize: '2.5rem', fontWeight: 900 }}>XML {tipo}</h1>
                    <p className="text-sec" style={{ fontSize: '1.1rem' }}>
                        Sincroniza tus facturas electrónicas con tu contabilidad.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                        onClick={fetchDocumentos}
                        className="btn"
                        style={{ padding: '12px', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: 8 }}
                        title="Refrescar"
                    >
                        <RefreshCw size={18} />
                    </button>
                    <button
                        onClick={() => setIsUploadOpen(true)}
                        className="btn btn-primary"
                        style={{ padding: '14px 28px', borderRadius: '18px', fontSize: '1rem', fontWeight: 800, letterSpacing: '0.5px' }}
                    >
                        <Upload size={20} /> Cargar XML
                    </button>
                </div>
            </header>

            {/* ─── EMPTY STATE ─── */}
            {!loading && documentos.length === 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-card"
                    style={{ padding: '60px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
                >
                    <div style={{ width: 80, height: 80, background: 'var(--primary-light)', borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', marginBottom: '24px' }}>
                        <Sparkles size={40} />
                    </div>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '16px' }}>Procesador Masivo de XML</h2>
                    <p className="text-sec" style={{ maxWidth: '500px', fontSize: '1.1rem', marginBottom: '32px' }}>
                        Sube tus archivos electrónicos y el sistema creará automáticamente los asientos contables,
                        vinculará a los proveedores y preparará tus anexos del SRI.
                    </p>
                    <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', justifyContent: 'center' }}>
                        {['Mapeo Automático de Cuentas', 'Detección de Proveedores', 'Validación de Doble Partida'].map(f => (
                            <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.9rem', color: 'var(--text-sec)' }}>
                                <div style={{ padding: '6px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', borderRadius: '8px' }}>
                                    <CheckCircle2 size={16} />
                                </div>
                                {f}
                            </div>
                        ))}
                    </div>
                </motion.div>
            )}

            {/* ─── HISTORIAL ─── */}
            {(loading || documentos.length > 0) && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card" style={{ padding: '28px' }}>
                    {/* Filtros */}
                    <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
                        <h3 style={{ margin: 0, fontWeight: 800, flex: 1, minWidth: 200 }}>
                            Historial de Documentos
                            <span style={{ marginLeft: 10, fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-sec)', background: 'var(--primary-light)', padding: '3px 10px', borderRadius: 20 }}>
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
                                onChange={e => { setFilterTipo(e.target.value); setCurrentPage(1); }}
                                style={{ paddingLeft: 36, padding: '10px 12px 10px 36px', borderRadius: 12, border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-main)', fontSize: '0.9rem' }}
                            >
                                <option value="">Todos los tipos</option>
                                <option value="Factura">Factura</option>
                                <option value="Comprobante de Retención">Retención</option>
                                <option value="Nota de Crédito">Nota de Crédito</option>
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
                                        {['Tipo', 'Entidad', 'Comprobante', 'Fecha', 'Base 12%', 'IVA', 'Total', ''].map(h => (
                                            <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-sec)', whiteSpace: 'nowrap' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <AnimatePresence>
                                    <tbody>
                                        {paginated.map((doc, idx) => {
                                            const tc = doc.transacciones?.tipo_comprobante || '';
                                            const total = (doc.base_12 || 0) + (doc.monto_iva || 0);
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
                                                    <td style={{ padding: '12px 12px' }}>
                                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', fontWeight: 700, color: getTipoColor(tc), background: `${getTipoColor(tc)}18`, padding: '4px 10px', borderRadius: 20, whiteSpace: 'nowrap' }}>
                                                            {getTipoIcon(tc)} {tc || '—'}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '12px', fontSize: '0.85rem', fontWeight: 600, maxWidth: 180 }}>
                                                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.transacciones?.entidades?.nombre || '—'}</div>
                                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-sec)', marginTop: 2 }}>{doc.transacciones?.entidades?.ruc_cedula || ''}</div>
                                                    </td>
                                                    <td style={{ padding: '12px', fontSize: '0.82rem', fontWeight: 600, fontFamily: 'monospace' }}>
                                                        {doc.transacciones?.numero_comprobante || '—'}
                                                    </td>
                                                    <td style={{ padding: '12px', fontSize: '0.82rem', color: 'var(--text-sec)', whiteSpace: 'nowrap' }}>
                                                        {doc.transacciones?.fecha ? new Date(doc.transacciones.fecha).toLocaleDateString('es-EC') : '—'}
                                                    </td>
                                                    <td style={{ padding: '12px', fontSize: '0.85rem', fontWeight: 700, textAlign: 'right' }}>
                                                        ${(doc.base_12 || 0).toFixed(2)}
                                                    </td>
                                                    <td style={{ padding: '12px', fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 700, textAlign: 'right' }}>
                                                        ${(doc.monto_iva || 0).toFixed(2)}
                                                    </td>
                                                    <td style={{ padding: '12px', fontSize: '0.9rem', fontWeight: 900, textAlign: 'right', whiteSpace: 'nowrap' }}>
                                                        ${total.toFixed(2)}
                                                    </td>
                                                    <td style={{ padding: '12px', textAlign: 'right' }}>
                                                        <button
                                                            onClick={() => handleDelete(doc)}
                                                            disabled={deletingId === doc.id}
                                                            title="Eliminar documento y asiento"
                                                            style={{ background: 'rgba(239,68,68,0.1)', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: '6px 10px', borderRadius: 10, display: 'inline-flex', alignItems: 'center', transition: 'all 0.2s' }}
                                                        >
                                                            <Trash2 size={15} />
                                                        </button>
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

            <XMLUploadModal
                isOpen={isUploadOpen}
                empresaId={empresaId}
                onClose={() => setIsUploadOpen(false)}
                onSuccess={() => {
                    setIsUploadOpen(false);
                    fetchDocumentos();
                }}
            />
        </div>
    );
};
