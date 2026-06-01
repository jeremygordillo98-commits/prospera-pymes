import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileText, Zap, Sparkles, CheckCircle2, Trash2, Search, Filter, ChevronLeft, ChevronRight, Receipt, FileMinus, RefreshCw, X, Loader2, Eye, Edit2, Save, Ban } from 'lucide-react';
import { XMLUploadModal } from '../components/XMLUploadModal';
import { AccountSelector } from '../components/AccountSelector';
import { parseSRIXML } from '../utils/sriParser';
import { CATALOGO_RETENCIONES_RENTA, CATALOGO_RETENCIONES_IVA } from '../utils/sriCatalog';
import { supabase } from '../services/supabase';

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

    // Withholding states
    const [selectedDocForWithholding, setSelectedDocForWithholding] = useState<DocSRI | null>(null);
    const [withholdingLoading, setWithholdingLoading] = useState(false);
    const [parsedWithholding, setParsedWithholding] = useState<any | null>(null);
    const [accounts, setAccounts] = useState<any[]>([]);
    const [selectedWithholdingAccount, setSelectedWithholdingAccount] = useState<string>('');

    // Fetch PlanCuentas accounts for withholding CXP selection
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
            const defRet = data.find(a => a.codigo_cuenta.startsWith('2.1.4') || a.nombre.toLowerCase().includes('retencion'));
            if (defRet) {
                setSelectedWithholdingAccount(defRet.id);
            }
        }
    };

    // View/Edit states
    const [viewingDoc, setViewingDoc] = useState<DocSRI | null>(null);
    const [viewingMovements, setViewingMovements] = useState<any[]>([]);
    const [loadingViewingMovs, setLoadingViewingMovs] = useState(false);
    const [editingDoc, setEditingDoc] = useState<DocSRI | null>(null);
    const [editFormData, setEditFormData] = useState({
        idCuentaDebe: '',
        idCuentaIva: '',
        idCuentaHaber: '',
        retencionCodigo: '',
        retencionIvaCodigo: '',
        idCuentaRetencion: ''
    });

    // States for manual withholding in Ver modal
    const [verRetRenta, setVerRetRenta] = useState('');
    const [verRetIva, setVerRetIva] = useState('');

    const getAccountLabel = (idCuenta: string) => {
        const acc = accounts.find(a => a.id === idCuenta);
        return acc ? `${acc.codigo_cuenta} - ${acc.nombre}` : idCuenta;
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

    // Pre-populate manual retention values when viewing modal opens
    useEffect(() => {
        if (viewingDoc) {
            let retRenta = '';
            let retIva = '';
            if (viewingDoc.retenciones_aplicadas && viewingDoc.retenciones_aplicadas.length > 0) {
                const rR = viewingDoc.retenciones_aplicadas.find(r => r.tipo === 'RENTA');
                if (rR) retRenta = rR.codigo?.toString() || '';
                const rI = viewingDoc.retenciones_aplicadas.find(r => r.tipo === 'IVA');
                if (rI) retIva = rI.codigo?.toString() || '';
            }
            setVerRetRenta(retRenta);
            setVerRetIva(retIva);

            // Pre-select default retention account if available
            if (accounts.length > 0) {
                const defRet = accounts.find(a => a.codigo_cuenta.startsWith('2.1.4') || a.nombre.toLowerCase().includes('retencion'));
                if (defRet) {
                    setSelectedWithholdingAccount(defRet.id);
                }
            }
        }
    }, [viewingDoc, accounts]);

    useEffect(() => {
        const fetchViewingMovs = async () => {
            if (!viewingDoc || !viewingDoc.transacciones?.id) {
                setViewingMovements([]);
                return;
            }
            setLoadingViewingMovs(true);
            try {
                const { data, error } = await supabase
                    .from('movimientos')
                    .select('*')
                    .eq('id_transaccion', viewingDoc.transacciones.id);
                if (data && !error) {
                    setViewingMovements(data);
                }
            } catch (err) {
                console.error("Error fetching movements for viewingDoc:", err);
            } finally {
                setLoadingViewingMovs(false);
            }
        };
        fetchViewingMovs();
    }, [viewingDoc]);

    const handleOpenEditModal = async (doc: DocSRI) => {
        const idTransaccion = doc.transacciones?.id;
        if (!idTransaccion) {
            alert("No hay transacción contable asociada a este documento.");
            return;
        }

        // Fetch movements of this transaction to see which accounts are mapped
        const { data: movs, error } = await supabase
            .from('movimientos')
            .select('*')
            .eq('id_transaccion', idTransaccion);
        
        if (error || !movs) {
            alert("Error al cargar las cuentas contables asociadas.");
            return;
        }

        const defaultIva = accounts.find(a => a.codigo_cuenta.startsWith('1.1.09') || a.nombre.toLowerCase().includes('iva'));
        const movIva = movs.find(m => m.id_cuenta === defaultIva?.id || m.id_cuenta.toLowerCase().includes('iva') || (m.debe > 0 && m.debe === doc.monto_iva));
        const idCuentaIva = movIva?.id_cuenta || '';
        
        const movDebe = movs.find(m => m.debe > 0 && m.id_cuenta !== idCuentaIva);
        const idCuentaDebe = movDebe?.id_cuenta || '';

        const movHaber = movs.find(m => m.haber > 0 && !m.id_cuenta.startsWith('2.1.4') && !m.id_cuenta.toLowerCase().includes('retencion'));
        const idCuentaHaber = movHaber?.id_cuenta || '';

        const movRet = movs.find(m => m.haber > 0 && (m.id_cuenta.startsWith('2.1.4') || m.id_cuenta.toLowerCase().includes('retencion')));
        const idCuentaRetencion = movRet?.id_cuenta || '';

        let retCodigo = '';
        let retIvaCodigo = '';
        if (doc.retenciones_aplicadas && doc.retenciones_aplicadas.length > 0) {
            const retRenta = doc.retenciones_aplicadas.find(r => r.tipo === 'RENTA');
            if (retRenta) retCodigo = retRenta.codigo?.toString() || '';
            
            const retIva = doc.retenciones_aplicadas.find(r => r.tipo === 'IVA');
            if (retIva) retIvaCodigo = retIva.codigo?.toString() || '';
        }

        setEditFormData({
            idCuentaDebe,
            idCuentaIva,
            idCuentaHaber,
            retencionCodigo: retCodigo,
            retencionIvaCodigo: retIvaCodigo,
            idCuentaRetencion
        });
        setEditingDoc(doc);
    };

    const handleSaveEditChanges = async () => {
        if (!editingDoc) return;
        setWithholdingLoading(true);
        try {
            const idTransaccion = editingDoc.transacciones?.id;
            if (!idTransaccion) throw new Error("Transacción no encontrada.");

            const baseGravada = (editingDoc.base_12 || 0) + (editingDoc.base_0 || 0) + (editingDoc.base_no_objeto || 0);
            const ivaMonto = editingDoc.monto_iva || 0;
            const totalFactura = baseGravada + ivaMonto;

            let retencionesFinal: any[] = [];
            let totalRetenido = 0;

            const baseImponibleForRenta = editingDoc.base_12 || baseGravada;

            // 1. Renta Withholding
            if (tipo === 'Compras' && editFormData.retencionCodigo) {
                const retSel = CATALOGO_RETENCIONES_RENTA.find(r => r.codigo === editFormData.retencionCodigo);
                if (retSel) {
                    const valRetCalculado = parseFloat(((baseImponibleForRenta * retSel.porcentaje) / 100).toFixed(2));
                    if (valRetCalculado > 0) {
                        retencionesFinal.push({
                            codigo: retSel.codigo,
                            porcentaje: retSel.porcentaje,
                            base: baseImponibleForRenta,
                            valor: valRetCalculado,
                            tipo: 'RENTA',
                            clave_retencion: '',
                            numero_retencion: '',
                            fecha_retencion: ''
                        });
                        totalRetenido += valRetCalculado;
                    }
                }
            }

            // 2. IVA Withholding
            if (tipo === 'Compras' && editFormData.retencionIvaCodigo) {
                const retSelIva = CATALOGO_RETENCIONES_IVA.find(r => r.codigo === editFormData.retencionIvaCodigo);
                if (retSelIva && retSelIva.porcentaje > 0) {
                    const valRetCalculado = parseFloat(((ivaMonto * retSelIva.porcentaje) / 100).toFixed(2));
                    if (valRetCalculado > 0) {
                        retencionesFinal.push({
                            codigo: retSelIva.codigo,
                            porcentaje: retSelIva.porcentaje,
                            base: ivaMonto,
                            valor: valRetCalculado,
                            tipo: 'IVA',
                            clave_retencion: '',
                            numero_retencion: '',
                            fecha_retencion: ''
                        });
                        totalRetenido += valRetCalculado;
                    }
                }
            }

            const { error: sriErr } = await supabase
                .from('documentos_sri')
                .update({ retenciones_aplicadas: retencionesFinal })
                .eq('id', editingDoc.id);
            
            if (sriErr) throw sriErr;

            const netoAPagar = parseFloat((totalFactura - totalRetenido).toFixed(2));

            await supabase.from('movimientos').delete().eq('id_transaccion', idTransaccion);

            const nuevosMovimientos = [
                { id_transaccion: idTransaccion, id_cuenta: editFormData.idCuentaDebe, debe: baseGravada, haber: 0, id_empresa: empresaId },
                ...(ivaMonto > 0 ? [{ id_transaccion: idTransaccion, id_cuenta: editFormData.idCuentaIva, debe: ivaMonto, haber: 0, id_empresa: empresaId }] : []),
                ...(totalRetenido > 0 ? [{ id_transaccion: idTransaccion, id_cuenta: editFormData.idCuentaRetencion, debe: 0, haber: totalRetenido, id_empresa: empresaId }] : []),
                { id_transaccion: idTransaccion, id_cuenta: editFormData.idCuentaHaber, debe: 0, haber: netoAPagar, id_empresa: empresaId }
            ];

            const { error: mInsertError } = await supabase.from('movimientos').insert(nuevosMovimientos);
            if (mInsertError) throw mInsertError;

            const { data: tesoDoc } = await supabase
                .from('tesoreria_documentos')
                .select('id')
                .eq('id_empresa', empresaId)
                .eq('referencia', editingDoc.transacciones?.numero_comprobante || '')
                .maybeSingle();

            if (tesoDoc) {
                await supabase
                    .from('tesoreria_documentos')
                    .update({
                        saldo_pendiente: netoAPagar,
                        estado: netoAPagar > 0 ? 'Pendiente' : 'Liquidado'
                    })
                    .eq('id', tesoDoc.id);
            }

            alert("Documento contable actualizado exitosamente.");
            setEditingDoc(null);
            fetchDocumentos();
        } catch (err: any) {
            console.error("Error editing document:", err);
            alert(`Error al guardar cambios: ${err.message}`);
        } finally {
            setWithholdingLoading(false);
        }
    };

    useEffect(() => {
        if (empresaId) {
            fetchAccounts();
        }
    }, [empresaId]);

    const handleWithholdingFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setWithholdingLoading(true);
        try {
            const text = await file.text();
            const parsed = await parseSRIXML(text);
            if (parsed && parsed.tipoDocumento === 'COM_RETENCION') {
                setParsedWithholding(parsed);
            } else {
                alert("El archivo no es un Comprobante de Retención válido del SRI.");
                setParsedWithholding(null);
            }
        } catch (err) {
            console.error("Error reading withholding XML:", err);
            alert("Error al leer el archivo XML.");
            setParsedWithholding(null);
        } finally {
            setWithholdingLoading(false);
        }
    };

    const saveWithholding = async (doc: DocSRI, parsedData: any, withholdingAccountId: string) => {
        const idTransaccion = doc.transacciones?.id;
        if (!idTransaccion) {
            throw new Error("La factura seleccionada no posee una transacción contable asociada.");
        }

        // 1. Calcular desglose de la retención del XML
        const retencionesFinal = parsedData.documentosSustento.flatMap((docSust: any) =>
            docSust.retenciones.map((ret: any) => ({
                codigo: ret.codigoRetencion,
                porcentaje: ret.porcentajeRetener,
                base: ret.baseImponible,
                valor: ret.valorRetenido,
                tipo: ret.tipo,
                desc_doc: docSust.numDocSustento,
                cod_doc_sustento: docSust.codDocSustento,
                clave_retencion: parsedData.claveAcceso,
                numero_retencion: parsedData.numeroComprobante,
                fecha_retencion: parsedData.fechaEmision
            }))
        );

        const totalRetenido = parsedData.totalRetenido || 0;

        // 2. Actualizar documentos_sri en Supabase
        const { error: updateError } = await supabase
            .from('documentos_sri')
            .update({ retenciones_aplicadas: retencionesFinal })
            .eq('id', doc.id);

        if (updateError) throw updateError;

        // 3. Sincronizar movimientos de la transacción contable
        const { data: movimientosExistentes, error: mErr } = await supabase
            .from('movimientos')
            .select('*')
            .eq('id_transaccion', idTransaccion);
        
        if (mErr) throw mErr;

        if (movimientosExistentes && movimientosExistentes.length > 0) {
            const defaultIva = accounts.find(a => a.codigo_cuenta.startsWith('1.1.09') || a.nombre.toLowerCase().includes('iva'));
            
            const movIva = movimientosExistentes.find(m => m.id_cuenta === defaultIva?.id || m.id_cuenta.toLowerCase().includes('iva') || (m.debe > 0 && m.debe === doc.monto_iva));
            const idCuentaIva = movIva?.id_cuenta || defaultIva?.id || '';
            
            const movDebe = movimientosExistentes.find(m => m.debe > 0 && m.id_cuenta !== idCuentaIva);
            const idCuentaDebe = movDebe?.id_cuenta || '';

            const movHaber = movimientosExistentes.find(m => m.haber > 0 && !m.id_cuenta.startsWith('2.1.4') && !m.id_cuenta.toLowerCase().includes('retencion'));
            const idCuentaHaber = movHaber?.id_cuenta || '';

            const baseGravada = (doc.base_12 || 0) + (doc.base_0 || 0) + (doc.base_no_objeto || 0);
            const ivaMonto = doc.monto_iva || 0;
            const totalFactura = baseGravada + ivaMonto;
            const netoAPagar = parseFloat((totalFactura - totalRetenido).toFixed(2));

            const idCuentaRetencion = withholdingAccountId || accounts.find(a => a.codigo_cuenta.startsWith('2.1.4'))?.id || '';

            // 4. Eliminar movimientos anteriores
            await supabase.from('movimientos').delete().eq('id_transaccion', idTransaccion);

            // 5. Insertar nuevos movimientos actualizados
            const nuevosMovimientos = [
                { id_transaccion: idTransaccion, id_cuenta: idCuentaDebe, debe: baseGravada, haber: 0, id_empresa: empresaId },
                ...(ivaMonto > 0 ? [{ id_transaccion: idTransaccion, id_cuenta: idCuentaIva, debe: ivaMonto, haber: 0, id_empresa: empresaId }] : []),
                ...(totalRetenido > 0 ? [{ id_transaccion: idTransaccion, id_cuenta: idCuentaRetencion, debe: 0, haber: totalRetenido, id_empresa: empresaId }] : []),
                { id_transaccion: idTransaccion, id_cuenta: idCuentaHaber, debe: 0, haber: netoAPagar, id_empresa: empresaId }
            ];

            const { error: mInsertError } = await supabase.from('movimientos').insert(nuevosMovimientos);
            if (mInsertError) throw mInsertError;

            // 6. Actualizar Tesorería CXP si existe
            const { data: tesoDoc } = await supabase
                .from('tesoreria_documentos')
                .select('id')
                .eq('id_empresa', empresaId)
                .eq('referencia', doc.transacciones?.numero_comprobante || '')
                .maybeSingle();

            if (tesoDoc) {
                await supabase
                    .from('tesoreria_documentos')
                    .update({
                        saldo_pendiente: netoAPagar,
                        estado: netoAPagar > 0 ? 'Pendiente' : 'Liquidado'
                    })
                    .eq('id', tesoDoc.id);
            }
        }
        return retencionesFinal;
    };

    const handleSaveWithholding = async () => {
        if (!selectedDocForWithholding || !parsedWithholding) return;
        setWithholdingLoading(true);
        try {
            await saveWithholding(selectedDocForWithholding, parsedWithholding, selectedWithholdingAccount);
            alert("Retención procesada y contabilidad sincronizada exitosamente.");
            setSelectedDocForWithholding(null);
            setParsedWithholding(null);
            fetchDocumentos();
        } catch (err: any) {
            console.error("Error saving withholding:", err);
            alert(`Error al procesar retención: ${err.message}`);
        } finally {
            setWithholdingLoading(false);
        }
    };

    const applyManualWithholding = async (doc: DocSRI, retRentaCod: string, retIvaCod: string, withholdingAccountId: string) => {
        const idTransaccion = doc.transacciones?.id;
        if (!idTransaccion) {
            throw new Error("La factura seleccionada no posee una transacción contable asociada.");
        }

        const baseGravada = (doc.base_12 || 0) + (doc.base_0 || 0) + (doc.base_no_objeto || 0);
        const ivaMonto = doc.monto_iva || 0;
        const totalFactura = baseGravada + ivaMonto;

        let retencionesFinal: any[] = [];
        let totalRetenido = 0;

        const baseImponibleForRenta = doc.base_12 || baseGravada;

        // 1. Renta Withholding
        if (retRentaCod) {
            const retSel = CATALOGO_RETENCIONES_RENTA.find(r => r.codigo === retRentaCod);
            if (retSel) {
                const valRetCalculado = parseFloat(((baseImponibleForRenta * retSel.porcentaje) / 100).toFixed(2));
                if (valRetCalculado > 0) {
                    retencionesFinal.push({
                        codigo: retSel.codigo,
                        porcentaje: retSel.porcentaje,
                        base: baseImponibleForRenta,
                        valor: valRetCalculado,
                        tipo: 'RENTA',
                        clave_retencion: '',
                        numero_retencion: 'Manual',
                        fecha_retencion: new Date().toISOString().split('T')[0]
                    });
                    totalRetenido += valRetCalculado;
                }
            }
        }

        // 2. IVA Withholding
        if (retIvaCod) {
            const retSelIva = CATALOGO_RETENCIONES_IVA.find(r => r.codigo === retIvaCod);
            if (retSelIva && retSelIva.porcentaje > 0) {
                const valRetCalculado = parseFloat(((ivaMonto * retSelIva.porcentaje) / 100).toFixed(2));
                if (valRetCalculado > 0) {
                    retencionesFinal.push({
                        codigo: retSelIva.codigo,
                        porcentaje: retSelIva.porcentaje,
                        base: ivaMonto,
                        valor: valRetCalculado,
                        tipo: 'IVA',
                        clave_retencion: '',
                        numero_retencion: 'Manual',
                        fecha_retencion: new Date().toISOString().split('T')[0]
                    });
                    totalRetenido += valRetCalculado;
                }
            }
        }

        // 3. Actualizar documentos_sri en Supabase
        const { error: updateError } = await supabase
            .from('documentos_sri')
            .update({ retenciones_aplicadas: retencionesFinal })
            .eq('id', doc.id);

        if (updateError) throw updateError;

        // 4. Sincronizar movimientos de la transacción contable
        const { data: movimientosExistentes, error: mErr } = await supabase
            .from('movimientos')
            .select('*')
            .eq('id_transaccion', idTransaccion);
        
        if (mErr) throw mErr;

        if (movimientosExistentes && movimientosExistentes.length > 0) {
            const defaultIva = accounts.find(a => a.codigo_cuenta.startsWith('1.1.09') || a.nombre.toLowerCase().includes('iva'));
            
            const movIva = movimientosExistentes.find(m => m.id_cuenta === defaultIva?.id || m.id_cuenta.toLowerCase().includes('iva') || (m.debe > 0 && m.debe === doc.monto_iva));
            const idCuentaIva = movIva?.id_cuenta || defaultIva?.id || '';
            
            const movDebe = movimientosExistentes.find(m => m.debe > 0 && m.id_cuenta !== idCuentaIva);
            const idCuentaDebe = movDebe?.id_cuenta || '';

            const movHaber = movimientosExistentes.find(m => m.haber > 0 && !m.id_cuenta.startsWith('2.1.4') && !m.id_cuenta.toLowerCase().includes('retencion'));
            const idCuentaHaber = movHaber?.id_cuenta || '';

            const netoAPagar = parseFloat((totalFactura - totalRetenido).toFixed(2));
            const idCuentaRetencion = withholdingAccountId || accounts.find(a => a.codigo_cuenta.startsWith('2.1.4'))?.id || '';

            // Eliminar movimientos anteriores
            await supabase.from('movimientos').delete().eq('id_transaccion', idTransaccion);

            // Insertar nuevos movimientos actualizados
            const nuevosMovimientos = [
                { id_transaccion: idTransaccion, id_cuenta: idCuentaDebe, debe: baseGravada, haber: 0, id_empresa: empresaId },
                ...(ivaMonto > 0 ? [{ id_transaccion: idTransaccion, id_cuenta: idCuentaIva, debe: ivaMonto, haber: 0, id_empresa: empresaId }] : []),
                ...(totalRetenido > 0 ? [{ id_transaccion: idTransaccion, id_cuenta: idCuentaRetencion, debe: 0, haber: totalRetenido, id_empresa: empresaId }] : []),
                { id_transaccion: idTransaccion, id_cuenta: idCuentaHaber, debe: 0, haber: netoAPagar, id_empresa: empresaId }
            ];

            const { error: mInsertError } = await supabase.from('movimientos').insert(nuevosMovimientos);
            if (mInsertError) throw mInsertError;

            // Actualizar Tesorería CXP si existe
            const { data: tesoDoc } = await supabase
                .from('tesoreria_documentos')
                .select('id')
                .eq('id_empresa', empresaId)
                .eq('referencia', doc.transacciones?.numero_comprobante || '')
                .maybeSingle();

            if (tesoDoc) {
                await supabase
                    .from('tesoreria_documentos')
                    .update({
                        saldo_pendiente: netoAPagar,
                        estado: netoAPagar > 0 ? 'Pendiente' : 'Liquidado'
                    })
                    .eq('id', tesoDoc.id);
            }
        }
        return retencionesFinal;
    };

    const handleSaveManualWithholding = async () => {
        if (!viewingDoc) return;
        setWithholdingLoading(true);
        try {
            const defRetId = selectedWithholdingAccount || accounts.find(a => a.codigo_cuenta.startsWith('2.1.4'))?.id || '';
            const rets = await applyManualWithholding(viewingDoc, verRetRenta, verRetIva, defRetId);
            alert("Retención manual registrada y contabilidad sincronizada exitosamente.");
            setViewingDoc(prev => prev ? { ...prev, retenciones_aplicadas: rets } : null);
            fetchDocumentos();
        } catch (err: any) {
            console.error("Error saving manual withholding:", err);
            alert(`Error al registrar retención: ${err.message}`);
        } finally {
            setWithholdingLoading(false);
        }
    };

    const handleRemoveWithholding = async (doc: DocSRI) => {
        if (!confirm("¿Está seguro de eliminar la retención aplicada a esta factura?")) return;
        setWithholdingLoading(true);
        try {
            const idTransaccion = doc.transacciones?.id;
            if (!idTransaccion) throw new Error("Transacción no encontrada.");

            // 1. Limpiar retenciones en documentos_sri
            const { error: sriErr } = await supabase
                .from('documentos_sri')
                .update({ retenciones_aplicadas: [] })
                .eq('id', doc.id);
            if (sriErr) throw sriErr;

            // 2. Re-calcular movimientos
            const { data: movimientosExistentes, error: mErr } = await supabase
                .from('movimientos')
                .select('*')
                .eq('id_transaccion', idTransaccion);
            if (mErr) throw mErr;

            if (movimientosExistentes && movimientosExistentes.length > 0) {
                const defaultIva = accounts.find(a => a.codigo_cuenta.startsWith('1.1.09') || a.nombre.toLowerCase().includes('iva'));
                const movIva = movimientosExistentes.find(m => m.id_cuenta === defaultIva?.id || m.id_cuenta.toLowerCase().includes('iva') || (m.debe > 0 && m.debe === doc.monto_iva));
                const idCuentaIva = movIva?.id_cuenta || defaultIva?.id || '';
                
                const movDebe = movimientosExistentes.find(m => m.debe > 0 && m.id_cuenta !== idCuentaIva);
                const idCuentaDebe = movDebe?.id_cuenta || '';

                const movHaber = movimientosExistentes.find(m => m.haber > 0 && !m.id_cuenta.startsWith('2.1.4') && !m.id_cuenta.toLowerCase().includes('retencion'));
                const idCuentaHaber = movHaber?.id_cuenta || '';

                const baseGravada = (doc.base_12 || 0) + (doc.base_0 || 0) + (doc.base_no_objeto || 0);
                const ivaMonto = doc.monto_iva || 0;
                const totalFactura = baseGravada + ivaMonto;

                await supabase.from('movimientos').delete().eq('id_transaccion', idTransaccion);

                const nuevosMovimientos = [
                    { id_transaccion: idTransaccion, id_cuenta: idCuentaDebe, debe: baseGravada, haber: 0, id_empresa: empresaId },
                    ...(ivaMonto > 0 ? [{ id_transaccion: idTransaccion, id_cuenta: idCuentaIva, debe: ivaMonto, haber: 0, id_empresa: empresaId }] : []),
                    { id_transaccion: idTransaccion, id_cuenta: idCuentaHaber, debe: 0, haber: totalFactura, id_empresa: empresaId }
                ];

                const { error: mInsertError } = await supabase.from('movimientos').insert(nuevosMovimientos);
                if (mInsertError) throw mInsertError;

                // 3. Actualizar Tesorería
                const { data: tesoDoc } = await supabase
                    .from('tesoreria_documentos')
                    .select('id')
                    .eq('id_empresa', empresaId)
                    .eq('referencia', doc.transacciones?.numero_comprobante || '')
                    .maybeSingle();

                if (tesoDoc) {
                    await supabase
                        .from('tesoreria_documentos')
                        .update({
                            saldo_pendiente: totalFactura,
                            estado: totalFactura > 0 ? 'Pendiente' : 'Liquidado'
                        })
                        .eq('id', tesoDoc.id);
                }
            }

            alert("Retención eliminada exitosamente.");
            // Refrescar modal si está abierto
            if (viewingDoc && viewingDoc.id === doc.id) {
                setViewingDoc(prev => prev ? { ...prev, retenciones_aplicadas: [] } : null);
            }
            fetchDocumentos();
        } catch (err: any) {
            console.error("Error removing withholding:", err);
            alert(`Error al eliminar retención: ${err.message}`);
        } finally {
            setWithholdingLoading(false);
        }
    };

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
    }, [fetchDocumentos]);

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

    const handleAnular = async (doc: DocSRI) => {
        if (!confirm(`¿Estás seguro de anular el comprobante ${doc.transacciones?.numero_comprobante || ''}? Se conservará el registro con valores en cero para el reporte del SRI (ATS), se anularán sus movimientos contables en el Libro Diario y se eliminará/anulará su saldo en Tesorería.`)) return;
        setDeletingId(doc.id);
        try {
            const idTransaccion = doc.transacciones?.id;
            
            // 1. Modificar la transacción en Supabase
            if (idTransaccion) {
                const oldConcepto = doc.transacciones?.concepto || '';
                const newConcepto = oldConcepto.startsWith('[ANULADO]') ? oldConcepto : `[ANULADO] ${oldConcepto}`;
                
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

            // 3. Modificar documentos_sri a valores cero
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

            alert('Comprobante anulado exitosamente contable y tributariamente.');
            fetchDocumentos();
        } catch (err) {
            console.error('Error voiding doc:', err);
            alert('Error al anular el documento.');
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
                                                {['Tipo', 'Entidad', 'Comprobante', 'Fecha', 'Base Grav.', 'IVA', 'Total', ''].map(h => (
                                                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-sec)', whiteSpace: 'nowrap' }}>{h}</th>
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
                                                        // Para retenciones: base = suma de bases retenidas, IVA = retenciones de IVA, total = total retenido
                                                        const rets = doc.retenciones_aplicadas || [];
                                                        baseGrav = rets.reduce((sum, r) => sum + (r.base || 0), 0);
                                                        ivaDisplay = rets.filter(r => r.tipo === 'IVA').reduce((sum, r) => sum + (r.valor || 0), 0);
                                                        total = rets.reduce((sum, r) => sum + (r.valor || 0), 0);
                                                    } else {
                                                        // Para facturas y NC: base gravada = todas las bases, total = base + IVA
                                                        baseGrav = (doc.base_12 || 0) + (doc.base_0 || 0) + (doc.base_no_objeto || 0);
                                                        ivaDisplay = doc.monto_iva || 0;
                                                        total = baseGrav + ivaDisplay;
                                                    }
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
                                                                ${baseGrav.toFixed(2)}
                                                            </td>
                                                            <td style={{ padding: '12px', fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 700, textAlign: 'right' }}>
                                                                ${ivaDisplay.toFixed(2)}
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
                                                                             onClick={() => handleOpenEditModal(doc)}
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
                                                                     <button
                                                                         onClick={() => handleDelete(doc)}
                                                                         disabled={deletingId === doc.id}
                                                                         title="Eliminar documento y asiento"
                                                                         style={{ 
                                                                             background: 'rgba(239,68,68,0.1)', 
                                                                             border: 'none', 
                                                                             color: 'var(--error)', 
                                                                             cursor: 'pointer', 
                                                                             padding: '6px 10px', 
                                                                             borderRadius: 8, 
                                                                             display: 'inline-flex', 
                                                                             alignItems: 'center',
                                                                             transition: 'all 0.2s'
                                                                         }}
                                                                     >
                                                                         <Trash2 size={14} />
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
                </>
            )}

            {/* Modal para Subir Retención */}
            <AnimatePresence>
                {selectedDocForWithholding && (
                    <div className="modal-overlay" style={{ 
                        position: 'fixed',
                        inset: 0,
                        zIndex: 10000, 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        background: 'rgba(5, 8, 16, 0.85)',
                        backdropFilter: 'blur(12px)',
                        padding: '20px',
                        boxSizing: 'border-box'
                    }}>
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }} 
                            animate={{ opacity: 1, scale: 1 }} 
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="modal-content glass-card"
                            style={{ 
                                padding: '32px', 
                                width: '90%', 
                                maxWidth: '550px',
                                maxHeight: 'min(90vh, 700px)',
                                overflowY: 'auto',
                                display: 'flex',
                                flexDirection: 'column'
                            }}
                        >
                            <div className="flex-between" style={{ marginBottom: '24px' }}>
                                <h3 className="h1" style={{ fontSize: '1.4rem', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Receipt className="text-primary" /> Cargar XML de Retención
                                </h3>
                                <button onClick={() => { setSelectedDocForWithholding(null); setParsedWithholding(null); }} style={{ background: 'none', border: 'none', color: 'var(--text-sec)', cursor: 'pointer' }}><X size={20} /></button>
                            </div>

                            <div style={{ marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-sec)', fontWeight: 'bold' }}>Factura Destino:</div>
                                <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-main)', marginTop: '4px' }}>
                                    {selectedDocForWithholding.transacciones?.entidades?.nombre || 'Proveedor'}
                                </div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--primary)', marginTop: '2px', fontFamily: 'monospace' }}>
                                    Factura #: {selectedDocForWithholding.transacciones?.numero_comprobante}
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-sec)' }}>
                                        Selecciona la Cuenta Contable de Retenciones (Haber)*
                                    </label>
                                    <select 
                                        value={selectedWithholdingAccount}
                                        onChange={e => setSelectedWithholdingAccount(e.target.value)}
                                        style={inputStyle}
                                    >
                                        <option value="">Selecciona una cuenta...</option>
                                        {accounts.filter(a => a.tipo === 'Pasivo').map(a => (
                                            <option key={a.id} value={a.id}>
                                                {a.codigo_cuenta} - {a.nombre}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-sec)' }}>
                                        Archivo XML de Retención (.xml)*
                                    </label>
                                    <input 
                                        type="file" 
                                        accept=".xml" 
                                        onChange={handleWithholdingFileChange}
                                        style={{ ...inputStyle, padding: '8px 12px' }}
                                    />
                                </div>

                                {withholdingLoading && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', fontSize: '0.85rem' }}>
                                        <Loader2 className="animate-spin" size={16} /> Procesando datos...
                                    </div>
                                )}

                                {parsedWithholding && (
                                    <motion.div 
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        style={{ 
                                            background: 'var(--primary-light)', 
                                            border: '1px solid var(--border-color)', 
                                            padding: '16px', 
                                            borderRadius: '12px' 
                                        }}
                                    >
                                        <div style={{ fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '10px', color: 'var(--primary)' }}>
                                            ✓ XML Válido y Analizado:
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.85rem' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <span style={{ color: 'var(--text-sec)' }}>Retención #:</span>
                                                <span style={{ fontWeight: 'bold' }}>{parsedWithholding.numeroComprobante}</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <span style={{ color: 'var(--text-sec)' }}>Periodo Fiscal:</span>
                                                <span style={{ fontWeight: 'bold' }}>{parsedWithholding.periodoFiscal}</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed rgba(255,255,255,0.1)', paddingTop: '6px', marginTop: '4px' }}>
                                                <span style={{ color: 'var(--text-sec)' }}>Imp. Renta Retenido:</span>
                                                <span style={{ fontWeight: 'bold', color: 'var(--warning)' }}>${parsedWithholding.totalRetenidoRenta.toFixed(2)}</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <span style={{ color: 'var(--text-sec)' }}>IVA Retenido:</span>
                                                <span style={{ fontWeight: 'bold', color: 'var(--primary)' }}>${parsedWithholding.totalRetenidoIVA.toFixed(2)}</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: '6px' }}>
                                                <span style={{ color: 'var(--text-main)' }}>Total Retenido:</span>
                                                <span style={{ fontSize: '1rem', color: '#ffffff' }}>${parsedWithholding.totalRetenido.toFixed(2)}</span>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}

                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                                    <button 
                                        type="button" 
                                        onClick={() => { setSelectedDocForWithholding(null); setParsedWithholding(null); }} 
                                        className="btn glass-card" 
                                        style={{ padding: '10px 20px', border: '1px solid var(--border-color)' }}
                                    >
                                        Cancelar
                                    </button>
                                    <button 
                                        type="button" 
                                        disabled={withholdingLoading || !parsedWithholding || !selectedWithholdingAccount} 
                                        onClick={handleSaveWithholding} 
                                        className="btn btn-primary" 
                                        style={{ padding: '10px 24px' }}
                                    >
                                        {withholdingLoading ? <Loader2 className="animate-spin" size={18} /> : 'Guardar Retención'}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Modal para Ver Todo (Detalle XML Completo) */}
            <AnimatePresence>
                {viewingDoc && (() => {
                    const ivaDisplay = viewingDoc.monto_iva || 0;
                    const actualBase12 = viewingDoc.base_12 || (() => {
                        if (ivaDisplay > 0 && viewingMovements.length > 0) {
                            const ivaMov = viewingMovements.find(m => parseFloat(m.debe) === ivaDisplay);
                            const expenseMovs = viewingMovements.filter(m => parseFloat(m.debe) > 0 && m !== ivaMov);
                            return expenseMovs.reduce((sum, m) => sum + (parseFloat(m.debe) || 0), 0);
                        }
                        return 0;
                    })();

                    const baseGrav = (actualBase12 || 0) + (viewingDoc.base_0 || 0) + (viewingDoc.base_no_objeto || 0);
                    const totalVal = baseGrav + ivaDisplay;
                    const calculatedBase12 = actualBase12 || (ivaDisplay > 0 ? parseFloat((totalVal - ivaDisplay - (viewingDoc.base_0 || 0) - (viewingDoc.base_no_objeto || 0)).toFixed(2)) : 0);

                    return (
                        <div className="modal-overlay" style={{ 
                            position: 'fixed',
                            inset: 0,
                            zIndex: 10000, 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            background: 'rgba(5, 8, 16, 0.85)',
                            backdropFilter: 'blur(12px)',
                            padding: '20px',
                            boxSizing: 'border-box'
                        }}>
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.95 }} 
                                animate={{ opacity: 1, scale: 1 }} 
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="modal-content glass-card"
                                style={{ 
                                    padding: 0, 
                                    width: '95%', 
                                    maxWidth: '1000px', 
                                    maxHeight: 'min(90vh, 850px)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    overflow: 'hidden',
                                    background: 'rgba(11, 15, 25, 0.97)',
                                    backdropFilter: 'blur(20px)',
                                    border: '1px solid rgba(255, 255, 255, 0.08)',
                                    borderRadius: '20px'
                                }}
                            >
                                {/* Header Fijo */}
                                <div style={{ 
                                    padding: '24px 32px', 
                                    borderBottom: '1px solid var(--border-color)', 
                                    display: 'flex', 
                                    justifyContent: 'space-between', 
                                    alignItems: 'center' 
                                }}>
                                    <h3 className="h1" style={{ fontSize: '1.4rem', margin: 0, display: 'flex', alignItems: 'center', gap: 10, fontWeight: 900, color: '#ffffff' }}>
                                        <FileText className="text-primary" size={24} /> Resumen y Detalle del XML
                                    </h3>
                                    <button 
                                        onClick={() => { setViewingDoc(null); setParsedWithholding(null); }} 
                                        style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: 'var(--text-sec)', cursor: 'pointer', padding: '8px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                        title="Cerrar"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>

                                {/* Cuerpo Scrollable */}
                                <div style={{ 
                                    padding: '32px', 
                                    overflowY: 'auto', 
                                    flex: 1,
                                    display: 'grid', 
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(min(380px, 100%), 1fr))', 
                                    gap: '32px' 
                                }}>
                                    {/* Columna Izquierda */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                        {/* Datos del Comprobante */}
                                        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.04)' }}>
                                            <h4 style={{ margin: '0 0 16px 0', fontSize: '1rem', fontWeight: 800, color: 'var(--primary)' }}>
                                                Identificación del Documento
                                            </h4>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '6px' }}>
                                                    <span style={{ color: 'var(--text-sec)' }}>Tipo:</span>
                                                    <span style={{ fontWeight: 'bold', color: '#ffffff' }}>{viewingDoc.transacciones?.tipo_comprobante}</span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '6px' }}>
                                                    <span style={{ color: 'var(--text-sec)' }}>Número:</span>
                                                    <span style={{ fontWeight: 'bold', color: '#ffffff', fontFamily: 'monospace' }}>{viewingDoc.transacciones?.numero_comprobante}</span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '6px' }}>
                                                    <span style={{ color: 'var(--text-sec)' }}>Fecha Emisión:</span>
                                                    <span style={{ fontWeight: 'bold', color: '#ffffff' }}>{viewingDoc.transacciones?.fecha ? new Date(viewingDoc.transacciones.fecha).toLocaleDateString('es-EC', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}</span>
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '6px' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                        <span style={{ color: 'var(--text-sec)' }}>Clave de Acceso (SRI):</span>
                                                        <button 
                                                            onClick={() => {
                                                                navigator.clipboard.writeText(viewingDoc.clave_acceso_xml);
                                                                alert("Clave de acceso copiada al portapapeles.");
                                                            }}
                                                            style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.75rem', cursor: 'pointer', padding: 0, fontWeight: 'bold' }}
                                                        >
                                                            [Copiar]
                                                        </button>
                                                    </div>
                                                    <span style={{ fontWeight: 'bold', color: 'var(--text-sec)', fontSize: '0.76rem', fontFamily: 'monospace', wordBreak: 'break-all', marginTop: 2 }}>{viewingDoc.clave_acceso_xml}</span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '6px' }}>
                                                    <span style={{ color: 'var(--text-sec)' }}>Entidad Vinculada:</span>
                                                    <span style={{ fontWeight: 'bold', color: '#ffffff', textAlign: 'right' }}>{viewingDoc.transacciones?.entidades?.nombre}</span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <span style={{ color: 'var(--text-sec)' }}>RUC/ID Entidad:</span>
                                                    <span style={{ fontWeight: 'bold', color: '#ffffff', fontFamily: 'monospace' }}>{viewingDoc.transacciones?.entidades?.ruc_cedula}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Resumen de Valores */}
                                        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.04)' }}>
                                            <h4 style={{ margin: '0 0 16px 0', fontSize: '1rem', fontWeight: 800, color: 'var(--primary)' }}>
                                                Resumen de Valores (Factura)
                                            </h4>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem' }}>
                                                {calculatedBase12 > 0 && (
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '6px' }}>
                                                        <span style={{ color: 'var(--text-sec)' }}>Subtotal con IVA (Tarifa 12% / 15%):</span>
                                                        <span style={{ fontWeight: 'bold', color: '#ffffff' }}>${calculatedBase12.toFixed(2)}</span>
                                                    </div>
                                                )}
                                                {(viewingDoc.base_0 || 0) > 0 && (
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '6px' }}>
                                                        <span style={{ color: 'var(--text-sec)' }}>Subtotal sin IVA (Tarifa 0%):</span>
                                                        <span style={{ fontWeight: 'bold', color: '#ffffff' }}>${(viewingDoc.base_0 || 0).toFixed(2)}</span>
                                                    </div>
                                                )}
                                                {(viewingDoc.base_no_objeto || 0) > 0 && (
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '6px' }}>
                                                        <span style={{ color: 'var(--text-sec)' }}>Subtotal No Objeto de IVA:</span>
                                                        <span style={{ fontWeight: 'bold', color: '#ffffff' }}>${(viewingDoc.base_no_objeto || 0).toFixed(2)}</span>
                                                    </div>
                                                )}
                                                {ivaDisplay > 0 && (
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '6px' }}>
                                                        <span style={{ color: 'var(--text-sec)' }}>Monto IVA:</span>
                                                        <span style={{ fontWeight: 'bold', color: 'var(--primary)' }}>${ivaDisplay.toFixed(2)}</span>
                                                    </div>
                                                )}
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: '1.05rem', paddingTop: '8px', borderTop: '1px dashed rgba(255,255,255,0.1)' }}>
                                                    <span style={{ color: '#ffffff' }}>Total Factura:</span>
                                                    <span style={{ color: '#ffffff' }}>${totalVal.toFixed(2)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Columna Derecha */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                        {/* Asiento Contable */}
                                        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.04)' }}>
                                            <h4 style={{ margin: '0 0 16px 0', fontSize: '1rem', fontWeight: 800, color: 'var(--primary)' }}>
                                                Asiento Contable Relacionado
                                            </h4>
                                            {loadingViewingMovs ? (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-sec)', fontSize: '0.85rem' }}>
                                                    <Loader2 className="animate-spin" size={16} /> Cargando movimientos...
                                                </div>
                                            ) : viewingMovements.length === 0 ? (
                                                <div style={{ color: 'var(--text-sec)', fontSize: '0.85rem', fontStyle: 'italic' }}>
                                                    No se encontraron movimientos contables registrados.
                                                </div>
                                            ) : (
                                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                                                    <thead>
                                                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', color: 'var(--text-sec)' }}>
                                                            <th style={{ textAlign: 'left', padding: '6px 0', fontWeight: 'bold' }}>Cuenta</th>
                                                            <th style={{ textAlign: 'right', padding: '6px 0', width: '70px', fontWeight: 'bold' }}>Debe</th>
                                                            <th style={{ textAlign: 'right', padding: '6px 0', width: '70px', fontWeight: 'bold' }}>Haber</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {viewingMovements.map((m, idx) => (
                                                            <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                                                                <td style={{ padding: '8px 0', fontWeight: 500, color: '#ffffff' }}>
                                                                    {getAccountLabel(m.id_cuenta)}
                                                                </td>
                                                                <td style={{ padding: '8px 0', textAlign: 'right', color: m.debe > 0 ? '#ffffff' : 'var(--text-sec)' }}>
                                                                    {m.debe > 0 ? `$${m.debe.toFixed(2)}` : '—'}
                                                                </td>
                                                                <td style={{ padding: '8px 0', textAlign: 'right', color: m.haber > 0 ? '#ffffff' : 'var(--text-sec)' }}>
                                                                    {m.haber > 0 ? `$${m.haber.toFixed(2)}` : '—'}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            )}
                                        </div>

                                        {/* Retención SRI */}
                                        {tipo === 'Compras' && (
                                            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.04)' }}>
                                                <h4 style={{ margin: '0 0 16px 0', fontSize: '1rem', fontWeight: 800, color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                    <span>Retención Aplicada</span>
                                                    {viewingDoc.retenciones_aplicadas && viewingDoc.retenciones_aplicadas.length > 0 && (
                                                        <button 
                                                            onClick={() => handleRemoveWithholding(viewingDoc)}
                                                            className="btn"
                                                            style={{ 
                                                                padding: '4px 8px', 
                                                                fontSize: '0.72rem', 
                                                                background: 'rgba(239,68,68,0.1)', 
                                                                color: 'var(--error)', 
                                                                border: 'none', 
                                                                borderRadius: '6px',
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: '4px',
                                                                cursor: 'pointer'
                                                            }}
                                                        >
                                                            <Trash2 size={12} /> Quitar
                                                        </button>
                                                    )}
                                                </h4>

                                                {viewingDoc.retenciones_aplicadas && viewingDoc.retenciones_aplicadas.length > 0 ? (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.85rem' }}>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', background: 'rgba(255,255,255,0.01)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)' }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                                <span style={{ color: 'var(--text-sec)' }}>Comprobante Retención #:</span>
                                                                <span style={{ fontWeight: 'bold', color: '#ffffff', fontFamily: 'monospace' }}>{viewingDoc.retenciones_aplicadas[0].numero_retencion || '—'}</span>
                                                            </div>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                                <span style={{ color: 'var(--text-sec)' }}>Fecha Emisión:</span>
                                                                <span style={{ fontWeight: 'bold', color: '#ffffff' }}>{viewingDoc.retenciones_aplicadas[0].fecha_retencion || '—'}</span>
                                                            </div>
                                                        </div>

                                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                                                            <thead>
                                                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', color: 'var(--text-sec)' }}>
                                                                    <th style={{ textAlign: 'left', padding: '6px 0', fontWeight: 'bold' }}>Impuesto</th>
                                                                    <th style={{ textAlign: 'left', padding: '6px 0', fontWeight: 'bold' }}>Código</th>
                                                                    <th style={{ textAlign: 'right', padding: '6px 0', fontWeight: 'bold' }}>Base</th>
                                                                    <th style={{ textAlign: 'right', padding: '6px 0', fontWeight: 'bold' }}>%</th>
                                                                    <th style={{ textAlign: 'right', padding: '6px 0', fontWeight: 'bold' }}>Valor</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {viewingDoc.retenciones_aplicadas.map((r, idx) => (
                                                                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                                                                        <td style={{ padding: '8px 0', color: '#ffffff', fontWeight: 500 }}>{r.tipo}</td>
                                                                        <td style={{ padding: '8px 0', color: 'var(--text-sec)', fontFamily: 'monospace' }}>{r.codigo}</td>
                                                                        <td style={{ padding: '8px 0', textAlign: 'right', color: '#ffffff' }}>${(r.base || 0).toFixed(2)}</td>
                                                                        <td style={{ padding: '8px 0', textAlign: 'right', color: 'var(--warning)', fontWeight: 600 }}>{r.porcentaje}%</td>
                                                                        <td style={{ padding: '8px 0', textAlign: 'right', color: 'var(--warning)', fontWeight: 'bold' }}>${(r.valor || 0).toFixed(2)}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>

                                                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                            <span style={{ color: 'var(--text-sec)' }}>Total Retenido:</span>
                                                            <span style={{ fontSize: '1rem', fontWeight: 900, color: 'var(--warning)' }}>
                                                                ${viewingDoc.retenciones_aplicadas.reduce((sum, r) => sum + (r.valor || 0), 0).toFixed(2)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                                        <div style={{ color: 'var(--text-sec)', fontSize: '0.82rem', fontStyle: 'italic', background: 'rgba(245,158,11,0.05)', padding: '12px', borderRadius: '10px', border: '1px dashed rgba(245,158,11,0.15)', margin: 0 }}>
                                                            Sin retenciones cargadas. Selecciona los códigos o sube el XML de retención.
                                                        </div>

                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                                            <div style={{ 
                                                                backgroundColor: 'rgba(255, 255, 255, 0.02)', 
                                                                padding: '12px', 
                                                                borderRadius: '8px', 
                                                                border: '1px solid rgba(255,255,255,0.04)',
                                                                fontSize: '0.8rem',
                                                                color: 'var(--text-sec)'
                                                            }}>
                                                                <span style={{ fontWeight: 'bold', color: 'var(--primary)' }}>Cuenta Contable (Pasivo):</span>{' '}
                                                                {getAccountLabel(selectedWithholdingAccount || accounts.find(a => a.codigo_cuenta.startsWith('2.1.4'))?.id || '')}
                                                            </div>

                                                            <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px' }}>
                                                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-sec)' }}>
                                                                    Opción A: Subir XML de Retención (.xml)
                                                                </label>
                                                                <input 
                                                                    type="file" 
                                                                    accept=".xml" 
                                                                    onChange={handleWithholdingFileChange}
                                                                    style={{ ...inputStyle, padding: '8px 12px' }}
                                                                />
                                                            </div>

                                                            {withholdingLoading && !verRetRenta && !verRetIva && (
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', fontSize: '0.8rem' }}>
                                                                    <Loader2 className="animate-spin" size={14} /> Procesando XML...
                                                                </div>
                                                            )}

                                                            {parsedWithholding && (
                                                                <motion.div 
                                                                    initial={{ opacity: 0, y: 8 }}
                                                                    animate={{ opacity: 1, y: 0 }}
                                                                    style={{ 
                                                                        background: 'rgba(59,130,246,0.05)', 
                                                                        border: '1px solid rgba(59,130,246,0.1)', 
                                                                        padding: '12px', 
                                                                        borderRadius: '8px',
                                                                        fontSize: '0.78rem'
                                                                    }}
                                                                >
                                                                    <div style={{ fontWeight: 'bold', color: 'var(--primary)', marginBottom: '6px' }}>✓ XML Analizado:</div>
                                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                                        <div>Retención #: {parsedWithholding.numeroComprobante}</div>
                                                                        <div>Total Retenido: <span style={{ fontWeight: 'bold', color: 'var(--warning)' }}>${parsedWithholding.totalRetenido.toFixed(2)}</span></div>
                                                                    </div>
                                                                    <button 
                                                                        type="button" 
                                                                        disabled={withholdingLoading}
                                                                        onClick={async () => {
                                                                            setWithholdingLoading(true);
                                                                            try {
                                                                                const defRetId = selectedWithholdingAccount || accounts.find(a => a.codigo_cuenta.startsWith('2.1.4'))?.id || '';
                                                                                const rets = await saveWithholding(viewingDoc, parsedWithholding, defRetId);
                                                                                alert("Retención registrada exitosamente.");
                                                                                setViewingDoc(prev => prev ? { ...prev, retenciones_aplicadas: rets } : null);
                                                                                setParsedWithholding(null);
                                                                                fetchDocumentos();
                                                                            } catch (err: any) {
                                                                                alert(`Error al procesar: ${err.message}`);
                                                                            } finally {
                                                                                setWithholdingLoading(false);
                                                                            }
                                                                        }}
                                                                        className="btn btn-primary"
                                                                        style={{ width: '100%', marginTop: '10px', padding: '8px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                                                                    >
                                                                        <Upload size={14} /> Aplicar Retención del XML
                                                                    </button>
                                                                </motion.div>
                                                            )}

                                                            <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px', marginTop: '4px' }}>
                                                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-sec)' }}>
                                                                    Opción B: Selección Manual de Códigos
                                                                </label>
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                                    <div>
                                                                        <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.72rem', color: 'var(--text-sec)' }}>
                                                                            Código de Retención de Renta (IR)
                                                                        </label>
                                                                        <select
                                                                            value={verRetRenta}
                                                                            onChange={e => setVerRetRenta(e.target.value)}
                                                                            style={{ ...inputStyle, padding: '6px 10px', fontSize: '0.8rem' }}
                                                                        >
                                                                            <option value="">Sin Retención IR</option>
                                                                            {CATALOGO_RETENCIONES_RENTA.map(r => (
                                                                                <option key={r.codigo} value={r.codigo}>
                                                                                    {r.codigo} - {r.descripcion} ({r.porcentaje}%)
                                                                                </option>
                                                                            ))}
                                                                        </select>
                                                                    </div>
                                                                    <div>
                                                                        <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.72rem', color: 'var(--text-sec)' }}>
                                                                            Porcentaje de Retención de IVA
                                                                        </label>
                                                                        <select
                                                                            value={verRetIva}
                                                                            onChange={e => setVerRetIva(e.target.value)}
                                                                            style={{ ...inputStyle, padding: '6px 10px', fontSize: '0.8rem' }}
                                                                        >
                                                                            <option value="">Sin Retención IVA</option>
                                                                            {CATALOGO_RETENCIONES_IVA.map(r => (
                                                                                <option key={r.codigo} value={r.codigo}>
                                                                                    {r.descripcion}
                                                                                </option>
                                                                            ))}
                                                                        </select>
                                                                    </div>
                                                                    
                                                                    <button
                                                                        type="button"
                                                                        disabled={withholdingLoading || (!verRetRenta && !verRetIva)}
                                                                        onClick={handleSaveManualWithholding}
                                                                        className="btn btn-primary"
                                                                        style={{ 
                                                                            marginTop: '8px', 
                                                                            padding: '10px 14px', 
                                                                            fontSize: '0.8rem', 
                                                                            fontWeight: 800,
                                                                            display: 'flex', 
                                                                            alignItems: 'center', 
                                                                            justifyContent: 'center', 
                                                                            gap: '6px',
                                                                            borderRadius: '10px'
                                                                        }}
                                                                    >
                                                                        {withholdingLoading && (verRetRenta || verRetIva) ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />} 
                                                                        Aplicar Retención Manual
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Footer Fijo */}
                                <div style={{ 
                                    padding: '20px 32px', 
                                    borderTop: '1px solid var(--border-color)', 
                                    display: 'flex', 
                                    justifyContent: 'flex-end',
                                    backgroundColor: '#0c101b'
                                }}>
                                    <button 
                                        onClick={() => { setViewingDoc(null); setParsedWithholding(null); }} 
                                        className="btn btn-primary" 
                                        style={{ padding: '12px 28px', fontSize: '0.95rem', fontWeight: 800, borderRadius: '12px' }}
                                    >
                                        Cerrar Detalle
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    );
                })()}
            </AnimatePresence>

            {/* Modal para Editar Cuentas (Debe, IVA, Haber) */}
            <AnimatePresence>
                {editingDoc && (
                    <div className="modal-overlay" style={{ 
                        position: 'fixed',
                        inset: 0,
                        zIndex: 10000, 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        background: 'rgba(5, 8, 16, 0.85)',
                        backdropFilter: 'blur(12px)',
                        padding: '20px',
                        boxSizing: 'border-box'
                    }}>
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }} 
                            animate={{ opacity: 1, scale: 1 }} 
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="modal-content glass-card"
                            style={{ 
                                padding: 0, 
                                width: '90%', 
                                maxWidth: '550px',
                                maxHeight: 'min(90vh, 800px)',
                                display: 'flex',
                                flexDirection: 'column',
                                overflow: 'hidden',
                                background: 'rgba(11, 15, 25, 0.97)',
                                backdropFilter: 'blur(20px)',
                                border: '1px solid rgba(255, 255, 255, 0.08)',
                                borderRadius: '20px'
                            }}
                        >
                            {/* Header Fijo */}
                            <div style={{ 
                                padding: '24px 32px', 
                                borderBottom: '1px solid var(--border-color)', 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                alignItems: 'center' 
                            }}>
                                <h3 className="h1" style={{ fontSize: '1.3rem', margin: 0, display: 'flex', alignItems: 'center', gap: 8, fontWeight: 900 }}>
                                    <Edit2 className="text-primary" /> Editar Parametrización
                                </h3>
                                <button onClick={() => setEditingDoc(null)} style={{ background: 'none', border: 'none', color: 'var(--text-sec)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={18} /></button>
                            </div>

                            {/* Cuerpo Scrollable */}
                            <div style={{ padding: '32px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                <div style={{ marginBottom: '10px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '16px' }}>
                                    <div style={{ fontSize: '0.82rem', color: 'var(--text-sec)', fontWeight: 'bold' }}>Documento Contable:</div>
                                    <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#ffffff', marginTop: '4px' }}>
                                        {editingDoc.transacciones?.entidades?.nombre || 'Entidad'}
                                    </div>
                                    <div style={{ fontSize: '0.78rem', color: 'var(--primary)', marginTop: '2px', fontFamily: 'monospace' }}>
                                        Comprobante: {editingDoc.transacciones?.numero_comprobante} | Total: ${( (editingDoc.base_12 || 0) + (editingDoc.base_0 || 0) + (editingDoc.base_no_objeto || 0) + (editingDoc.monto_iva || 0) ).toFixed(2)}
                                    </div>
                                </div>

                                <div>
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-sec)' }}>
                                        Cuenta del Debe (Gasto, Activo o Inventario)*
                                    </label>
                                    <AccountSelector 
                                        value={editFormData.idCuentaDebe}
                                        onChange={val => setEditFormData(prev => ({ ...prev, idCuentaDebe: val }))}
                                        accounts={accounts}
                                        placeholder="Seleccionar cuenta del Debe..."
                                    />
                                </div>

                                {editingDoc.monto_iva > 0 && (
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-sec)' }}>
                                            Cuenta del IVA (Debe)*
                                        </label>
                                        <AccountSelector 
                                            value={editFormData.idCuentaIva}
                                            onChange={val => setEditFormData(prev => ({ ...prev, idCuentaIva: val }))}
                                            accounts={accounts}
                                            placeholder="Seleccionar cuenta de IVA..."
                                        />
                                    </div>
                                )}

                                <div>
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-sec)' }}>
                                        Cuenta del Haber (Caja, Banco o Proveedor)*
                                    </label>
                                    <AccountSelector 
                                        value={editFormData.idCuentaHaber}
                                        onChange={val => setEditFormData(prev => ({ ...prev, idCuentaHaber: val }))}
                                        accounts={accounts}
                                        placeholder="Seleccionar cuenta del Haber..."
                                    />
                                </div>

                                {tipo === 'Compras' && (
                                    <>
                                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px', marginTop: '4px' }}>
                                            <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', fontWeight: 800, color: 'var(--primary)' }}>
                                                Retenciones del SRI (Manual)
                                            </h4>
                                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-sec)' }}>
                                                Código de Retención de Renta (IR)
                                            </label>
                                            <select
                                                value={editFormData.retencionCodigo}
                                                onChange={e => setEditFormData(prev => ({ ...prev, retencionCodigo: e.target.value }))}
                                                style={inputStyle}
                                            >
                                                <option value="">Sin Retención IR</option>
                                                {CATALOGO_RETENCIONES_RENTA.map(r => (
                                                    <option key={r.codigo} value={r.codigo}>
                                                        {r.codigo} - {r.descripcion} ({r.porcentaje}%)
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div style={{ marginTop: '12px' }}>
                                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-sec)' }}>
                                                Porcentaje de Retención de IVA
                                            </label>
                                            <select
                                                value={editFormData.retencionIvaCodigo}
                                                onChange={e => setEditFormData(prev => ({ ...prev, retencionIvaCodigo: e.target.value }))}
                                                style={inputStyle}
                                            >
                                                <option value="">Sin Retención IVA</option>
                                                {CATALOGO_RETENCIONES_IVA.map(r => (
                                                    <option key={r.codigo} value={r.codigo}>
                                                        {r.descripcion}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        {(editFormData.retencionCodigo || editFormData.retencionIvaCodigo) && (
                                            <div style={{ marginTop: '12px' }}>
                                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-sec)' }}>
                                                    Cuenta Contable de Retenciones (Pasivo)*
                                                </label>
                                                <AccountSelector 
                                                    value={editFormData.idCuentaRetencion || accounts.find(a => a.codigo_cuenta.startsWith('2.1.4'))?.id || ''}
                                                    onChange={val => setEditFormData(prev => ({ ...prev, idCuentaRetencion: val }))}
                                                    accounts={accounts.filter(a => a.tipo === 'Pasivo')}
                                                    placeholder="Seleccionar cuenta de Retención..."
                                                />
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>

                            {/* Footer Fijo */}
                            <div style={{ 
                                padding: '20px 32px', 
                                borderTop: '1px solid var(--border-color)', 
                                display: 'flex', 
                                justifyContent: 'flex-end',
                                gap: '12px',
                                backgroundColor: '#0c101b'
                            }}>
                                <button 
                                    type="button" 
                                    onClick={() => setEditingDoc(null)} 
                                    className="btn glass-card" 
                                    style={{ padding: '10px 20px', border: '1px solid var(--border-color)' }}
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="button" 
                                    disabled={withholdingLoading || !editFormData.idCuentaDebe || !editFormData.idCuentaHaber || (editingDoc.monto_iva > 0 && !editFormData.idCuentaIva)} 
                                    onClick={handleSaveEditChanges} 
                                    className="btn btn-primary" 
                                    style={{ padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 6 }}
                                >
                                    {withholdingLoading ? <Loader2 className="animate-spin" size={18} /> : 'Guardar Cambios'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  background: 'var(--input-bg)',
  border: '1px solid var(--border-color)',
  borderRadius: '8px',
  color: 'var(--text-main)',
  outline: 'none',
  fontSize: '0.9rem',
  fontFamily: 'inherit'
};
