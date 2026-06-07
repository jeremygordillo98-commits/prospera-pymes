import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileText, Zap, Sparkles, CheckCircle2, Search, Filter, ChevronLeft, ChevronRight, Receipt, FileMinus, RefreshCw, Eye, Edit2, Ban } from 'lucide-react';
import { XMLUploadModal } from '../components/XMLUploadModal';
import { WithholdingUploadModal } from '../components/WithholdingUploadModal';
import { DocumentDetailsSRIModal } from '../components/DocumentDetailsSRIModal';
import { EditMappingSRIModal } from '../components/EditMappingSRIModal';
import { supabase } from '../services/supabase';
import { CustomModal } from '../components/CustomModal';

interface SRIAutomationProps {
    tipo: 'Compras' | 'Ventas';
    empresaId: string;
}

interface DocSRI {
    id: string;
    clave_acceso_xml: string;
    base_12: number;
    base_0: number;
    base_no_objeto: number;
    monto_iva: number;
    retenciones_aplicadas: Array<{ 
        base: number; 
        valor: number; 
        tipo: string; 
        codigo?: string | number; 
        porcentaje?: number; 
        numero_retencion?: string; 
        fecha_retencion?: string; 
    }> | null;
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
    const prevUploadOpen = useRef(false);
    const [annulModal, setAnnulModal] = useState<{
        isOpen: boolean;
        step: 'confirm' | 'reason';
        confirmText: string;
        promptText: string;
        onSuccess: (reason: string) => void;
    }>({
        isOpen: false,
        step: 'confirm',
        confirmText: '',
        promptText: '',
        onSuccess: () => {}
    });
    const [annulReasonInput, setAnnulReasonInput] = useState('');
    const [alertModal, setAlertModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        type: 'success' | 'error' | 'info' | 'warning';
    }>({
        isOpen: false,
        title: '',
        message: '',
        type: 'info'
    });

