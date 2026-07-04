import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Ban, Search, Filter, ChevronLeft, ChevronRight,
    RefreshCw, FileText, FileMinus, Receipt, Eye,
    ArrowDownCircle, ArrowUpCircle
} from 'lucide-react';
import { supabase } from '../services/supabase';
import { AnuladoDetailModal } from '../components/AnuladoDetailModal';
import { 
  parseConceptoAnulado, 
  extractXmlNumero, 
  getAnuladoTipo 
} from '../utils/anuladosHelpers';
import type { DocAnulado } from '../utils/anuladosHelpers';

interface AnuladosSRIProps {
    empresaId: string;
}

const ITEMS_PER_PAGE = 15;

export const AnuladosSRI: React.FC<AnuladosSRIProps> = ({ empresaId }) => {
    const [documentos, setDocumentos] = useState<DocAnulado[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterTipo, setFilterTipo] = useState<'todos' | 'compras' | 'ventas' | 'pagos' | 'cobros'>('todos');
    const [currentPage, setCurrentPage] = useState(1);
    const [viewingDoc, setViewingDoc] = useState<DocAnulado | null>(null);
    const [desde, setDesde] = useState('');
    const [hasta, setHasta] = useState('');

    const fetchAnulados = useCallback(async () => {
        if (!empresaId) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('transacciones')
                .select(`
                    id,
                    fecha,
                    concepto,
                    tipo_comprobante,
                    numero_comprobante,
                    created_at,
                    entidades (
                        nombre,
                        razon_social,
                        ruc_cedula
                    ),
                    documentos_sri (
                        id,
                        clave_acceso_xml,
                        base_12,
                        base_0,
                        base_no_objeto,
                        monto_iva,
                        es_compra,
                        retenciones_aplicadas,
                        created_at
                    )
                `)
                .eq('id_empresa', empresaId)
                .eq('tipo_comprobante', 'Anulado')
                .order('created_at', { ascending: false });

            if (error) throw error;

            const normalized: DocAnulado[] = (data || []).map((tx: any) => {
                const entidad = Array.isArray(tx.entidades) ? tx.entidades[0] : tx.entidades;
                const docSri = Array.isArray(tx.documentos_sri) ? tx.documentos_sri[0] : tx.documentos_sri;
                
                return {
                    id: tx.id,
                    clave_acceso_xml: docSri?.clave_acceso_xml || '',
                    base_12: docSri?.base_12 || 0,
                    base_0: docSri?.base_0 || 0,
                    base_no_objeto: docSri?.base_no_objeto || 0,
                    monto_iva: docSri?.monto_iva || 0,
                    es_compra: docSri ? docSri.es_compra : null,
                    retenciones_aplicadas: docSri?.retenciones_aplicadas || null,
                    created_at: tx.created_at || docSri?.created_at || '',
                    transacciones: {
                        id: tx.id,
                        fecha: tx.fecha,
                        concepto: tx.concepto,
                        tipo_comprobante: tx.tipo_comprobante,
                        numero_comprobante: tx.numero_comprobante,
                        entidades: entidad ? {
                            nombre: entidad.nombre || entidad.razon_social || '',
                            ruc_cedula: entidad.ruc_cedula || ''
                        } : null
                    }
                };
            });

            setDocumentos(normalized);
        } catch (err) {
            console.error('Error fetching anulados:', err);
        } finally {
            setLoading(false);
        }
    }, [empresaId]);

    useEffect(() => {
        fetchAnulados();
    }, [fetchAnulados]);

    useEffect(() => {
        if (viewingDoc) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [viewingDoc]);

    const filtered = documentos.filter(doc => {
        const concepto = doc.transacciones?.concepto?.toLowerCase() || '';
        const numero = doc.transacciones?.numero_comprobante?.toLowerCase() || '';
        const entidad = doc.transacciones?.entidades?.nombre?.toLowerCase() || '';
        const matchSearch = !search ||
            concepto.includes(search.toLowerCase()) ||
            numero.includes(search.toLowerCase()) ||
            entidad.includes(search.toLowerCase());

        let matchTipo = true;
        const tipo = getAnuladoTipo(doc);
        if (filterTipo === 'compras') matchTipo = tipo === 'XML Compras';
        if (filterTipo === 'ventas') matchTipo = tipo === 'XML Ventas';
        if (filterTipo === 'pagos') matchTipo = tipo === 'Pago a Proveedor';
        if (filterTipo === 'cobros') matchTipo = tipo === 'Cobro a Cliente';

        const f = doc.transacciones?.fecha || '';
        const matchDesde = !desde || f >= desde;
        const matchHasta = !hasta || f <= hasta;

        return matchSearch && matchTipo && matchDesde && matchHasta;
    });

    const sumTotalOrig = React.useMemo(() => {
        return filtered.reduce((sum, doc) => {
            const valOrig = parseConceptoAnulado(doc.transacciones?.concepto || '').valoresOriginales;
            if (valOrig) {
                const total = valOrig.total !== undefined ? valOrig.total : (valOrig.base_12||0) + (valOrig.base_0||0) + (valOrig.base_no_objeto||0) + (valOrig.monto_iva||0);
                return sum + (total || 0);
            }
            return sum;
        }, 0);
    }, [filtered]);

    const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
    const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    const formatDate = (dateStr: string) =>
        dateStr ? new Date(dateStr + 'T12:00:00').toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

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
                        No hay transacciones anuladas. Cuando anules una factura desde XML Compras/Ventas o un pago/cobro desde Tesorería, aparecerá aquí.
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-sec)', fontWeight: 700 }}>Desde:</span>
                            <input
                                type="date"
                                value={desde}
                                onChange={e => { setDesde(e.target.value); setCurrentPage(1); }}
                                style={{ padding: '8px 12px', borderRadius: 12, border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-main)', fontSize: '0.85rem' }}
                            />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-sec)', fontWeight: 700 }}>Hasta:</span>
                            <input
                                type="date"
                                value={hasta}
                                onChange={e => { setHasta(e.target.value); setCurrentPage(1); }}
                                style={{ padding: '8px 12px', borderRadius: 12, border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-main)', fontSize: '0.85rem' }}
                            />
                        </div>
                        <div style={{ position: 'relative' }}>
                            <Filter size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-sec)' }} />
                            <select
                                value={filterTipo}
                                onChange={e => { setFilterTipo(e.target.value as any); setCurrentPage(1); }}
                                style={{ paddingLeft: 36, padding: '10px 12px 10px 36px', borderRadius: 12, border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-main)', fontSize: '0.9rem' }}
                            >
                                <option value="todos">Todos los Tipos</option>
                                <option value="compras">XML Compras</option>
                                <option value="ventas">XML Ventas</option>
                                <option value="pagos">Pago a Proveedor</option>
                                <option value="cobros">Cobro a Cliente</option>
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
                                             const parsedC = parseConceptoAnulado(concepto);
                                             const conceptoOrig = parsedC.conceptoOriginal;

                                             const isXml = doc.es_compra !== null;
                                             const tipo = getAnuladoTipo(doc);

                                             let tipoOriginal = '';
                                             let tipoIcon = null;

                                             if (isXml) {
                                                 const isRet = conceptoOrig.toLowerCase().includes('retención') || conceptoOrig.toLowerCase().includes('retencion');
                                                 const isNC = conceptoOrig.toLowerCase().includes('nc:') || conceptoOrig.toLowerCase().includes('nota de crédito') || conceptoOrig.toLowerCase().includes('nota de credito');
                                                 tipoOriginal = isRet ? 'Retención' : isNC ? 'Nota de Crédito' : 'Factura';
                                                 tipoIcon = isRet ? <Receipt size={13} /> : isNC ? <FileMinus size={13} /> : <FileText size={13} />;
                                             } else {
                                                 const isCobro = tipo === 'Cobro a Cliente';
                                                 tipoOriginal = isCobro ? 'Cobro' : 'Pago';
                                                 tipoIcon = isCobro ? <ArrowDownCircle size={13} /> : <ArrowUpCircle size={13} />;
                                             }

                                             // Número SRI del XML
                                             const numComp = (doc.transacciones?.numero_comprobante || '').trim();
                                             const xmlNumero = extractXmlNumero(conceptoOrig, numComp, doc.clave_acceso_xml || '');
                                             const isSRIFormat = /\d{3}-\d{3}-\d{9}/.test(numComp);

                                             // Número secuencial (comprobante contable)
                                             const secuencialDisplay = isSRIFormat
                                                 ? String(filtered.length - ((currentPage - 1) * ITEMS_PER_PAGE + idx))
                                                 : numComp || String(filtered.length - ((currentPage - 1) * ITEMS_PER_PAGE + idx));

                                             // Valores originales para mostrar total en tabla
                                             const valOrig = parsedC.valoresOriginales;
                                             const totalOrig = valOrig
                                                 ? (valOrig.total !== undefined ? valOrig.total : (valOrig.base_12||0) + (valOrig.base_0||0) + (valOrig.base_no_objeto||0) + (valOrig.monto_iva||0))
                                                 : null;

                                             let badgeColor = '#6b7280';
                                             let badgeBg = 'rgba(107,114,128,0.1)';
                                             if (tipo === 'XML Compras') {
                                                 badgeColor = '#f59e0b';
                                                 badgeBg = 'rgba(245,158,11,0.1)';
                                             } else if (tipo === 'XML Ventas') {
                                                 badgeColor = '#8b5cf6';
                                                 badgeBg = 'rgba(139,92,246,0.1)';
                                             } else if (tipo === 'Pago a Proveedor') {
                                                 badgeColor = '#10b981';
                                                 badgeBg = 'rgba(16,185,129,0.1)';
                                             } else if (tipo === 'Cobro a Cliente') {
                                                 badgeColor = '#3b82f6';
                                                 badgeBg = 'rgba(59,130,246,0.1)';
                                             }

                                             return (
                                                 <motion.tr
                                                     key={doc.id}
                                                     initial={{ opacity: 0, y: 8 }}
                                                     animate={{ opacity: 1, y: 0 }}
                                                     transition={{ delay: idx * 0.03 }}
                                                     style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.2s', opacity: 0.8 }}
                                                     onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                                                     onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                                 >
                                                     {/* TIPO + número de factura debajo */}
                                                     <td style={{ padding: '12px 12px' }}>
                                                         <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                                             <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', fontWeight: 700, color: '#6b7280', background: 'rgba(107,114,128,0.1)', padding: '4px 10px', borderRadius: 20, whiteSpace: 'nowrap', textDecoration: 'line-through' }}>
                                                                 {tipoIcon} {tipoOriginal}
                                                             </span>
                                                             <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', fontWeight: 700, color: '#ef4444' }}>
                                                                 <Ban size={11} /> Anulado
                                                             </span>
                                                         </div>
                                                         {xmlNumero && (
                                                             <div style={{ fontFamily: 'monospace', fontSize: '0.68rem', color: 'var(--text-sec)', marginTop: 5, letterSpacing: '0.3px', whiteSpace: 'nowrap' }}>
                                                                 {xmlNumero}
                                                             </div>
                                                         )}
                                                     </td>
                                                     {/* Entidad */}
                                                     <td style={{ padding: '12px', fontSize: '0.85rem', fontWeight: 600, maxWidth: 180 }}>
                                                         <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.transacciones?.entidades?.nombre || '—'}</div>
                                                         <div style={{ fontSize: '0.72rem', color: 'var(--text-sec)', marginTop: 2 }}>{doc.transacciones?.entidades?.ruc_cedula || ''}</div>
                                                     </td>
                                                     {/* Comprobante secuencial */}
                                                     <td style={{ padding: '12px', fontSize: '0.82rem', fontWeight: 700, fontFamily: 'monospace', textAlign: 'center', color: '#6b7280' }}>
                                                         {secuencialDisplay}
                                                         {totalOrig !== null && (
                                                             <div style={{ fontSize: '0.7rem', color: '#6b7280', textDecoration: 'line-through', marginTop: 2, fontWeight: 400 }}>
                                                                 ${totalOrig.toFixed(2)}
                                                             </div>
                                                         )}
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
                                                             color: badgeColor,
                                                             background: badgeBg,
                                                             padding: '3px 10px', borderRadius: 20
                                                         }}>
                                                             {tipo}
                                                         </span>
                                                     </td>
                                                     {/* Acciones */}
                                                     <td style={{ padding: '12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                                         <button
                                                             onClick={() => setViewingDoc(doc)}
                                                             title="Ver detalle"
                                                             style={{ background: 'rgba(59,130,246,0.1)', border: 'none', color: '#3b82f6', cursor: 'pointer', padding: '6px 12px', borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', fontWeight: 700 }}
                                                         >
                                                             <Eye size={14} /> Ver
                                                         </button>
                                                     </td>
                                                 </motion.tr>
                                             );
                                         })}
                                     </tbody>
                                </AnimatePresence>
                                <tfoot>
                                    <tr style={{ background: 'var(--primary-light)', fontWeight: 900, borderTop: '2px solid var(--border-color)', borderBottom: '2px solid var(--border-color)' }}>
                                        <td colSpan={2} style={{ padding: '12px 12px', fontSize: '0.78rem', textTransform: 'uppercase', color: 'var(--text-main)' }}>TOTAL ORIGINAL FILTRADO</td>
                                        <td style={{ padding: '12px 12px', textAlign: 'center', color: '#6b7280', textDecoration: 'line-through' }}>
                                            ${sumTotalOrig.toFixed(2)}
                                        </td>
                                        <td colSpan={3}></td>
                                    </tr>
                                </tfoot>
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
