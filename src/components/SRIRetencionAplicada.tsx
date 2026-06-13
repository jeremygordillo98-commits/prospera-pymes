import React from 'react';
import { motion } from 'framer-motion';
import { Trash2, Loader2, Upload, Save, AlertCircle } from 'lucide-react';
import { CATALOGO_RETENCIONES_RENTA, CATALOGO_RETENCIONES_IVA, CATALOGO_SUSTENTO_TRIBUTARIO } from '../utils/sriCatalog';
import { AccountSelector } from './AccountSelector';

interface Props {
  doc: any;
  tipo: 'Compras' | 'Ventas';
  accounts: any[];
  withholdingLoading: boolean;
  parsedWithholding: any | null;
  verRetRenta: string;
  setVerRetRenta: (val: string) => void;
  verRetIva: string;
  setVerRetIva: (val: string) => void;
  selectedWithholdingRentaAccount: string;
  setSelectedWithholdingRentaAccount: (val: string) => void;
  selectedWithholdingIvaAccount: string;
  setSelectedWithholdingIvaAccount: (val: string) => void;
  handleWithholdingFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleSaveManualWithholding: () => void;
  handleRemoveWithholding: (doc: any) => void;
  handleApplyWithholdingFromXML: () => void;
  
  // Nuevas props para ATS completo
  codSustento: string;
  setCodSustento: (val: string) => void;
  manualNumRet: string;
  setManualNumRet: (val: string) => void;
  manualAutRet: string;
  setManualAutRet: (val: string) => void;
  manualFechaRet: string;
  setManualFechaRet: (val: string) => void;
}

