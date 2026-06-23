import React, { useMemo, useState, useEffect, useRef } from 'react';
import { CheckCircle2 } from 'lucide-react';

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-main)', outline: 'none'
};

interface EditMovimientoModalProps {
  editingMov: any;
  setEditingMov: (mov: any) => void;
  cuentas: any[];
  cuentasContables: any[];
  saving: boolean;
  onSave: (e: React.FormEvent) => void;
  onClose: () => void;
}

export const EditMovimientoModal: React.FC<EditMovimientoModalProps> = ({
  editingMov,
  setEditingMov,
  cuentas,
  cuentasContables,
  saving,
  onSave,
  onClose
}) => {
  const [searchEditBank, setSearchEditBank] = useState('');
  const [isEditBankOpen, setIsEditBankOpen] = useState(false);
  const editBankRef = useRef<HTMLDivElement>(null);

  const selectedEditBankText = useMemo(() => {
    if (!editingMov) return '';
    const selected = cuentasContables.find((c: any) => c.id === editingMov.id_cuenta_banco_contable);
    return selected ? `${selected.codigo_cuenta} - ${selected.nombre}` : '';
  }, [cuentasContables, editingMov?.id_cuenta_banco_contable]);

  useEffect(() => {
    if (!isEditBankOpen && editingMov) {
      setSearchEditBank(selectedEditBankText);
    }
  }, [selectedEditBankText, isEditBankOpen, editingMov]);

  useEffect(() => {
    const handleClickOutsideEdit = (event: MouseEvent) => {
      if (editBankRef.current && !editBankRef.current.contains(event.target as Node)) {
        setIsEditBankOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutsideEdit);
    return () => {
      document.removeEventListener('mousedown', handleClickOutsideEdit);
    };
  }, []);

  const filteredEditBankCuentas = useMemo(() => {
    const movementCuentas = cuentasContables.filter((c: any) => c.acepta_movimientos);
    if (!searchEditBank || searchEditBank === selectedEditBankText) {
      return movementCuentas;
    }
    const query = searchEditBank.toLowerCase();
    return movementCuentas.filter((c: any) =>
      c.codigo_cuenta?.toLowerCase().includes(query) ||
      c.nombre?.toLowerCase().includes(query)
    );
  }, [cuentasContables, searchEditBank, selectedEditBankText]);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(5,8,16,0.85)', backdropFilter: 'blur(12px)', padding: '20px', boxSizing: 'border-box' }}>
        <div className="glass-card" style={{ padding: '28px', width: '90%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 className="h1" style={{ fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: 8, marginBottom: '20px' }}>
                <CheckCircle2 color="var(--primary)" /> Editar {editingMov.tipo_movimiento === 'Pago' ? 'Pago a Proveedor' : 'Cobro a Cliente'}
            </h3>
            
            {!editingMov.txId && (
              <div style={{ 
                background: 'rgba(245,158,11,0.1)', 
                border: '1px solid rgba(245,158,11,0.3)', 
                color: '#f59e0b', 
                padding: '10px 14px', 
                borderRadius: '8px', 
                fontSize: '0.8rem', 
                fontWeight: 600, 
                marginBottom: '16px',
                lineHeight: '1.4'
              }}>
                ⚠️ No se encontró el asiento contable asociado a este movimiento en el Libro Diario. La edición solo modificará el registro en el panel de Tesorería.
              </div>
            )}
            
            <form onSubmit={onSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                    <label className="text-sec" style={{ fontSize: '0.75rem', fontWeight: 800 }}>Documento a saldar</label>
                    <select value={editingMov.id_documento || ''} disabled style={{...inputStyle, opacity: 0.7, cursor: 'not-allowed'}}>
                        <option value="">Selecciona (Factura/Deuda)</option>
                        {editingMov.id_documento && (
                          <option value={editingMov.id_documento}>
                            {editingMov.entidades?.razon_social || 'N/A'} - {editingMov.documento?.referencia || editingMov.referencia} (${Number(editingMov.documento?.total || editingMov.monto).toFixed(2)})
                          </option>
                        )}
                    </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                        <label className="text-sec" style={{ fontSize: '0.75rem', fontWeight: 800 }}>Monto a aplicar ($)</label>
                        <input 
                            type="number" 
                            step="0.01" 
                            value={editingMov.monto} 
                            onChange={e => setEditingMov({...editingMov, monto: e.target.value})} 
                            style={{...inputStyle, fontWeight: 900}} 
                            required 
                        />
                    </div>
                    <div>
                        <label className="text-sec" style={{ fontSize: '0.75rem', fontWeight: 800 }}>Fecha</label>
                        <input 
                            type="date" 
                            value={editingMov.fecha} 
                            onChange={e => setEditingMov({...editingMov, fecha: e.target.value})} 
                            style={inputStyle} 
                            required 
                        />
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                        <label className="text-sec" style={{ fontSize: '0.75rem', fontWeight: 800 }}>Caja / Banco de Tesorería (Opcional)</label>
                        <select 
                            value={editingMov.id_cuenta_financiera || ''} 
                            onChange={e => {
                                const fid = e.target.value;
                                const selectedFinCta = cuentas.find(c => c.id === fid);
                                let matchedContableId = editingMov.id_cuenta_banco_contable;
                                if (selectedFinCta) {
                                    const match = cuentasContables.find((cc: any) => 
                                        cc.nombre.toLowerCase().includes(selectedFinCta.nombre.toLowerCase()) ||
                                        selectedFinCta.nombre.toLowerCase().includes(cc.nombre.toLowerCase())
                                    );
                                    if (match) {
                                        matchedContableId = match.id;
                                    }
                                }
                                setEditingMov({
                                    ...editingMov, 
                                    id_cuenta_financiera: fid,
                                    id_cuenta_banco_contable: matchedContableId
                                });
                            }} 
                            style={inputStyle}
                        >
                            <option value="">No deducir de panel</option>
                            {cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-sec" style={{ fontSize: '0.75rem', fontWeight: 800 }}>Cuenta Contable (Libro Diario)</label>
                        <div ref={editBankRef} style={{ position: 'relative' }}>
                            <input 
                                value={searchEditBank}
                                onChange={e => {
                                    setSearchEditBank(e.target.value);
                                    setIsEditBankOpen(true);
                                }}
                                onFocus={() => {
                                    setSearchEditBank('');
                                    setIsEditBankOpen(true);
                                }}
                                placeholder="Buscar cuenta contable..."
                                style={inputStyle}
                                required={!editingMov.id_cuenta_banco_contable}
                            />
                            <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', opacity: 0.6, fontSize: '0.8rem', color: 'var(--text-sec)' }}>
                                ▼
                            </span>
                            
                            {isEditBankOpen && (
                                <div style={{ 
                                    position: 'absolute', 
                                    top: '100%', 
                                    left: 0, 
                                    right: 0, 
                                    maxHeight: '180px', 
                                    overflowY: 'auto', 
                                    background: '#0c101f', 
                                    border: '1px solid var(--border-color)', 
                                    borderRadius: '12px', 
                                    marginTop: '4px', 
                                    zIndex: 9999,
                                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)'
                                }}>
                                    {filteredEditBankCuentas.length === 0 ? (
                                        <div style={{ padding: '10px 12px', color: 'var(--text-sec)', fontSize: '0.85rem' }}>No se encontraron cuentas</div>
                                    ) : (
                                        filteredEditBankCuentas.map((c: any) => {
                                            const isSelected = c.id === editingMov.id_cuenta_banco_contable;
                                            return (
                                                <div 
                                                    key={c.id}
                                                    onClick={() => {
                                                        setEditingMov({...editingMov, id_cuenta_banco_contable: c.id});
                                                        setIsEditBankOpen(false);
                                                    }}
                                                    style={{ 
                                                        padding: '8px 12px', 
                                                        cursor: 'pointer', 
                                                        background: isSelected ? 'var(--primary-light)' : 'transparent',
                                                        color: isSelected ? 'var(--primary)' : 'var(--text-main)',
                                                        fontSize: '0.85rem',
                                                        borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
                                                        textAlign: 'left'
                                                    }}
                                                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; }}
                                                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                                                >
                                                    {c.codigo_cuenta} - {c.nombre}
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div>
                    <label className="text-sec" style={{ fontSize: '0.75rem', fontWeight: 800 }}>Referencia bancaria / Voucher</label>
                    <input 
                        value={editingMov.referencia} 
                        onChange={e => setEditingMov({...editingMov, referencia: e.target.value})} 
                        placeholder="Nº de transferencia, cheque, etc..." 
                        style={inputStyle} 
                    />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 10 }}>
                    <button 
                        type="button" 
                        onClick={onClose} 
                        className="btn" 
                        style={{ padding: '10px 20px', borderRadius: 10 }}
                    >
                        Cancelar
                    </button>
                    <button 
                        type="submit" 
                        disabled={saving || !editingMov.monto || !editingMov.id_cuenta_banco_contable} 
                        className="btn btn-primary" 
                        style={{ padding: '10px 24px', borderRadius: 10 }}
                    >
                        {saving ? 'Guardando...' : 'Guardar Cambios'}
                    </button>
                </div>
            </form>
        </div>
    </div>
  );
};