    const showAlert = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
        const title = type === 'success' ? 'Éxito' : type === 'error' ? 'Error' : type === 'warning' ? 'Advertencia' : 'Información';
        setAlertModal({ isOpen: true, title, message, type });
    };

    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
    }>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => {}
    });

    const showConfirm = (message: string, onConfirm: () => void, title: string = 'Confirmar') => {
        setConfirmModal({ isOpen: true, title, message, onConfirm });
    };

    // Shared accounts state
    const [accounts, setAccounts] = useState<any[]>([]);
    const [selectedDocForWithholding, setSelectedDocForWithholding] = useState<DocSRI | null>(null);
    const [viewingDoc, setViewingDoc] = useState<DocSRI | null>(null);
    const [editingDoc, setEditingDoc] = useState<DocSRI | null>(null);

    // Fetch PlanCuentas accounts once for the child components
    const fetchAccounts = async () => {
        if (!empresaId) return;
        const { data } = await supabase
            .from('plan_cuentas')
            .select('id, codigo_cuenta, nombre, tipo')
            .eq('id_empresa', empresaId)
            .eq('acepta_movimientos', true)
            .order('codigo_cuenta');
        if (data) {
            setAccounts(data);
        }
    };

    // Body scroll lock when modals are open
    useEffect(() => {
        if (viewingDoc || editingDoc || selectedDocForWithholding || isUploadOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [viewingDoc, editingDoc, selectedDocForWithholding, isUploadOpen]);




    const fetchDocumentos = useCallback(async () => {
        if (!empresaId) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('documentos_sri')
                .select(`
                    id, clave_acceso_xml, base_12, base_0, base_no_objeto, monto_iva, retenciones_aplicadas, created_at,
                    transacciones (
                        id, fecha, concepto, tipo_comprobante, numero_comprobante,
                        entidades ( nombre, ruc_cedula )
                    )
                `)
                .eq('id_empresa', empresaId)
                .eq('es_compra', tipo === 'Compras')
                .order('created_at', { ascending: false });

            if (!error && data) {
                setDocumentos(data as any);

                // Self-healing: if any document has base_12 = 0 but has IVA > 0,
                // fetch its contable movements to find the actual subtotal base and update documentos_sri in Supabase!
                data.forEach(async (doc: any) => {
                    const isFactNC = doc.transacciones?.tipo_comprobante === 'Factura' || doc.transacciones?.tipo_comprobante === 'Nota de Crédito';
                    const docBase12 = parseFloat(doc.base_12) || 0;
                    const docMontoIva = parseFloat(doc.monto_iva) || 0;
                    
                    if (isFactNC && docBase12 === 0 && docMontoIva > 0 && doc.transacciones?.id) {
                        try {
                            const { data: movs } = await supabase
                                .from('movimientos')
                                .select('debe, haber')
                                .eq('id_transaccion', doc.transacciones.id);
                            
                            if (movs && movs.length > 0) {
                                // Find the movement whose 'debe' is exactly equal to the doc's IVA, 
                                // and extract the expense base from other 'debe' movements.
                                const ivaMov = movs.find(m => parseFloat(m.debe) === docMontoIva);
                                const expenseMovs = movs.filter(m => parseFloat(m.debe) > 0 && m !== ivaMov);
                                const actualBase = expenseMovs.reduce((sum, m) => sum + (parseFloat(m.debe) || 0), 0);

                                if (actualBase > 0) {
                                    // Update Supabase permanently
                                    await supabase
                                        .from('documentos_sri')
                                        .update({ base_12: actualBase })
                                        .eq('id', doc.id);
                                    
                                    // Update local state so it updates on screen immediately
                                    setDocumentos(prev => prev.map(d => d.id === doc.id ? { ...d, base_12: actualBase } : d));
                                }
                            }
                        } catch (e) {
                            console.error("Self-healing failed for doc:", doc.id, e);
                        }
                    }
                });
            }
        } catch (err) {
            console.error('Error fetching documentos SRI:', err);
        } finally {
            setLoading(false);
        }
    }, [empresaId, tipo]);

    // Carga inicial
    useEffect(() => {
        fetchDocumentos();
        fetchAccounts();
    }, [fetchDocumentos, empresaId]);

    // Refetch cuando se cierra el panel de carga masiva
    useEffect(() => {
        if (prevUploadOpen.current && !isUploadOpen) {
            fetchDocumentos();
        }
        prevUploadOpen.current = isUploadOpen;
    }, [isUploadOpen, fetchDocumentos]);

    // Refetch cuando el usuario vuelve a la pestaña del navegador
    useEffect(() => {
        const handleVisibility = () => {
            if (document.visibilityState === 'visible' && !isUploadOpen) {
                fetchDocumentos();
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);
        return () => document.removeEventListener('visibilitychange', handleVisibility);
    }, [fetchDocumentos, isUploadOpen]);

    // Supabase Realtime: escucha inserciones/eliminaciones en documentos_sri
    useEffect(() => {
        if (!empresaId) return;
        const channel = supabase
            .channel(`documentos_sri_${empresaId}_${tipo}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'documentos_sri',
                    filter: `id_empresa=eq.${empresaId}`
                },
                () => {
                    // Nuevo documento insertado o eliminado → refrescar lista
                    fetchDocumentos();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [empresaId, tipo, fetchDocumentos]);



    const handleAnular = (doc: DocSRI) => {
        setAnnulModal({
            isOpen: true,
            step: 'confirm',
            confirmText: `¿Estás seguro de anular el comprobante ${doc.transacciones?.numero_comprobante || ''}? Se conservará el registro con valores en cero para el reporte del SRI (ATS), se anularán sus movimientos contables en el Libro Diario y se eliminará/anulará su saldo en Tesorería.`,
            promptText: 'Por favor, ingresa el motivo de la anulación:',
            onSuccess: async (reason) => {
                const ahora = new Date().toLocaleString('es-EC', { 
                    day: '2-digit', 
                    month: '2-digit', 
                    year: 'numeric',
                    hour: '2-digit', 
                    minute: '2-digit', 
                    second: '2-digit' 
                });

                setDeletingId(doc.id);
                try {
                    const idTransaccion = doc.transacciones?.id;
                    
                    // 1. Modificar la transacción en Supabase
                    if (idTransaccion) {
                        const oldConcepto = doc.transacciones?.concepto || '';
                        const cleanConcept = oldConcepto.startsWith('[ANULADO]') ? oldConcepto.replace(/^\[ANULADO\]\s*/, '') : oldConcepto;
                        const newConcepto = `[ANULADO] Motivo: ${reason} | Fecha: ${ahora} | ${cleanConcept}`;
                
                        await supabase
                            .from('transacciones')
                            .update({ 
                                concepto: newConcepto,
                                tipo_comprobante: 'Anulado'
                            })
                            .eq('id', idTransaccion);
                        
                        // 2. Eliminar todos los movimientos asociados a esta transacción para anular el impacto en el Libro Diario
                        await supabase
                            .from('movimientos')
                            .delete()
                            .eq('id_transaccion', idTransaccion);
                    }

                    // 3. Modificar documentos_sri a valores cero (guardando originales en concepto)
                    // Los valores originales ya están en el concepto via newConcepto
                    const valoresOriginales = JSON.stringify({
                        base_12: doc.base_12 || 0,
                        base_0: doc.base_0 || 0,
                        base_no_objeto: doc.base_no_objeto || 0,
                        monto_iva: doc.monto_iva || 0,
                        retenciones_aplicadas: doc.retenciones_aplicadas || []
                    });

                    // Actualizar concepto con valores originales embebidos
                    if (idTransaccion) {
                        const conceptoConValores = `${newConcepto} | ValoresOriginales: ${valoresOriginales}`;
                        await supabase
                            .from('transacciones')
                            .update({ concepto: conceptoConValores })
                            .eq('id', idTransaccion);
                    }

                    await supabase
                        .from('documentos_sri')
                        .update({ 
                            base_12: 0,
                            base_0: 0,
                            base_no_objeto: 0,
                            monto_iva: 0,
                            retenciones_aplicadas: []
                        })
                        .eq('id', doc.id);

                    // 4. Eliminar el documento de Tesorería relacionado
                    if (doc.transacciones?.numero_comprobante) {
                        await supabase
                            .from('tesoreria_documentos')
                            .delete()
                            .eq('id_empresa', empresaId)
                            .eq('referencia', doc.transacciones.numero_comprobante);
                    }

                    setAlertModal({
                        isOpen: true,
                        title: 'Éxito',
                        message: 'Comprobante anulado exitosamente contable y tributariamente.',
                        type: 'success'
                    });
                    fetchDocumentos();
                } catch (err) {
                    console.error('Error voiding doc:', err);
                    setAlertModal({
                        isOpen: true,
                        title: 'Error',
                        message: 'Error al anular el documento.',
                        type: 'error'
                    });
                } finally {
                    setDeletingId(null);
                }
            }
        });
    };

    // Filtrado
    const filtered = documentos.filter(doc => {
        const concepto = doc.transacciones?.concepto?.toLowerCase() || '';
        const numero = doc.transacciones?.numero_comprobante?.toLowerCase() || '';
        const entidad = doc.transacciones?.entidades?.nombre?.toLowerCase() || '';
        const matchSearch = !search || concepto.includes(search.toLowerCase()) || numero.includes(search.toLowerCase()) || entidad.includes(search.toLowerCase());
        const matchTipo = !filterTipo || doc.transacciones?.tipo_comprobante === filterTipo;
        // Los anulados ya no aparecen aquí — tienen su propia sección en el menú
        const notAnulado = doc.transacciones?.tipo_comprobante !== 'Anulado';
        return matchSearch && matchTipo && notAnulado;
    });

    const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
    const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

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
        <div className="sri-automation-container">
            {isUploadOpen ? (
                <XMLUploadModal
                    isOpen={isUploadOpen}
                    tipo={tipo}
                    empresaId={empresaId}
                    onClose={() => setIsUploadOpen(false)}
                    onSuccess={() => {
                        setIsUploadOpen(false);
                        fetchDocumentos();
                    }}
                />
            ) : (
                <>
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

                                                    // --- Extraer número SRI del XML (para mostrar debajo del badge) ---
                                                    // Buscamos en concepto primero (más confiable) luego en clave_acceso_xml
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

                                                    // --- Número secuencial del comprobante (orden en libro diario) ---
                                                    // Si numero_comprobante es un entero simple, es el secuencial del sistema
                                                    // Si tiene formato SRI, el secuencial es la posición en el listado ordenado
                                                    const secuencialDisplay = isSRIFormat
                                                        ? String(filtered.length - ((currentPage - 1) * ITEMS_PER_PAGE + idx))
                                                        : numComp || String(filtered.length - ((currentPage - 1) * ITEMS_PER_PAGE + idx));

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
                                                            {/* TIPO + número de factura/NC debajo */}
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
                                                            {/* COMPROBANTE secuencial */}
                                                            <td style={{ padding: '12px', fontSize: '0.82rem', fontWeight: 700, fontFamily: 'monospace', textAlign: 'center' }}>
                                                                {secuencialDisplay}
                                                            </td>
                                                            <td style={{ padding: '12px', fontSize: '0.82rem', color: 'var(--text-sec)', whiteSpace: 'nowrap' }}>
                                                                {doc.transacciones?.fecha ? new Date(doc.transacciones.fecha).toLocaleDateString('es-EC') : '—'}
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
                </>
            )}



            {/* Reusable Modals */}
            <CustomModal
                isOpen={annulModal.isOpen && annulModal.step === 'confirm'}
                onClose={() => setAnnulModal(prev => ({ ...prev, isOpen: false }))}
                title="Confirmar Anulación"
                type="confirm"
                message={annulModal.confirmText}
                confirmLabel="Continuar"
                cancelLabel="Cancelar"
                onConfirm={() => setAnnulModal(prev => ({ ...prev, step: 'reason' }))}
            />

            <CustomModal
                isOpen={annulModal.isOpen && annulModal.step === 'reason'}
                onClose={() => {
                    setAnnulModal(prev => ({ ...prev, isOpen: false }));
                    setAnnulReasonInput('');
                }}
                title="Motivo de Anulación"
                type="prompt"
                message={annulModal.promptText}
                confirmLabel="Confirmar Anulación"
                cancelLabel="Cancelar"
                inputValue={annulReasonInput}
                onInputChange={setAnnulReasonInput}
                inputPlaceholder="Ej. Error de cuenta, digitación incorrecta..."
                onConfirm={() => {
                    const reason = annulReasonInput.trim() || 'No especificado';
                    annulModal.onSuccess(reason);
                    setAnnulModal(prev => ({ ...prev, isOpen: false }));
                    setAnnulReasonInput('');
                }}
            />

            <CustomModal
                isOpen={alertModal.isOpen}
                onClose={() => setAlertModal(prev => ({ ...prev, isOpen: false }))}
                title={alertModal.title}
                type={alertModal.type}
                message={alertModal.message}
                confirmLabel="Aceptar"
            />

            <CustomModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                title={confirmModal.title}
                type="confirm"
                message={confirmModal.message}
                confirmLabel="Confirmar"
                cancelLabel="Cancelar"
                onConfirm={() => {
                    confirmModal.onConfirm();
                    setConfirmModal(prev => ({ ...prev, isOpen: false }));
                }}
            />

            {/* Modular Components */}
            <AnimatePresence>
                {editingDoc && (
                    <EditMappingSRIModal
                        editingDoc={editingDoc}
                        onClose={() => setEditingDoc(null)}
                        accounts={accounts}
                        empresaId={empresaId}
                        tipo={tipo}
                        onSuccess={() => {
                            setEditingDoc(null);
                            fetchDocumentos();
                        }}
                        showAlert={showAlert}
                    />
                )}
            </AnimatePresence>

            <AnimatePresence>
                {viewingDoc && (
                    <DocumentDetailsSRIModal
                        viewingDoc={viewingDoc}
                        onClose={() => setViewingDoc(null)}
                        accounts={accounts}
                        empresaId={empresaId}
                        tipo={tipo}
                        onSuccess={() => {
                            fetchDocumentos();
                        }}
                        showAlert={showAlert}
                        showConfirm={showConfirm}
                    />
                )}
            </AnimatePresence>

            <AnimatePresence>
                {selectedDocForWithholding && (
                    <WithholdingUploadModal
                        selectedDoc={selectedDocForWithholding}
                        onClose={() => setSelectedDocForWithholding(null)}
                        accounts={accounts}
                        empresaId={empresaId}
                        tipo={tipo}
                        onSuccess={() => {
                            setSelectedDocForWithholding(null);
                            fetchDocumentos();
                        }}
                        showAlert={showAlert}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};


