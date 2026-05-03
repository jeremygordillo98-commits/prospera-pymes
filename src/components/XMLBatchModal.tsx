import React, { useState, useRef, useEffect } from 'react';
import { X, Upload, FileText, CheckCircle2, AlertCircle, Loader2, Save, Trash2, Receipt, FileMinus } from 'lucide-react';
import { motion } from 'framer-motion';
import { type SRIParsedData, parseSRIXML } from '../utils/sriParser';
import { supabase } from '../services/supabase';
import { CATALOGO_RETENCIONES_RENTA } from '../utils/sriCatalog';
import { EntidadQuickForm } from './EntidadQuickForm';
import { AccountCombobox } from './AccountCombobox';
import { saveSRIDocument } from '../utils/saveSRIDocument';

interface Account { id: string; codigo_cuenta: string; nombre: string; tipo: string; }

interface BatchItem {
  id: string; // unique internal id (e.g., file name + index)
  file: File;
  parsedData: SRIParsedData | null;
  status: 'parsing' | 'ready' | 'no_entity' | 'saving' | 'saved' | 'error';
  errorMessage?: string;
  entidadId?: string;
  // Account selections
  idCuentaDebe: string;
  idCuentaHaber: string;
  idCuentaRetencion: string;
  retencionCodigo: string;
}

interface Props {
  isOpen: boolean;
  empresaId: string;
  onClose: () => void;
  onSuccess: () => void;
}

const retencionesComoAccounts: Account[] = CATALOGO_RETENCIONES_RENTA.map(r => ({
  id: r.codigo,
  codigo_cuenta: r.codigo,
  nombre: `${r.descripcion} (${r.porcentaje}%)`,
  tipo: '',
}));

