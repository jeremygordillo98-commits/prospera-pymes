import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, FileText, Loader2, Trash2, Upload, Save } from 'lucide-react';
import { supabase } from '../services/supabase';
import { parseSRIXML } from '../utils/sriParser';
import { CATALOGO_RETENCIONES_RENTA, CATALOGO_RETENCIONES_IVA } from '../utils/sriCatalog';
import { AccountSelector } from './AccountSelector';

interface DocumentDetailsSRIModalProps {
    viewingDoc: any;
    onClose: () => void;
    accounts: any[];
    empresaId: string;
    tipo: 'Compras' | 'Ventas';
    onSuccess: () => void;
    showAlert: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
    showConfirm: (message: string, onConfirm: () => void, title?: string) => void;
}

export const DocumentDetailsSRIModal: React.FC<DocumentDetailsSRIModalProps> = ({
    viewingDoc,
    onClose,
    accounts,
    empresaId,
    tipo,
    onSuccess,
    showAlert,
    showConfirm
}) => {
    const [doc, setDoc] = useState<any>(viewingDoc);
    const [viewingMovements, setViewingMovements] = useState<any[]>([]);
    const [loadingViewingMovs, setLoadingViewingMovs] = useState(false);
    const [withholdingLoading, setWithholdingLoading] = useState(false);
    const [parsedWithholding, setParsedWithholding] = useState<any | null>(null);
    
    // Manual withholding states
    const [verRetRenta, setVerRetRenta] = useState('');
    const [verRetIva, setVerRetIva] = useState('');
    const [selectedWithholdingRentaAccount, setSelectedWithholdingRentaAccount] = useState<string>('');
    const [selectedWithholdingIvaAccount, setSelectedWithholdingIvaAccount] = useState<string>('');

    useEffect(() => {
        setDoc(viewingDoc);
    }, [viewingDoc]);

    // Fetch movements for this transaction
    useEffect(() => {
        const fetchViewingMovs = async () => {
            if (!doc || !doc.transacciones?.id) {
                setViewingMovements([]);
                return;
            }
            setLoadingViewingMovs(true);
            try {
                const { data, error } = await supabase
                    .from('movimientos')
                    .select('*')
                    .eq('id_transaccion', doc.transacciones.id);
                if (data && !error) {
                    setViewingMovements(data);
                }
            } catch (err) {
                console.error("Error fetching movements for doc:", err);
            } finally {
                setLoadingViewingMovs(false);
            }
        };
        fetchViewingMovs();
    }, [doc]);

    // Pre-populate manual retention values when modal opens/doc changes
    useEffect(() => {
        if (doc) {
            let retRenta = '';
            let retIva = '';
            if (doc.retenciones_aplicadas && doc.retenciones_aplicadas.length > 0) {
                const rR = doc.retenciones_aplicadas.find((r: any) => r.tipo === 'RENTA');
                if (rR) retRenta = rR.codigo?.toString() || '';
                const rI = doc.retenciones_aplicadas.find((r: any) => r.tipo === 'IVA');
                if (rI) retIva = rI.codigo?.toString() || '';
            }
            setVerRetRenta(retRenta);
            setVerRetIva(retIva);

            if (accounts && accounts.length > 0) {
                if (tipo === 'Compras') {
                    const targetAccounts = accounts.filter(a => a.tipo === 'Pasivo');
                    const defRenta = targetAccounts.find(a => a.codigo_cuenta.startsWith('2.1.4') && (a.nombre.toLowerCase().includes('renta') || a.nombre.toLowerCase().includes('ir')));
                    const defIva = targetAccounts.find(a => a.codigo_cuenta.startsWith('2.1.4') && a.nombre.toLowerCase().includes('iva'));
                    const defGen = targetAccounts.find(a => a.codigo_cuenta.startsWith('2.1.4') || a.nombre.toLowerCase().includes('retencion'));

                    setSelectedWithholdingRentaAccount(defRenta?.id || defGen?.id || targetAccounts[0]?.id || '');
                    setSelectedWithholdingIvaAccount(defIva?.id || defGen?.id || targetAccounts[0]?.id || '');
                } else {
                    const targetAccounts = accounts.filter(a => a.tipo === 'Activo');
                    const defRenta = targetAccounts.find(a => (a.codigo_cuenta.startsWith('1.1.07') || a.codigo_cuenta.startsWith('1.1.08')) && (a.nombre.toLowerCase().includes('renta') || a.nombre.toLowerCase().includes('ir')));
                    const defIva = targetAccounts.find(a => (a.codigo_cuenta.startsWith('1.1.07') || a.codigo_cuenta.startsWith('1.1.08')) && a.nombre.toLowerCase().includes('iva'));
                    const defGen = targetAccounts.find(a => a.codigo_cuenta.startsWith('1.1.07') || a.codigo_cuenta.startsWith('1.1.08') || a.nombre.toLowerCase().includes('retencion') || a.nombre.toLowerCase().includes('anticipo'));

                    setSelectedWithholdingRentaAccount(defRenta?.id || defGen?.id || targetAccounts[0]?.id || '');
                    setSelectedWithholdingIvaAccount(defIva?.id || defGen?.id || targetAccounts[0]?.id || '');
                }
            }
        }
    }, [doc, accounts, tipo]);

    const getAccountLabel = (idCuenta: string) => {
        const acc = accounts.find(a => a.id === idCuenta);
        return acc ? `${acc.codigo_cuenta} - ${acc.nombre}` : idCuenta;
    };

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
                showAlert("El archivo no es un Comprobante de Retención válido del SRI.", "warning");
                setParsedWithholding(null);
            }
        } catch (err) {
            console.error("Error reading withholding XML:", err);
            showAlert("Error al leer el archivo XML.", "error");
            setParsedWithholding(null);
        } finally {
            setWithholdingLoading(false);
        }
    };

    const saveWithholding = async (targetDoc: any, parsedData: any, rentaAccountId: string, ivaAccountId: string) => {
        const idTransaccion = targetDoc.transacciones?.id;
        if (!idTransaccion) {
            throw new Error("La factura seleccionada no posee una transacción contable asociada.");
        }

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
        const totalRetenidoRenta = parsedData.totalRetenidoRenta || 0;
        const totalRetenidoIVA = parsedData.totalRetenidoIVA || 0;

        const { error: updateError } = await supabase
            .from('documentos_sri')
            .update({ retenciones_aplicadas: retencionesFinal })
            .eq('id', targetDoc.id);

        if (updateError) throw updateError;

        const { data: movimientosExistentes, error: mErr } = await supabase
            .from('movimientos')
            .select('*')
            .eq('id_transaccion', idTransaccion);
        
        if (mErr) throw mErr;

        if (movimientosExistentes && movimientosExistentes.length > 0) {
            // Resolver cuentas contables originales
            let idCuentaDebe = '';
            let idCuentaIva = '';
            let idCuentaHaber = '';

            const defaultIva = accounts.find(a => a.codigo_cuenta.startsWith('1.1.09') || a.codigo_cuenta.startsWith('2.1.07') || a.nombre.toLowerCase().includes('iva'));

            if (tipo === 'Compras') {
                const movIva = movimientosExistentes.find(m => m.id_cuenta === defaultIva?.id || m.id_cuenta.toLowerCase().includes('iva') || (m.debe > 0 && m.debe === targetDoc.monto_iva));
                idCuentaIva = movIva?.id_cuenta || defaultIva?.id || '';
                
                const movDebe = movimientosExistentes.find(m => m.debe > 0 && m.id_cuenta !== idCuentaIva);
                idCuentaDebe = movDebe?.id_cuenta || '';

                const movHaber = movimientosExistentes.find(m => m.haber > 0 && !m.id_cuenta.startsWith('2.1.4') && !m.id_cuenta.toLowerCase().includes('retencion'));
                idCuentaHaber = movHaber?.id_cuenta || '';
            } else {
                // Ventas
                const movIva = movimientosExistentes.find(m => m.id_cuenta === defaultIva?.id || m.id_cuenta.toLowerCase().includes('iva') || (m.haber > 0 && m.haber === targetDoc.monto_iva));
                idCuentaIva = movIva?.id_cuenta || defaultIva?.id || '';

                const movHaber = movimientosExistentes.find(m => m.haber > 0 && m.id_cuenta !== idCuentaIva);
                idCuentaHaber = movHaber?.id_cuenta || '';

                const movDebe = movimientosExistentes.find(m => m.debe > 0);
                idCuentaDebe = movDebe?.id_cuenta || '';
            }

            const baseGravada = (targetDoc.base_12 || 0) + (targetDoc.base_0 || 0) + (targetDoc.base_no_objeto || 0);
            const ivaMonto = targetDoc.monto_iva || 0;
            const totalFactura = baseGravada + ivaMonto;
            const netoAPagar = parseFloat((totalFactura - totalRetenido).toFixed(2));

            await supabase.from('movimientos').delete().eq('id_transaccion', idTransaccion);

            let nuevosMovimientos: any[] = [];
            if (tipo === 'Compras') {
                nuevosMovimientos = [
                    { id_transaccion: idTransaccion, id_cuenta: idCuentaDebe, debe: baseGravada, haber: 0, id_empresa: empresaId },
                    ...(ivaMonto > 0 ? [{ id_transaccion: idTransaccion, id_cuenta: idCuentaIva, debe: ivaMonto, haber: 0, id_empresa: empresaId }] : []),
                    ...(totalRetenidoRenta > 0 ? [{ id_transaccion: idTransaccion, id_cuenta: rentaAccountId, debe: 0, haber: totalRetenidoRenta, id_empresa: empresaId }] : []),
                    ...(totalRetenidoIVA > 0 ? [{ id_transaccion: idTransaccion, id_cuenta: ivaAccountId, debe: 0, haber: totalRetenidoIVA, id_empresa: empresaId }] : []),
                    { id_transaccion: idTransaccion, id_cuenta: idCuentaHaber, debe: 0, haber: netoAPagar, id_empresa: empresaId }
                ];
            } else {
                // Ventas: Clientes (Debe = netoAPagar), Anticipo IR (Debe = totalRetenidoRenta), Anticipo IVA (Debe = totalRetenidoIVA), Ingresos (Haber = baseGravada), IVA (Haber = ivaMonto)
                nuevosMovimientos = [
                    { id_transaccion: idTransaccion, id_cuenta: idCuentaDebe, debe: netoAPagar, haber: 0, id_empresa: empresaId },
                    ...(totalRetenidoRenta > 0 ? [{ id_transaccion: idTransaccion, id_cuenta: rentaAccountId, debe: totalRetenidoRenta, haber: 0, id_empresa: empresaId }] : []),
                    ...(totalRetenidoIVA > 0 ? [{ id_transaccion: idTransaccion, id_cuenta: ivaAccountId, debe: totalRetenidoIVA, haber: 0, id_empresa: empresaId }] : []),
                    { id_transaccion: idTransaccion, id_cuenta: idCuentaHaber, debe: 0, haber: baseGravada, id_empresa: empresaId },
                    ...(ivaMonto > 0 ? [{ id_transaccion: idTransaccion, id_cuenta: idCuentaIva, debe: 0, haber: ivaMonto, id_empresa: empresaId }] : [])
                ];
            }

            const { error: mInsertError } = await supabase.from('movimientos').insert(nuevosMovimientos);
            if (mInsertError) throw mInsertError;

            const { data: tesoDoc } = await supabase
                .from('tesoreria_documentos')
                .select('id')
                .eq('id_empresa', empresaId)
                .eq('referencia', targetDoc.transacciones?.numero_comprobante || '')
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

    const applyManualWithholding = async (targetDoc: any, retRentaCod: string, retIvaCod: string, rentaAccountId: string, ivaAccountId: string) => {
        const idTransaccion = targetDoc.transacciones?.id;
        if (!idTransaccion) {
            throw new Error("La factura seleccionada no posee una transacción contable asociada.");
        }

        const baseGravada = (targetDoc.base_12 || 0) + (targetDoc.base_0 || 0) + (targetDoc.base_no_objeto || 0);
        const ivaMonto = targetDoc.monto_iva || 0;
        const totalFactura = baseGravada + ivaMonto;

        let retencionesFinal: any[] = [];
        let totalRetenidoRenta = 0;
        let totalRetenidoIVA = 0;

        const baseImponibleForRenta = targetDoc.base_12 || baseGravada;

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
                    totalRetenidoRenta = valRetCalculado;
                }
            }
        }

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
                    totalRetenidoIVA = valRetCalculado;
                }
            }
        }

        const totalRetenido = totalRetenidoRenta + totalRetenidoIVA;

        const { error: updateError } = await supabase
            .from('documentos_sri')
            .update({ retenciones_aplicadas: retencionesFinal })
            .eq('id', targetDoc.id);

        if (updateError) throw updateError;

        const { data: movimientosExistentes, error: mErr } = await supabase
            .from('movimientos')
            .select('*')
            .eq('id_transaccion', idTransaccion);
        
        if (mErr) throw mErr;

        if (movimientosExistentes && movimientosExistentes.length > 0) {
            // Resolver cuentas contables originales
            let idCuentaDebe = '';
            let idCuentaIva = '';
            let idCuentaHaber = '';

            const defaultIva = accounts.find(a => a.codigo_cuenta.startsWith('1.1.09') || a.codigo_cuenta.startsWith('2.1.07') || a.nombre.toLowerCase().includes('iva'));

            if (tipo === 'Compras') {
                const movIva = movimientosExistentes.find(m => m.id_cuenta === defaultIva?.id || m.id_cuenta.toLowerCase().includes('iva') || (m.debe > 0 && m.debe === targetDoc.monto_iva));
                idCuentaIva = movIva?.id_cuenta || defaultIva?.id || '';
                
                const movDebe = movimientosExistentes.find(m => m.debe > 0 && m.id_cuenta !== idCuentaIva);
                idCuentaDebe = movDebe?.id_cuenta || '';

                const movHaber = movimientosExistentes.find(m => m.haber > 0 && !m.id_cuenta.startsWith('2.1.4') && !m.id_cuenta.toLowerCase().includes('retencion'));
                idCuentaHaber = movHaber?.id_cuenta || '';
            } else {
                // Ventas
                const movIva = movimientosExistentes.find(m => m.id_cuenta === defaultIva?.id || m.id_cuenta.toLowerCase().includes('iva') || (m.haber > 0 && m.haber === targetDoc.monto_iva));
                idCuentaIva = movIva?.id_cuenta || defaultIva?.id || '';

                const movHaber = movimientosExistentes.find(m => m.haber > 0 && m.id_cuenta !== idCuentaIva);
                idCuentaHaber = movHaber?.id_cuenta || '';

                const movDebe = movimientosExistentes.find(m => m.debe > 0);
                idCuentaDebe = movDebe?.id_cuenta || '';
            }

            const netoAPagar = parseFloat((totalFactura - totalRetenido).toFixed(2));

            await supabase.from('movimientos').delete().eq('id_transaccion', idTransaccion);

            let nuevosMovimientos: any[] = [];
            if (tipo === 'Compras') {
                nuevosMovimientos = [
                    { id_transaccion: idTransaccion, id_cuenta: idCuentaDebe, debe: baseGravada, haber: 0, id_empresa: empresaId },
                    ...(ivaMonto > 0 ? [{ id_transaccion: idTransaccion, id_cuenta: idCuentaIva, debe: ivaMonto, haber: 0, id_empresa: empresaId }] : []),
                    ...(totalRetenidoRenta > 0 ? [{ id_transaccion: idTransaccion, id_cuenta: rentaAccountId, debe: 0, haber: totalRetenidoRenta, id_empresa: empresaId }] : []),
                    ...(totalRetenidoIVA > 0 ? [{ id_transaccion: idTransaccion, id_cuenta: ivaAccountId, debe: 0, haber: totalRetenidoIVA, id_empresa: empresaId }] : []),
                    { id_transaccion: idTransaccion, id_cuenta: idCuentaHaber, debe: 0, haber: netoAPagar, id_empresa: empresaId }
                ];
            } else {
                // Ventas: Clientes (Debe = netoAPagar), Anticipo IR (Debe = totalRetenidoRenta), Anticipo IVA (Debe = totalRetenidoIVA), Ingresos (Haber = baseGravada), IVA (Haber = ivaMonto)
                nuevosMovimientos = [
                    { id_transaccion: idTransaccion, id_cuenta: idCuentaDebe, debe: netoAPagar, haber: 0, id_empresa: empresaId },
                    ...(totalRetenidoRenta > 0 ? [{ id_transaccion: idTransaccion, id_cuenta: rentaAccountId, debe: totalRetenidoRenta, haber: 0, id_empresa: empresaId }] : []),
                    ...(totalRetenidoIVA > 0 ? [{ id_transaccion: idTransaccion, id_cuenta: ivaAccountId, debe: totalRetenidoIVA, haber: 0, id_empresa: empresaId }] : []),
                    { id_transaccion: idTransaccion, id_cuenta: idCuentaHaber, debe: 0, haber: baseGravada, id_empresa: empresaId },
                    ...(ivaMonto > 0 ? [{ id_transaccion: idTransaccion, id_cuenta: idCuentaIva, debe: 0, haber: ivaMonto, id_empresa: empresaId }] : [])
                ];
            }

            const { error: mInsertError } = await supabase.from('movimientos').insert(nuevosMovimientos);
            if (mInsertError) throw mInsertError;

            const { data: tesoDoc } = await supabase
                .from('tesoreria_documentos')
                .select('id')
                .eq('id_empresa', empresaId)
                .eq('referencia', targetDoc.transacciones?.numero_comprobante || '')
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
        if (!doc) return;
        setWithholdingLoading(true);
        try {
            const rets = await applyManualWithholding(
                doc,
                verRetRenta,
                verRetIva,
                selectedWithholdingRentaAccount,
                selectedWithholdingIvaAccount
            );
            showAlert("Retención manual registrada y contabilidad sincronizada exitosamente.", "success");
            setDoc((prev: any) => prev ? { ...prev, retenciones_aplicadas: rets } : null);
            onSuccess();
        } catch (err: any) {
            console.error("Error saving manual withholding:", err);
            showAlert(`Error al registrar retención: ${err.message}`, "error");
        } finally {
            setWithholdingLoading(false);
        }
    };

    const handleRemoveWithholding = (targetDoc: any) => {
        showConfirm("¿Está seguro de eliminar la retención aplicada a esta factura?", async () => {
            setWithholdingLoading(true);
            try {
                const idTransaccion = targetDoc.transacciones?.id;
                if (!idTransaccion) throw new Error("Transacción no encontrada.");

                const { error: sriErr } = await supabase
                    .from('documentos_sri')
                    .update({ retenciones_aplicadas: [] })
                    .eq('id', targetDoc.id);
                if (sriErr) throw sriErr;

                const { data: movimientosExistentes, error: mErr } = await supabase
                    .from('movimientos')
                    .select('*')
                    .eq('id_transaccion', idTransaccion);
                if (mErr) throw mErr;

                if (movimientosExistentes && movimientosExistentes.length > 0) {
                    const defaultIva = accounts.find(a => a.codigo_cuenta.startsWith('1.1.09') || a.codigo_cuenta.startsWith('2.1.07') || a.nombre.toLowerCase().includes('iva'));
                    
                    let idCuentaDebe = '';
                    let idCuentaIva = '';
                    let idCuentaHaber = '';

                    if (tipo === 'Compras') {
                        const movIva = movimientosExistentes.find(m => m.id_cuenta === defaultIva?.id || m.id_cuenta.toLowerCase().includes('iva') || (m.debe > 0 && m.debe === targetDoc.monto_iva));
                        idCuentaIva = movIva?.id_cuenta || defaultIva?.id || '';
                        
                        const movDebe = movimientosExistentes.find(m => m.debe > 0 && m.id_cuenta !== idCuentaIva);
                        idCuentaDebe = movDebe?.id_cuenta || '';

                        const movHaber = movimientosExistentes.find(m => m.haber > 0 && !m.id_cuenta.startsWith('2.1.4') && !m.id_cuenta.toLowerCase().includes('retencion'));
                        idCuentaHaber = movHaber?.id_cuenta || '';
                    } else {
                        // Ventas
                        const movIva = movimientosExistentes.find(m => m.id_cuenta === defaultIva?.id || m.id_cuenta.toLowerCase().includes('iva') || (m.haber > 0 && m.haber === targetDoc.monto_iva));
                        idCuentaIva = movIva?.id_cuenta || defaultIva?.id || '';

                        const movHaber = movimientosExistentes.find(m => m.haber > 0 && m.id_cuenta !== idCuentaIva);
                        idCuentaHaber = movHaber?.id_cuenta || '';

                        const movDebe = movimientosExistentes.find(m => m.debe > 0);
                        idCuentaDebe = movDebe?.id_cuenta || '';
                    }

                    const baseGravada = (targetDoc.base_12 || 0) + (targetDoc.base_0 || 0) + (targetDoc.base_no_objeto || 0);
                    const ivaMonto = targetDoc.monto_iva || 0;
                    const totalFactura = baseGravada + ivaMonto;

                    await supabase.from('movimientos').delete().eq('id_transaccion', idTransaccion);

                    let nuevosMovimientos: any[] = [];
                    if (tipo === 'Compras') {
                        nuevosMovimientos = [
                            { id_transaccion: idTransaccion, id_cuenta: idCuentaDebe, debe: baseGravada, haber: 0, id_empresa: empresaId },
                            ...(ivaMonto > 0 ? [{ id_transaccion: idTransaccion, id_cuenta: idCuentaIva, debe: ivaMonto, haber: 0, id_empresa: empresaId }] : []),
                            { id_transaccion: idTransaccion, id_cuenta: idCuentaHaber, debe: 0, haber: totalFactura, id_empresa: empresaId }
                        ];
                    } else {
                        // Ventas: Clientes (Debe = totalFactura), Ingresos (Haber = baseGravada), IVA (Haber = ivaMonto)
                        nuevosMovimientos = [
                            { id_transaccion: idTransaccion, id_cuenta: idCuentaDebe, debe: totalFactura, haber: 0, id_empresa: empresaId },
                            { id_transaccion: idTransaccion, id_cuenta: idCuentaHaber, debe: 0, haber: baseGravada, id_empresa: empresaId },
                            ...(ivaMonto > 0 ? [{ id_transaccion: idTransaccion, id_cuenta: idCuentaIva, debe: 0, haber: ivaMonto, id_empresa: empresaId }] : [])
                        ];
                    }

                    const { error: mInsertError } = await supabase.from('movimientos').insert(nuevosMovimientos);
                    if (mInsertError) throw mInsertError;

                    const { data: tesoDoc } = await supabase
                        .from('tesoreria_documentos')
                        .select('id')
                        .eq('id_empresa', empresaId)
                        .eq('referencia', targetDoc.transacciones?.numero_comprobante || '')
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

                showAlert("Retención eliminada exitosamente.", "success");
                setDoc((prev: any) => prev ? { ...prev, retenciones_aplicadas: [] } : null);
                onSuccess();
            } catch (err: any) {
                console.error("Error removing withholding:", err);
                showAlert(`Error al eliminar retención: ${err.message}`, "error");
            } finally {
                setWithholdingLoading(false);
            }
        });
    };

    if (!doc) return null;

    const ivaDisplay = doc.monto_iva || 0;
    const actualBase12 = doc.base_12 || (() => {
        if (ivaDisplay > 0 && viewingMovements.length > 0) {
            const ivaMov = viewingMovements.find(m => parseFloat(m.debe) === ivaDisplay);
            const expenseMovs = viewingMovements.filter(m => parseFloat(m.debe) > 0 && m !== ivaMov);
            return expenseMovs.reduce((sum, m) => sum + (parseFloat(m.debe) || 0), 0);
        }
        return 0;
    })();

    const baseGrav = (actualBase12 || 0) + (doc.base_0 || 0) + (doc.base_no_objeto || 0);
    const totalVal = baseGrav + ivaDisplay;
    const calculatedBase12 = actualBase12 || (ivaDisplay > 0 ? parseFloat((totalVal - ivaDisplay - (doc.base_0 || 0) - (doc.base_no_objeto || 0)).toFixed(2)) : 0);

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
                        onClick={onClose} 
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
                                    <span style={{ fontWeight: 'bold', color: '#ffffff' }}>{doc.transacciones?.tipo_comprobante}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '6px' }}>
                                    <span style={{ color: 'var(--text-sec)' }}>Número:</span>
                                    <span style={{ fontWeight: 'bold', color: '#ffffff', fontFamily: 'monospace' }}>{doc.transacciones?.numero_comprobante}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '6px' }}>
                                    <span style={{ color: 'var(--text-sec)' }}>Fecha Emisión:</span>
                                    <span style={{ fontWeight: 'bold', color: '#ffffff' }}>{doc.transacciones?.fecha ? new Date(doc.transacciones.fecha).toLocaleDateString('es-EC', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}</span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '6px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: 'var(--text-sec)' }}>Clave de Acceso (SRI):</span>
                                        <button 
                                            onClick={() => {
                                                navigator.clipboard.writeText(doc.clave_acceso_xml);
                                                showAlert("Clave de acceso copiada al portapapeles.", "success");
                                            }}
                                            style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.75rem', cursor: 'pointer', padding: 0, fontWeight: 'bold' }}
                                        >
                                            [Copiar]
                                        </button>
                                    </div>
                                    <span style={{ fontWeight: 'bold', color: 'var(--text-sec)', fontSize: '0.76rem', fontFamily: 'monospace', wordBreak: 'break-all', marginTop: 2 }}>{doc.clave_acceso_xml}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '6px' }}>
                                    <span style={{ color: 'var(--text-sec)' }}>Entidad Vinculada:</span>
                                    <span style={{ fontWeight: 'bold', color: '#ffffff', textAlign: 'right' }}>{doc.transacciones?.entidades?.nombre}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--text-sec)' }}>RUC/ID Entidad:</span>
                                    <span style={{ fontWeight: 'bold', color: '#ffffff', fontFamily: 'monospace' }}>{doc.transacciones?.entidades?.ruc_cedula}</span>
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
                                {(doc.base_0 || 0) > 0 && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '6px' }}>
                                        <span style={{ color: 'var(--text-sec)' }}>Subtotal sin IVA (Tarifa 0%):</span>
                                        <span style={{ fontWeight: 'bold', color: '#ffffff' }}>${(doc.base_0 || 0).toFixed(2)}</span>
                                    </div>
                                )}
                                {(doc.base_no_objeto || 0) > 0 && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '6px' }}>
                                        <span style={{ color: 'var(--text-sec)' }}>Subtotal No Objeto de IVA:</span>
                                        <span style={{ fontWeight: 'bold', color: '#ffffff' }}>${(doc.base_no_objeto || 0).toFixed(2)}</span>
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
                        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.04)' }}>
                            <h4 style={{ margin: '0 0 16px 0', fontSize: '1rem', fontWeight: 800, color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span>Retención Aplicada</span>
                                {doc.retenciones_aplicadas && doc.retenciones_aplicadas.length > 0 && (
                                    <button 
                                        onClick={() => handleRemoveWithholding(doc)}
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

                            {doc.retenciones_aplicadas && doc.retenciones_aplicadas.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.85rem' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', background: 'rgba(255,255,255,0.01)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ color: 'var(--text-sec)' }}>Comprobante Retención #:</span>
                                            <span style={{ fontWeight: 'bold', color: '#ffffff', fontFamily: 'monospace' }}>{doc.retenciones_aplicadas[0].numero_retencion || '—'}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ color: 'var(--text-sec)' }}>Fecha Emisión:</span>
                                            <span style={{ fontWeight: 'bold', color: '#ffffff' }}>{doc.retenciones_aplicadas[0].fecha_retencion || '—'}</span>
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
                                            {doc.retenciones_aplicadas.map((r: any, idx: number) => (
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
                                            ${doc.retenciones_aplicadas.reduce((sum: number, r: any) => sum + (r.valor || 0), 0).toFixed(2)}
                                        </span>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    <div style={{ color: 'var(--text-sec)', fontSize: '0.82rem', fontStyle: 'italic', background: 'rgba(245,158,11,0.05)', padding: '12px', borderRadius: '10px', border: '1px dashed rgba(245,158,11,0.15)', margin: 0 }}>
                                        Sin retenciones cargadas. Selecciona los códigos o sube el XML de retención.
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                        {/* Dual Account Selectors */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                            <div>
                                                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-sec)' }}>
                                                    Cuenta Contable de Retención Renta ({tipo === 'Compras' ? 'Pasivo' : 'Activo'})*
                                                </label>
                                                <AccountSelector 
                                                    value={selectedWithholdingRentaAccount}
                                                    onChange={setSelectedWithholdingRentaAccount}
                                                    accounts={tipo === 'Compras' ? accounts.filter(a => a.tipo === 'Pasivo') : accounts.filter(a => a.tipo === 'Activo')}
                                                    placeholder="Selecciona una cuenta..."
                                                    customTriggerStyle={{
                                                        background: 'var(--input-bg)',
                                                        border: '1px solid var(--border-color)',
                                                        borderRadius: '8px',
                                                        color: 'var(--text-main)',
                                                        fontSize: '0.8rem',
                                                        padding: '6px 10px',
                                                        minHeight: '34px'
                                                    }}
                                                />
                                            </div>

                                            <div>
                                                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-sec)' }}>
                                                    Cuenta Contable de Retención IVA ({tipo === 'Compras' ? 'Pasivo' : 'Activo'})*
                                                </label>
                                                <AccountSelector 
                                                    value={selectedWithholdingIvaAccount}
                                                    onChange={setSelectedWithholdingIvaAccount}
                                                    accounts={tipo === 'Compras' ? accounts.filter(a => a.tipo === 'Pasivo') : accounts.filter(a => a.tipo === 'Activo')}
                                                    placeholder="Selecciona una cuenta..."
                                                    customTriggerStyle={{
                                                        background: 'var(--input-bg)',
                                                        border: '1px solid var(--border-color)',
                                                        borderRadius: '8px',
                                                        color: 'var(--text-main)',
                                                        fontSize: '0.8rem',
                                                        padding: '6px 10px',
                                                        minHeight: '34px'
                                                    }}
                                                />
                                            </div>
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
                                                    disabled={withholdingLoading || !selectedWithholdingRentaAccount || !selectedWithholdingIvaAccount}
                                                    onClick={async () => {
                                                        setWithholdingLoading(true);
                                                        try {
                                                            const rets = await saveWithholding(doc, parsedWithholding, selectedWithholdingRentaAccount, selectedWithholdingIvaAccount);
                                                            showAlert("Retención registrada exitosamente.", "success");
                                                            setDoc((prev: any) => prev ? { ...prev, retenciones_aplicadas: rets } : null);
                                                            setParsedWithholding(null);
                                                            onSuccess();
                                                        } catch (err: any) {
                                                            showAlert(`Error al procesar: ${err.message}`, "error");
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
                                                    disabled={withholdingLoading || (!verRetRenta && !verRetIva) || !selectedWithholdingRentaAccount || !selectedWithholdingIvaAccount}
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
                        onClick={onClose} 
                        className="btn btn-primary" 
                        style={{ padding: '12px 28px', fontSize: '0.95rem', fontWeight: 800, borderRadius: '12px' }}
                    >
                        Cerrar Detalle
                    </button>
                </div>
            </motion.div>
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