export const SRIRetencionAplicada: React.FC<Props> = ({
  doc,
  tipo,
  accounts,
  withholdingLoading,
  parsedWithholding,
  verRetRenta,
  setVerRetRenta,
  verRetIva,
  setVerRetIva,
  selectedWithholdingRentaAccount,
  setSelectedWithholdingRentaAccount,
  selectedWithholdingIvaAccount,
  setSelectedWithholdingIvaAccount,
  handleWithholdingFileChange,
  handleSaveManualWithholding,
  handleRemoveWithholding,
  handleApplyWithholdingFromXML,
  codSustento,
  setCodSustento,
  manualNumRet,
  setManualNumRet,
  manualAutRet,
  setManualAutRet,
  manualFechaRet,
  setManualFechaRet
}) => {
  const isCompra = tipo === 'Compras';
  const hasWithholdingApplied = doc.retenciones_aplicadas && doc.retenciones_aplicadas.length > 0;
  
  const tieneRetRenta = verRetRenta && verRetRenta !== '000';
  const tieneRetIva = verRetIva && verRetIva !== '729';
  const requiereMetadataRetencion = isCompra && (tieneRetRenta || tieneRetIva);

  // Validaciones del formulario manual
  const numRetValido = !requiereMetadataRetencion || /^\d{3}-\d{3}-\d{9}$/.test(manualNumRet);
  const autRetValida = !requiereMetadataRetencion || /^\d{10}$|^\d{49}$/.test(manualAutRet);
  const fechaRetValida = !requiereMetadataRetencion || !!manualFechaRet;
  const cuentasValidas = !requiereMetadataRetencion || (
    (tieneRetRenta ? !!selectedWithholdingRentaAccount : true) &&
    (tieneRetIva ? !!selectedWithholdingIvaAccount : true)
  );

  const canSaveManual = !withholdingLoading && 
    (isCompra ? !!codSustento : true) &&
    (requiereMetadataRetencion ? (numRetValido && autRetValida && fechaRetValida && cuentasValidas) : true);

  // Formatear secuencial del número de retención (ej: 001-001-000000001)
  const formatSecuencial = (value: string) => {
    const clean = value.replace(/\D/g, '');
    if (clean.length === 0) return '';
    
    let estab = clean.substring(0, 3);
    let ptoEmi = clean.substring(3, 6);
    let sec = clean.substring(6, 15);
    
    let formatted = estab;
    if (clean.length > 3) formatted += '-' + ptoEmi;
    if (clean.length > 6) formatted += '-' + sec;
    
    return formatted;
  };

  const handleNumRetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    // Si borra, permitir borrar libremente, de lo contrario formatear
    if (val.length < manualNumRet.length) {
      setManualNumRet(val);
    } else {
      setManualNumRet(formatSecuencial(val));
    }
  };

  return (
    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.04)' }}>
      <h4 style={{ margin: '0 0 16px 0', fontSize: '1rem', fontWeight: 800, color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>Retención Aplicada</span>
        {hasWithholdingApplied && (
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

      {hasWithholdingApplied ? (
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
            {isCompra && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-sec)' }}>Sustento Tributario:</span>
                <span style={{ fontWeight: 'bold', color: 'var(--primary)' }}>
                  {doc.retenciones_aplicadas[0].cod_sustento || '01'}
                </span>
              </div>
            )}
          </div>

          {doc.retenciones_aplicadas.some((r: any) => r.valor > 0) ? (
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
                {doc.retenciones_aplicadas.map((r: any, idx: number) => {
                  if (r.valor === 0 && r.porcentaje === 0) return null;
                  return (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                      <td style={{ padding: '8px 0', color: '#ffffff', fontWeight: 500 }}>{r.tipo}</td>
                      <td style={{ padding: '8px 0', color: 'var(--text-sec)', fontFamily: 'monospace' }}>{r.codigo}</td>
                      <td style={{ padding: '8px 0', textAlign: 'right', color: '#ffffff' }}>${(r.base || 0).toFixed(2)}</td>
                      <td style={{ padding: '8px 0', textAlign: 'right', color: 'var(--warning)', fontWeight: 600 }}>{r.porcentaje}%</td>
                      <td style={{ padding: '8px 0', textAlign: 'right', color: 'var(--warning)', fontWeight: 'bold' }}>${(r.valor || 0).toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div style={{ padding: '6px 0', color: 'var(--text-sec)', fontStyle: 'italic' }}>
              Documento guardado únicamente con fines informativos de Sustento Tributario (Sin Retenciones).
            </div>
          )}

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
            Sin retenciones cargadas. Selecciona el sustento tributario y los códigos, o sube el XML de retención.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            
            {/* 1. SECTOR SUSTENTO TRIBUTARIO (COMPRAS) */}
            {isCompra && (
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-sec)' }}>
                  Sustento Tributario SRI*
                </label>
                <select
                  value={codSustento}
                  onChange={e => setCodSustento(e.target.value)}
                  style={{ ...inputStyle, padding: '8px 12px', fontSize: '0.82rem' }}
                >
                  {CATALOGO_SUSTENTO_TRIBUTARIO.map(s => (
                    <option key={s.codigo} value={s.codigo}>
                      {s.codigo} - {s.descripcion.substring(0, 75)}...
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Dual Account Selectors */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-sec)' }}>
                  Cuenta Contable de Retención Renta ({isCompra ? 'Pasivo' : 'Activo'})*
                </label>
                <AccountSelector 
                  value={selectedWithholdingRentaAccount}
                  onChange={setSelectedWithholdingRentaAccount}
                  accounts={isCompra ? accounts.filter(a => a.tipo === 'Pasivo') : accounts.filter(a => a.tipo === 'Activo')}
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
                  Cuenta Contable de Retención IVA ({isCompra ? 'Pasivo' : 'Activo'})*
                </label>
                <AccountSelector 
                  value={selectedWithholdingIvaAccount}
                  onChange={setSelectedWithholdingIvaAccount}
                  accounts={isCompra ? accounts.filter(a => a.tipo === 'Pasivo') : accounts.filter(a => a.tipo === 'Activo')}
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

            {/* OPCIÓN A: SUBIR XML */}
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
                  onClick={handleApplyWithholdingFromXML}
                  className="btn btn-primary"
                  style={{ width: '100%', marginTop: '10px', padding: '8px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                >
                  <Upload size={14} /> Aplicar Retención del XML
                </button>
              </motion.div>
            )}

            {/* OPCIÓN B: SELECCIÓN MANUAL */}
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

                {/* CAMPOS METADATA RETENCIÓN EMITIDA (COMPRAS MANUALES) */}
                {requiereMetadataRetencion && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: 'rgba(255,255,255,0.01)', padding: '14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.03)', marginTop: 8 }}
                  >
                    <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--warning)', display: 'flex', gap: 4, alignItems: 'center' }}>
                      <AlertCircle size={14} /> Referencias de Retención Obligatorias para ATS
                    </div>
                    
                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.72rem', color: numRetValido ? 'var(--text-sec)' : 'var(--error)' }}>
                        Número de Retención* (Formato: estab-ptoEmi-secuencial)
                      </label>
                      <input 
                        type="text" 
                        placeholder="001-001-000000001"
                        maxLength={17}
                        value={manualNumRet}
                        onChange={handleNumRetChange}
                        style={{ ...inputStyle, padding: '6px 10px', fontSize: '0.8rem', borderColor: numRetValido ? 'var(--border-color)' : 'var(--error)' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.72rem', color: autRetValida ? 'var(--text-sec)' : 'var(--error)' }}>
                        Clave Acceso / Autorización Retención* (10 o 49 dígitos)
                      </label>
                      <input 
                        type="text" 
                        placeholder="ej: 1306202607179279716..."
                        maxLength={49}
                        value={manualAutRet}
                        onChange={e => setManualAutRet(e.target.value.replace(/\D/g, ''))}
                        style={{ ...inputStyle, padding: '6px 10px', fontSize: '0.8rem', borderColor: autRetValida ? 'var(--border-color)' : 'var(--error)' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.72rem', color: 'var(--text-sec)' }}>
                        Fecha de Emisión Retención*
                      </label>
                      <input 
                        type="date" 
                        value={manualFechaRet}
                        onChange={e => setManualFechaRet(e.target.value)}
                        style={{ ...inputStyle, padding: '6px 10px', fontSize: '0.8rem' }}
                      />
                    </div>
                  </motion.div>
                )}
                
                <button
                  type="button"
                  disabled={!canSaveManual}
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
                    borderRadius: '10px',
                    opacity: canSaveManual ? 1 : 0.5
                  }}
                >
                  {withholdingLoading ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />} 
                  {requiereMetadataRetencion ? 'Aplicar Retención Manual' : 'Aplicar Sustento Tributario'}
                </button>
              </div>
            </div>
            
          </div>
        </div>
      )}
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