export const XMLBatchModal: React.FC<Props> = ({ isOpen, empresaId, onClose, onSuccess }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<BatchItem[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [rucEmpresa, setRucEmpresa] = useState<string>('');
  const [savingGlobal, setSavingGlobal] = useState(false);
  const [saveProgress, setSaveProgress] = useState({ current: 0, total: 0 });

  useEffect(() => {
    if (!isOpen || !empresaId) return;

    // Fetch accounts
    supabase.from('plan_cuentas').select('id,codigo_cuenta,nombre,tipo')
      .eq('id_empresa', empresaId).eq('acepta_movimientos', true).order('codigo_cuenta')
      .then(({ data }) => {
        if (data) setAccounts(data);
      });

    // Fetch empresa RUC
    supabase.from('empresas_gestionadas').select('ruc_empresa').eq('id', empresaId).single()
      .then(({ data }) => {
        if (data) setRucEmpresa(data.ruc_empresa);
      });
  }, [isOpen, empresaId]);

  const checkEntitiesBulk = async (rucs: string[]) => {
    if (rucs.length === 0) return {};
    const { data } = await supabase.from('entidades').select('id, ruc_cedula')
      .in('ruc_cedula', rucs).eq('id_empresa', empresaId);
    
    const map: Record<string, string> = {};
    data?.forEach(e => { map[e.ruc_cedula] = e.id; });
    return map;
  };

  const checkDuplicatesBulk = async (claves: string[]) => {
    if (claves.length === 0) return new Set<string>();
    const { data } = await supabase.from('documentos_sri').select('clave_acceso_xml')
      .in('clave_acceso_xml', claves).eq('id_empresa', empresaId);
    return new Set(data?.map(d => d.clave_acceso_xml) || []);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Default accounts logic
    const g = accounts.find(a => a.codigo_cuenta.startsWith('5'))?.id || accounts[0]?.id || '';
    const p = accounts.find(a => a.codigo_cuenta.startsWith('2.1.3'))?.id || accounts[0]?.id || '';
    const r = accounts.find(a => a.codigo_cuenta.startsWith('2.1.4') || a.nombre.toLowerCase().includes('retencion'))?.id || accounts[0]?.id || '';

    // Initialize items
    const newItems: BatchItem[] = files.map((file, i) => ({
      id: `${file.name}-${Date.now()}-${i}`,
      file,
      parsedData: null,
      status: 'parsing',
      idCuentaDebe: '',
      idCuentaHaber: '',
      idCuentaRetencion: r,
      retencionCodigo: '000',
    }));

    setItems(prev => [...prev, ...newItems]);
    e.target.value = ''; // Reset input

    // Parse all files
    const parsedResults = await Promise.all(
      newItems.map(async item => {
        try {
          const text = await item.file.text();
          const data = await parseSRIXML(text);
          return { item, data };
        } catch (err) {
          return { item, data: null };
        }
      })
    );

    // Collect all unique RUCs to check entities in bulk
    const validResults = parsedResults.filter(r => r.data).map(r => r.data!);
    const rucsToCheck = Array.from(new Set(validResults.map(data => data.rucEmisor)));
    const clavesToCheck = Array.from(new Set(validResults.map(data => data.claveAcceso)));
    
    const [entitiesMap, duplicatesSet] = await Promise.all([
      checkEntitiesBulk(rucsToCheck),
      checkDuplicatesBulk(clavesToCheck)
    ]);

    // Update items state with parsed data and entity checks
    setItems(prev => prev.map(pItem => {
      const result = parsedResults.find(r => r.item.id === pItem.id);
      if (!result) return pItem;
      if (!result.data) return { ...pItem, status: 'error', errorMessage: 'Estructura XML inválida' };

      const data = result.data;
      if (duplicatesSet.has(data.claveAcceso)) {
        return { ...pItem, parsedData: data, status: 'error', errorMessage: 'Documento duplicado (ya existe)' };
      }

      const entidadId = entitiesMap[data.rucEmisor];

      let debe = '';
      let haber = '';
      if (data.tipoDocumento === 'FACTURA') {
        debe = g; haber = p;
      } else if (data.tipoDocumento === 'COM_RETENCION') {
        debe = accounts.find(a => a.codigo_cuenta.startsWith('1.1.3') || a.nombre.toLowerCase().includes('anticipo'))?.id || '';
        haber = accounts.find(a => a.codigo_cuenta.startsWith('1.1.2') || a.nombre.toLowerCase().includes('cliente'))?.id || '';
      } else if (data.tipoDocumento === 'NOTA_CREDITO') {
        debe = accounts.find(a => a.codigo_cuenta.startsWith('4'))?.id || '';
        haber = accounts.find(a => a.codigo_cuenta.startsWith('1.1.2') || a.nombre.toLowerCase().includes('cliente'))?.id || '';
      }

      return {
        ...pItem,
        parsedData: data,
        entidadId,
        status: entidadId ? 'ready' : 'no_entity',
        idCuentaDebe: debe,
        idCuentaHaber: haber,
      };
    }));
  };

  const updateItem = (id: string, updates: Partial<BatchItem>) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const reset = () => {
    setItems([]);
    setSavingGlobal(false);
    setSaveProgress({ current: 0, total: 0 });
  };

  const handleSaveAll = async () => {
    const readyItems = items.filter(i => i.status === 'ready');
    if (readyItems.length === 0) return;

    // Validation
    for (const item of readyItems) {
      if (!item.idCuentaDebe || !item.idCuentaHaber) {
        alert('Algunos documentos listos no tienen cuentas asignadas.');
        return;
      }
      const isFactura = item.parsedData?.tipoDocumento === 'FACTURA';
      const retSel = CATALOGO_RETENCIONES_RENTA.find(r => r.codigo === item.retencionCodigo) || CATALOGO_RETENCIONES_RENTA[0];
      if (isFactura && retSel.porcentaje > 0 && !item.idCuentaRetencion) {
        alert('Asigna la cuenta de pasivo retención donde corresponda.');
        return;
      }
    }

    setSavingGlobal(true);
    setSaveProgress({ current: 0, total: readyItems.length });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert('Sesión no válida');
      setSavingGlobal(false);
      return;
    }

    let savedCount = 0;
    for (const item of readyItems) {
      updateItem(item.id, { status: 'saving' });
      try {
        await saveSRIDocument({
          parsedData: item.parsedData!,
          empresaId,
          entidadId: item.entidadId!,
          idCuentaDebe: item.idCuentaDebe,
          idCuentaHaber: item.idCuentaHaber,
          idCuentaRetencion: item.idCuentaRetencion,
          retencionCodigo: item.retencionCodigo,
          userId: user.id,
          rucEmpresa,
        });
        updateItem(item.id, { status: 'saved' });
        savedCount++;
        setSaveProgress(prev => ({ ...prev, current: prev.current + 1 }));
      } catch (error: any) {
        updateItem(item.id, { status: 'error', errorMessage: error.message });
      }
    }

    setSavingGlobal(false);
    if (savedCount === readyItems.length) {
      setTimeout(() => {
        onSuccess();
        onClose();
        reset();
      }, 1500);
    } else if (savedCount > 0) {
      onSuccess(); // Refresh list to show saved ones
    }
  };

  if (!isOpen) return null;

  const btnStyle = { background: 'var(--input-bg)', border: '1px solid var(--border-color)' };

  const readyCount = items.filter(i => i.status === 'ready').length;
  const noEntityItems = items.filter(i => i.status === 'no_entity');

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(12px)' }}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-card w-full" style={{ maxWidth: 1200, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>

        {/* Header */}
        <div className="flex-between p-6" style={{ borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}>
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Upload size={20} className="text-primary" /> Carga Masiva de XML SRI
          </h3>
          <button onClick={onClose} className="btn" style={{ ...btnStyle, padding: 8, borderRadius: 10 }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 custom-scrollbar" style={{ overflowY: 'auto', flex: 1 }}>

          {/* Zona de carga */}
          {items.length === 0 ? (
            <div onClick={() => fileInputRef.current?.click()}
              className="group"
              style={{ border: '2px dashed var(--border-color)', borderRadius: 20, padding: 64, textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.background = 'var(--primary-light)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.background = 'transparent'; }}
            >
              <div style={{ width: 80, height: 80, background: 'var(--primary-light)', borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', transition: 'transform 0.2s' }}>
                <Upload size={40} className="text-primary" />
              </div>
              <p className="font-bold" style={{ fontSize: '1.4rem', marginBottom: 8 }}>Sube múltiples archivos XML</p>
              <p className="text-sec" style={{ fontSize: '0.9rem' }}>Selecciona varios archivos a la vez para procesarlos en lote.</p>
              <input ref={fileInputRef} type="file" multiple accept=".xml" style={{ display: 'none' }} onChange={handleFileChange} />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

              <div className="flex-between">
                <div>
                  <h4 className="font-bold text-lg">Archivos Procesados ({items.length})</h4>
                  <p className="text-sec text-sm">Verifica y asigna cuentas antes de guardar.</p>
                </div>
                <button onClick={() => fileInputRef.current?.click()} className="btn" style={{ ...btnStyle, borderRadius: 10, padding: '8px 16px', fontSize: '0.85rem' }}>
                  + Agregar más
                </button>
                <input ref={fileInputRef} type="file" multiple accept=".xml" style={{ display: 'none' }} onChange={handleFileChange} />
              </div>

              {/* Crear Entidades Pendientes */}
              {noEntityItems.length > 0 && (
                <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', padding: 16, borderRadius: 14, display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'flex', gap: 12, color: 'var(--warning)' }}>
                    <AlertCircle size={22} style={{ flexShrink: 0 }} />
                    <div>
                      <p className="font-bold">Emisores no encontrados ({noEntityItems.length})</p>
                      <p style={{ fontSize: '0.8rem', opacity: 0.9 }}>Registra estas entidades para poder guardar sus documentos.</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 8 }} className="custom-scrollbar">
                    {Array.from(new Set(noEntityItems.map(i => i.parsedData!.rucEmisor))).map(ruc => {
                      const item = noEntityItems.find(i => i.parsedData!.rucEmisor === ruc)!;
                      return (
                        <div key={ruc} style={{ minWidth: 320, background: 'var(--card-bg)', padding: 16, borderRadius: 12, border: '1px solid var(--border-color)' }}>
                          <EntidadQuickForm
                            ruc={ruc} razonSocial={item.parsedData!.razonSocialEmisor} empresaId={empresaId}
                            onSuccess={(id) => {
                              setItems(prev => prev.map(p => p.parsedData?.rucEmisor === ruc ? { ...p, entidadId: id, status: 'ready' } : p));
                            }}
                            onCancel={() => {
                              // Optional: remove items associated with this RUC if cancelled?
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Tabla de Documentos */}
              <div style={{ overflowX: 'auto', borderRadius: 14, border: '1px solid var(--border-color)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1000 }}>
                  <thead style={{ background: 'var(--input-bg)' }}>
                    <tr>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.75rem', color: 'var(--text-sec)' }}>Estado</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.75rem', color: 'var(--text-sec)' }}>Documento</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-sec)' }}>Total</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.75rem', color: 'var(--text-sec)', width: 200 }}>Debe</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.75rem', color: 'var(--text-sec)', width: 200 }}>Haber</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.75rem', color: 'var(--text-sec)', width: 200 }}>Retención IR</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-sec)' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(item => {
                      const isFactura = item.parsedData?.tipoDocumento === 'FACTURA';
                      const isRetencion = item.parsedData?.tipoDocumento === 'COM_RETENCION';
                      const isNotaCredito = item.parsedData?.tipoDocumento === 'NOTA_CREDITO';

                      const retSel = CATALOGO_RETENCIONES_RENTA.find(r => r.codigo === item.retencionCodigo) || CATALOGO_RETENCIONES_RENTA[0];
                      const parsed: any = item.parsedData;
                      const valorRetenido = isFactura && parsed ? ((parsed.baseImponible * retSel.porcentaje) / 100) : 0;
                      const total = isFactura ? parsed?.total : isRetencion ? parsed?.totalRetenido : parsed?.valorModificacion;

                      return (
                        <tr key={item.id} style={{ borderTop: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '12px 16px' }}>
                            {item.status === 'parsing' && <Loader2 className="animate-spin text-sec" size={18} />}
                            {item.status === 'no_entity' && <span title="Falta crear entidad" style={{ display: 'flex' }}><AlertCircle className="text-warning" size={18} /></span>}
                            {item.status === 'ready' && <span title="Listo para guardar" style={{ display: 'flex' }}><CheckCircle2 className="text-sec" size={18} /></span>}
                            {item.status === 'saving' && <Loader2 className="animate-spin text-primary" size={18} />}
                            {item.status === 'saved' && <CheckCircle2 className="text-success" size={18} />}
                            {item.status === 'error' && <span title={item.errorMessage} style={{ display: 'flex' }}><AlertCircle className="text-error" size={18} /></span>}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            {item.parsedData ? (
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', fontWeight: 700, color: isRetencion ? 'var(--warning)' : isNotaCredito ? 'var(--error)' : 'var(--primary)' }}>
                                  {isFactura ? <FileText size={14} /> : isRetencion ? <Receipt size={14} /> : <FileMinus size={14} />}
                                  {item.parsedData.numeroComprobante}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-main)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 }} title={item.parsedData.razonSocialEmisor}>
                                  {item.parsedData.razonSocialEmisor}
                                </div>
                              </div>
                            ) : (
                              <div style={{ fontSize: '0.8rem', color: 'var(--text-sec)' }}>{item.file.name}</div>
                            )}
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, fontSize: '0.85rem' }}>
                            {total !== undefined ? `$${total.toFixed(2)}` : '—'}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            {item.parsedData && (
                              <AccountCombobox
                                accounts={accounts}
                                value={item.idCuentaDebe}
                                onChange={(val) => updateItem(item.id, { idCuentaDebe: val })}
                                placeholder="Cuenta Debe"
                                fixedDropdown
                              />
                            )}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            {item.parsedData && (
                              <AccountCombobox
                                accounts={accounts}
                                value={item.idCuentaHaber}
                                onChange={(val) => updateItem(item.id, { idCuentaHaber: val })}
                                placeholder="Cuenta Haber"
                                fixedDropdown
                              />
                            )}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            {isFactura && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <AccountCombobox
                                  accounts={retencionesComoAccounts}
                                  value={item.retencionCodigo}
                                  onChange={(val) => updateItem(item.id, { retencionCodigo: val })}
                                  placeholder="Retención"
                                  fixedDropdown
                                />
                                {valorRetenido > 0 && (
                                  <AccountCombobox
                                    accounts={accounts}
                                    value={item.idCuentaRetencion}
                                    onChange={(val) => updateItem(item.id, { idCuentaRetencion: val })}
                                    placeholder="Pasivo Ret."
                                    filterByTipo="Pasivo"
                                    fixedDropdown
                                  />
                                )}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                            {item.status !== 'saved' && item.status !== 'saving' && (
                              <button onClick={() => removeItem(item.id)} className="text-sec hover:text-error" style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
                                <Trash2 size={16} />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="p-6 flex-between" style={{ borderTop: '1px solid var(--border-color)', background: 'var(--nav-bg)', flexShrink: 0 }}>
            <div>
              {savingGlobal && (
                <span style={{ fontSize: '0.9rem', color: 'var(--text-sec)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Loader2 size={16} className="animate-spin text-primary" /> Guardando {saveProgress.current} de {saveProgress.total}...
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 16 }}>
              <button onClick={reset} className="btn" style={{ ...btnStyle, borderRadius: 12 }}>
                Limpiar Todo
              </button>
              <button onClick={handleSaveAll} disabled={savingGlobal || readyCount === 0} className="btn btn-primary" style={{ borderRadius: 12, padding: '10px 24px' }}>
                <Save size={18} /> Guardar {readyCount} Documentos
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};
