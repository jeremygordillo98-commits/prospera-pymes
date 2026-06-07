import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Edit2, X, Loader2 } from 'lucide-react';
import { AccountSelector } from './AccountSelector';
import { supabase } from '../services/supabase';
import { CATALOGO_RETENCIONES_RENTA, CATALOGO_RETENCIONES_IVA } from '../utils/sriCatalog';

interface EditMappingSRIModalProps {
    editingDoc: any;
    onClose: () => void;
    accounts: any[];
    empresaId: string;
    tipo: 'Compras' | 'Ventas';
    onSuccess: () => void;
    showAlert: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

export const EditMappingSRIModal: React.FC<EditMappingSRIModalProps> = ({
    editingDoc,
    onClose,
    accounts,
    empresaId,
    tipo,
    onSuccess,
    showAlert
}) => {
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editFormData, setEditFormData] = useState({
        idCuentaDebe: '',
        idCuentaIva: '',
        idCuentaHaber: '',
        retencionCodigo: '',
        retencionIvaCodigo: '',
        idCuentaRetencion: ''
    });

    useEffect(() => {
        const fetchCurrentMapping = async () => {
            if (!editingDoc) return;
            const idTransaccion = editingDoc.transacciones?.id;
            if (!idTransaccion) {
                showAlert("No hay transacción contable asociada a este documento.", "error");
                onClose();
                return;
            }

            setLoading(true);
            try {
                const { data: movs, error } = await supabase
                    .from('movimientos')
                    .select('*')
                    .eq('id_transaccion', idTransaccion);
                
                if (error || !movs) {
                    showAlert("Error al cargar las cuentas contables asociadas.", "error");
                    onClose();
                    return;
                }

                const defaultIva = accounts.find(a => a.codigo_cuenta.startsWith('1.1.09') || a.nombre.toLowerCase().includes('iva'));
                const movIva = movs.find(m => m.id_cuenta === defaultIva?.id || m.id_cuenta.toLowerCase().includes('iva') || (m.debe > 0 && m.debe === editingDoc.monto_iva));
                const idCuentaIva = movIva?.id_cuenta || '';
                
                const movDebe = movs.find(m => m.debe > 0 && m.id_cuenta !== idCuentaIva);
                const idCuentaDebe = movDebe?.id_cuenta || '';

                const movHaber = movs.find(m => m.haber > 0 && !m.id_cuenta.startsWith('2.1.4') && !m.id_cuenta.toLowerCase().includes('retencion'));
                const idCuentaHaber = movHaber?.id_cuenta || '';

                const movRet = movs.find(m => m.haber > 0 && (m.id_cuenta.startsWith('2.1.4') || m.id_cuenta.toLowerCase().includes('retencion')));
                const idCuentaRetencion = movRet?.id_cuenta || '';

                let retCodigo = '';
                let retIvaCodigo = '';
                if (editingDoc.retenciones_aplicadas && editingDoc.retenciones_aplicadas.length > 0) {
                    const retRenta = editingDoc.retenciones_aplicadas.find((r: any) => r.tipo === 'RENTA');
                    if (retRenta) retCodigo = retRenta.codigo?.toString() || '';
                    
                    const retIva = editingDoc.retenciones_aplicadas.find((r: any) => r.tipo === 'IVA');
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
            } catch (err) {
                console.error("Error fetching current mapping:", err);
                showAlert("Error al cargar la parametrización actual.", "error");
                onClose();
            } finally {
                setLoading(false);
            }
        };

        fetchCurrentMapping();
    }, [editingDoc, accounts, onClose, showAlert]);

    const handleSaveEditChanges = async () => {
        if (!editingDoc) return;
        setSaving(true);
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

            showAlert("Documento contable actualizado exitosamente.", "success");
            onSuccess();
        } catch (err: any) {
            console.error("Error editing document:", err);
            showAlert(`Error al guardar cambios: ${err.message}`, "error");
        } finally {
            setSaving(false);
        }
    };

    if (!editingDoc) return null;

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
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-sec)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={18} /></button>
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

                    {loading ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '150px', color: 'var(--text-sec)' }}>
                            <Loader2 className="animate-spin" size={24} style={{ marginRight: '8px' }} /> Cargando parametrización actual...
                        </div>
                    ) : (
                        <>
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
                        onClick={onClose} 
                        className="btn glass-card" 
                        style={{ padding: '10px 20px', border: '1px solid var(--border-color)' }}
                    >
                        Cancelar
                    </button>
                    <button 
                        type="button" 
                        disabled={saving || loading || !editFormData.idCuentaDebe || !editFormData.idCuentaHaber || (editingDoc.monto_iva > 0 && !editFormData.idCuentaIva)} 
                        onClick={handleSaveEditChanges} 
                        className="btn btn-primary" 
                        style={{ padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                        {saving ? <Loader2 className="animate-spin" size={18} /> : 'Guardar Cambios'}
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
