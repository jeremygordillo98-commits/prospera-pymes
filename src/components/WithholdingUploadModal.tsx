import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Receipt, Loader2 } from 'lucide-react';
import { supabase } from '../services/supabase';
import { parseSRIXML } from '../utils/sriParser';
import { AccountSelector } from './AccountSelector';

interface WithholdingUploadModalProps {
    selectedDoc: any;
    onClose: () => void;
    accounts: any[];
    empresaId: string;
    tipo: 'Compras' | 'Ventas';
    onSuccess: () => void;
    showAlert: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

export const WithholdingUploadModal: React.FC<WithholdingUploadModalProps> = ({
    selectedDoc,
    onClose,
    accounts,
    empresaId,
    tipo,
    onSuccess,
    showAlert
}) => {
    const [withholdingLoading, setWithholdingLoading] = useState(false);
    const [parsedWithholding, setParsedWithholding] = useState<any | null>(null);
    const [selectedWithholdingRentaAccount, setSelectedWithholdingRentaAccount] = useState<string>('');
    const [selectedWithholdingIvaAccount, setSelectedWithholdingIvaAccount] = useState<string>('');

    // Pre-populate default withholding accounts based on tipo
    useEffect(() => {
        if (accounts && accounts.length > 0) {
            if (tipo === 'Compras') {
                const targetAccounts = accounts.filter(a => a.tipo === 'Pasivo');
                const defRenta = targetAccounts.find(a => a.codigo_cuenta.startsWith('2.1.4') && (a.nombre.toLowerCase().includes('renta') || a.nombre.toLowerCase().includes('ir')));
                const defIva = targetAccounts.find(a => a.codigo_cuenta.startsWith('2.1.4') && a.nombre.toLowerCase().includes('iva'));
                const defGen = targetAccounts.find(a => a.codigo_cuenta.startsWith('2.1.4') || a.nombre.toLowerCase().includes('retencion'));

                setSelectedWithholdingRentaAccount(defRenta?.id || defGen?.id || targetAccounts[0]?.id || '');
                setSelectedWithholdingIvaAccount(defIva?.id || defGen?.id || targetAccounts[0]?.id || '');
            } else {
                // Ventas: Activo
                const targetAccounts = accounts.filter(a => a.tipo === 'Activo');
                const defRenta = targetAccounts.find(a => (a.codigo_cuenta.startsWith('1.1.07') || a.codigo_cuenta.startsWith('1.1.08')) && (a.nombre.toLowerCase().includes('renta') || a.nombre.toLowerCase().includes('ir')));
                const defIva = targetAccounts.find(a => (a.codigo_cuenta.startsWith('1.1.07') || a.codigo_cuenta.startsWith('1.1.08')) && a.nombre.toLowerCase().includes('iva'));
                const defGen = targetAccounts.find(a => a.codigo_cuenta.startsWith('1.1.07') || a.codigo_cuenta.startsWith('1.1.08') || a.nombre.toLowerCase().includes('retencion') || a.nombre.toLowerCase().includes('anticipo'));

                setSelectedWithholdingRentaAccount(defRenta?.id || defGen?.id || targetAccounts[0]?.id || '');
                setSelectedWithholdingIvaAccount(defIva?.id || defGen?.id || targetAccounts[0]?.id || '');
            }
        }
    }, [accounts, tipo]);

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

    const saveWithholding = async (doc: any, parsedData: any, rentaAccountId: string, ivaAccountId: string) => {
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
        const totalRetenidoRenta = parsedData.totalRetenidoRenta || 0;
        const totalRetenidoIVA = parsedData.totalRetenidoIVA || 0;

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
            // Resolver cuentas contables originales
            let idCuentaDebe = '';
            let idCuentaIva = '';
            let idCuentaHaber = '';

            const defaultIva = accounts.find(a => a.codigo_cuenta.startsWith('1.1.09') || a.codigo_cuenta.startsWith('2.1.07') || a.nombre.toLowerCase().includes('iva'));

            if (tipo === 'Compras') {
                const movIva = movimientosExistentes.find(m => m.id_cuenta === defaultIva?.id || m.id_cuenta.toLowerCase().includes('iva') || (m.debe > 0 && m.debe === doc.monto_iva));
                idCuentaIva = movIva?.id_cuenta || defaultIva?.id || '';
                
                const movDebe = movimientosExistentes.find(m => m.debe > 0 && m.id_cuenta !== idCuentaIva);
                idCuentaDebe = movDebe?.id_cuenta || '';

                const movHaber = movimientosExistentes.find(m => m.haber > 0 && !m.id_cuenta.startsWith('2.1.4') && !m.id_cuenta.toLowerCase().includes('retencion'));
                idCuentaHaber = movHaber?.id_cuenta || '';
            } else {
                // Ventas
                const movIva = movimientosExistentes.find(m => m.id_cuenta === defaultIva?.id || m.id_cuenta.toLowerCase().includes('iva') || (m.haber > 0 && m.haber === doc.monto_iva));
                idCuentaIva = movIva?.id_cuenta || defaultIva?.id || '';

                const movHaber = movimientosExistentes.find(m => m.haber > 0 && m.id_cuenta !== idCuentaIva);
                idCuentaHaber = movHaber?.id_cuenta || '';

                const movDebe = movimientosExistentes.find(m => m.debe > 0);
                idCuentaDebe = movDebe?.id_cuenta || '';
            }

            const baseGravada = (doc.base_12 || 0) + (doc.base_0 || 0) + (doc.base_no_objeto || 0);
            const ivaMonto = doc.monto_iva || 0;
            const totalFactura = baseGravada + ivaMonto;
            const netoAPagar = parseFloat((totalFactura - totalRetenido).toFixed(2));

            // 4. Eliminar movimientos anteriores
            await supabase.from('movimientos').delete().eq('id_transaccion', idTransaccion);

            // 5. Insertar nuevos movimientos actualizados según el tipo de flujo
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

            // 6. Actualizar Tesorería (saldo_pendiente)
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
        if (!selectedDoc || !parsedWithholding) return;
        setWithholdingLoading(true);
        try {
            await saveWithholding(
                selectedDoc, 
                parsedWithholding, 
                selectedWithholdingRentaAccount, 
                selectedWithholdingIvaAccount
            );
            showAlert("Retención procesada y contabilidad sincronizada exitosamente.", "success");
            onSuccess();
        } catch (err: any) {
            console.error("Error saving withholding:", err);
            showAlert(`Error al procesar retención: ${err.message}`, "error");
        } finally {
            setWithholdingLoading(false);
        }
    };

    if (!selectedDoc) return null;

    const targetAccounts = tipo === 'Compras' 
        ? accounts.filter(a => a.tipo === 'Pasivo') 
        : accounts.filter(a => a.tipo === 'Activo');

    const labelDirection = tipo === 'Compras' ? 'Haber' : 'Debe';

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
                    padding: '32px', 
                    width: '90%', 
                    maxWidth: '550px',
                    maxHeight: 'min(90vh, 850px)',
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column'
                }}
            >
                <div className="flex-between" style={{ marginBottom: '24px' }}>
                    <h3 className="h1" style={{ fontSize: '1.4rem', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Receipt className="text-primary" /> Cargar XML de Retención
                    </h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-sec)', cursor: 'pointer' }}><X size={20} /></button>
                </div>

                <div style={{ marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-sec)', fontWeight: 'bold' }}>Comprobante Destino:</div>
                    <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-main)', marginTop: '4px' }}>
                        {selectedDoc.transacciones?.entidades?.nombre || 'Tercero'}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--primary)', marginTop: '2px', fontFamily: 'monospace' }}>
                        Comprobante #: {selectedDoc.transacciones?.numero_comprobante}
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-sec)' }}>
                            Cuenta Contable de Retención Renta ({labelDirection})*
                        </label>
                        <AccountSelector 
                            value={selectedWithholdingRentaAccount}
                            onChange={setSelectedWithholdingRentaAccount}
                            accounts={targetAccounts}
                            placeholder="Selecciona una cuenta..."
                            customTriggerStyle={{
                                background: 'var(--input-bg)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '8px',
                                color: 'var(--text-main)',
                                fontSize: '0.9rem',
                                padding: '10px 14px',
                                minHeight: '42px'
                            }}
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-sec)' }}>
                            Cuenta Contable de Retención IVA ({labelDirection})*
                        </label>
                        <AccountSelector 
                            value={selectedWithholdingIvaAccount}
                            onChange={setSelectedWithholdingIvaAccount}
                            accounts={targetAccounts}
                            placeholder="Selecciona una cuenta..."
                            customTriggerStyle={{
                                background: 'var(--input-bg)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '8px',
                                color: 'var(--text-main)',
                                fontSize: '0.9rem',
                                padding: '10px 14px',
                                minHeight: '42px'
                            }}
                        />
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
                            onClick={onClose} 
                            className="btn glass-card" 
                            style={{ padding: '10px 20px', border: '1px solid var(--border-color)' }}
                        >
                            Cancelar
                        </button>
                        <button 
                            type="button" 
                            disabled={withholdingLoading || !parsedWithholding || !selectedWithholdingRentaAccount || !selectedWithholdingIvaAccount} 
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
