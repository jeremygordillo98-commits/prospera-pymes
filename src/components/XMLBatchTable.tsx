import React from 'react';
import { CheckCircle2, Trash2 } from 'lucide-react';
import { supabase } from '../services/supabase';
import { AccountSelector } from './AccountSelector';
import { CATALOGO_RETENCIONES_RENTA } from '../utils/sriCatalog';
import type { Account, BatchItem } from '../hooks/useXMLUpload';

interface XMLBatchTableProps {
  items: BatchItem[];
  accounts: Account[];
  empresaId: string;
  onChangeItem: (idx: number, updated: BatchItem) => void;
  onDeleteItem: (idx: number) => void;
}

export const XMLBatchTable: React.FC<XMLBatchTableProps> = ({
  items,
  accounts,
  empresaId,
  onChangeItem,
  onDeleteItem
}) => {
  return (
    <div className="custom-scrollbar" style={{
      border: '1px solid var(--border-color)',
      borderRadius: '16px',
      overflow: 'hidden',
      backgroundColor: 'rgba(0, 0, 0, 0.2)',
      flex: 1,
      overflowX: 'auto'
    }}>
      <table style={{
        width: '100%',
        textAlign: 'left',
        borderCollapse: 'collapse',
        minWidth: '1240px',
        tableLayout: 'fixed',
        fontSize: '11px'
      }}>
        <thead>
          <tr style={{
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            borderBottom: '1px solid var(--border-color)',
            color: 'var(--text-sec)',
            textTransform: 'uppercase',
            fontWeight: 'bold',
            letterSpacing: '0.5px',
            fontSize: '9px'
          }}>
            <th style={{ padding: '12px 16px', textAlign: 'center', width: '80px' }}>Estado</th>
            <th style={{ padding: '12px 16px', width: '280px' }}>Documento</th>
            <th style={{ padding: '12px 16px', textAlign: 'right', width: '100px' }}>Total</th>
            <th style={{ padding: '12px 16px', width: '280px' }}>Debe (Gasto/Inv)</th>
            <th style={{ padding: '12px 16px', width: '280px' }}>Bases e IVA (0%, 5%, 15%)</th>
            <th style={{ padding: '12px 16px', width: '240px' }}>Haber (Pasivo/CXP)</th>
            <th style={{ padding: '12px 16px', textAlign: 'center', width: '60px' }}></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => {
            const p = item.parsed;
            if (!p) {
              return (
                <tr key={idx} style={{
                  borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                  backgroundColor: 'rgba(239, 68, 68, 0.08)'
                }}>
                  <td style={{ padding: '16px', textAlign: 'center' }}>
                    <span style={{ color: 'var(--error)', fontWeight: 'bold', fontSize: '10px' }}>🔴 Error</span>
                  </td>
                  <td style={{ padding: '16px', fontFamily: 'monospace', color: '#fca5a5', fontSize: '11px' }} colSpan={6}>
                    <span style={{ fontWeight: 'bold' }}>{item.fileName}</span> — {item.errorMsg}
                  </td>
                  <td style={{ padding: '16px', textAlign: 'center', verticalAlign: 'middle' }}>
                    <button
                      onClick={() => onDeleteItem(idx)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-sec)',
                        cursor: 'pointer',
                        transition: 'color 0.2s ease',
                        padding: '4px'
                      }}
                      onMouseEnter={e => e.currentTarget.style.color = 'var(--error)'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--text-sec)'}
                      title="Eliminar del lote"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              );
            }

            const isFact = p.tipoDocumento === 'FACTURA';
            const isRet = p.tipoDocumento === 'COM_RETENCION';
            const isNC = p.tipoDocumento === 'NOTA_CREDITO';
            
            const tc = isFact ? 'Factura' : isRet ? 'Retención' : isNC ? 'Nota de Crédito' : 'Desconocido';
            const badgeColor = isFact ? '#10b981' : isRet ? '#f59e0b' : '#ef4444';
            
            const retSel = CATALOGO_RETENCIONES_RENTA.find(r => r.codigo === item.retencionCodigo) || CATALOGO_RETENCIONES_RENTA[0];
            const valRetCalculado = isFact ? parseFloat(((p.baseImponible * retSel.porcentaje) / 100).toFixed(2)) : 0;

            // Valores unificados libres de NaN
            const totalComprobante = isFact ? (p.total || 0) : isRet ? (p.totalRetenido || 0) : isNC ? (p.valorModificacion || 0) : 0;
            const ivaMonto = (isFact || isNC) ? (p.iva || 0) : 0;
            const subtotalMonto = parseFloat((totalComprobante - ivaMonto).toFixed(2));
            const netoAPagar = isFact ? parseFloat((totalComprobante - valRetCalculado).toFixed(2)) : totalComprobante;

            return (
              <tr key={idx} style={{
                borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                transition: 'background-color 0.2s ease',
                verticalAlign: 'top'
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.01)'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                {/* Estado */}
                <td style={{ padding: '16px', textAlign: 'center', verticalAlign: 'middle' }}>
                  {item.status === 'ready' && (
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(16, 185, 129, 0.15)',
                      color: '#10b981'
                    }} title="Listo">
                      <CheckCircle2 size={15} />
                    </span>
                  )}
                  {item.status === 'missing_entity' && (
                    <button
                      onClick={async () => {
                        try {
                          const { data, error } = await supabase
                            .from('entidades')
                            .insert({
                              ruc_cedula: p.rucEmisor,
                              razon_social: p.razonSocialEmisor,
                              nombre: p.razonSocialEmisor,
                              tipo_entidad: 'Proveedor',
                              persona_tipo: p.rucEmisor.length === 10 ? 'Natural' : 'Jurídica',
                              id_empresa: empresaId
                            })
                            .select()
                            .single();
                          if (data && !error) {
                            onChangeItem(idx, {
                              ...item,
                              entidadId: data.id,
                              status: 'ready'
                            });
                          }
                        } catch (err) {
                          console.error(err);
                        }
                      }}
                      className="btn"
                      style={{
                        fontSize: '9px',
                        fontWeight: 900,
                        padding: '4px 8px',
                        height: 'auto',
                        borderRadius: '8px',
                        backgroundColor: '#f59e0b',
                        color: '#0b0f19',
                        border: 'none',
                        cursor: 'pointer'
                      }}
                      title="Registrar proveedor"
                    >
                      Registrar
                    </button>
                  )}
                </td>

                {/* Documento */}
                <td style={{ padding: '16px', minWidth: '250px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', userSelect: 'none' }}>
                    <span style={{
                      fontSize: '8px',
                      fontWeight: 900,
                      color: badgeColor,
                      backgroundColor: `${badgeColor}20`,
                      padding: '2px 8px',
                      borderRadius: '12px'
                    }}>
                      {tc}
                    </span>
                    <span style={{ fontFamily: 'monospace', color: 'var(--text-sec)', fontSize: '10px', fontWeight: 'bold' }}>{p.numeroComprobante}</span>
                  </div>
                  <div style={{
                    fontWeight: 'bold',
                    color: '#ffffff',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontSize: '11px',
                    lineHeight: '1.2'
                  }} title={p.razonSocialEmisor}>
                    {p.razonSocialEmisor}
                  </div>
                  <div style={{ fontSize: '9px', color: 'var(--text-sec)', marginTop: '4px', fontWeight: 500 }}>RUC: {p.rucEmisor}</div>
                  <div style={{ 
                    fontSize: '8px', 
                    color: 'var(--text-sec)', 
                    marginTop: '4px', 
                    fontWeight: 500,
                    fontFamily: 'monospace',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    opacity: 0.8
                  }} title={`Autorización / Clave de Acceso:\n${p.claveAcceso}`}>
                    Aut: {p.claveAcceso}
                  </div>
                </td>

                {/* Total */}
                <td style={{ padding: '16px', textAlign: 'right', fontWeight: 900, color: '#ffffff', fontSize: '12px', minWidth: '90px' }}>
                  ${totalComprobante.toFixed(2)}
                </td>

                {/* Debe */}
                <td style={{ padding: '16px' }}>
                  <AccountSelector
                    value={item.idCuentaDebe}
                    onChange={(val) => {
                      onChangeItem(idx, { ...item, idCuentaDebe: val });
                    }}
                    accounts={accounts}
                    placeholder="Seleccionar Debe..."
                  />
                  <div style={{ fontSize: '9px', color: 'var(--text-sec)', marginTop: '6px', fontWeight: 'bold', padding: '0 6px' }}>
                    Importe: ${subtotalMonto.toFixed(2)}
                  </div>
                </td>

                {/* IVA y Bases */}
                <td style={{ padding: '16px' }}>
                  {ivaMonto > 0 && (
                    <div style={{ marginBottom: '8px' }}>
                      <AccountSelector
                        value={item.idCuentaIva}
                        onChange={(val) => {
                          onChangeItem(idx, { ...item, idCuentaIva: val });
                        }}
                        accounts={accounts}
                        placeholder="Seleccionar IVA..."
                      />
                    </div>
                  )}
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    padding: '8px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.05)'
                  }}>
                    {(p.base0 || 0) > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px' }}>
                        <span style={{ color: 'var(--text-sec)' }}>Sub. 0%:</span>
                        <span style={{ fontWeight: 'bold' }}>${(p.base0 || 0).toFixed(2)}</span>
                      </div>
                    )}
                    {(p.base5 || 0) > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '2px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px' }}>
                          <span style={{ color: 'var(--text-sec)' }}>Sub. 5%:</span>
                          <span style={{ fontWeight: 'bold' }}>${(p.base5 || 0).toFixed(2)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', color: '#10b981' }}>
                          <span>IVA 5%:</span>
                          <span>${((p.base5 || 0) * 0.05).toFixed(2)}</span>
                        </div>
                      </div>
                    )}
                    {(p.base12 || 0) > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '2px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px' }}>
                          <span style={{ color: 'var(--text-sec)' }}>Sub. 12%:</span>
                          <span style={{ fontWeight: 'bold' }}>${(p.base12 || 0).toFixed(2)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', color: 'var(--primary)' }}>
                          <span>IVA 12%:</span>
                          <span>${((p.base12 || 0) * 0.12).toFixed(2)}</span>
                        </div>
                      </div>
                    )}
                    {(p.base15 || 0) > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '2px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px' }}>
                          <span style={{ color: 'var(--text-sec)' }}>Sub. 15%:</span>
                          <span style={{ fontWeight: 'bold' }}>${(p.base15 || 0).toFixed(2)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', color: 'var(--primary)' }}>
                          <span>IVA 15%:</span>
                          <span>${((p.base15 || 0) * 0.15).toFixed(2)}</span>
                        </div>
                      </div>
                    )}
                    {(p.baseNoObjeto || 0) > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px' }}>
                        <span style={{ color: 'var(--text-sec)' }}>No Objeto:</span>
                        <span style={{ fontWeight: 'bold' }}>${(p.baseNoObjeto || 0).toFixed(2)}</span>
                      </div>
                    )}
                    {ivaMonto > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', fontWeight: '900', color: '#10b981', paddingTop: '4px', borderTop: '1px dashed rgba(255,255,255,0.1)' }}>
                        <span>IVA Total:</span>
                        <span>${ivaMonto.toFixed(2)}</span>
                      </div>
                    )}
                    {ivaMonto === 0 && (
                      <div style={{ fontSize: '8px', color: 'var(--text-sec)', fontStyle: 'italic', textAlign: 'center', opacity: 0.6 }}>
                        Sin IVA grabado
                      </div>
                    )}
                  </div>
                </td>

                {/* Haber */}
                <td style={{ padding: '16px' }}>
                  <AccountSelector
                    value={item.idCuentaHaber}
                    onChange={(val) => {
                      onChangeItem(idx, { ...item, idCuentaHaber: val });
                    }}
                    accounts={accounts}
                    placeholder="Seleccionar Haber..."
                  />
                  <div style={{ fontSize: '9px', color: 'var(--text-sec)', marginTop: '6px', fontWeight: 'bold', padding: '0 6px' }}>
                    Pago Neto: ${netoAPagar.toFixed(2)}
                  </div>
                </td>



                {/* Acción */}
                <td style={{ padding: '16px', textAlign: 'center', verticalAlign: 'middle' }}>
                  <button
                    onClick={() => onDeleteItem(idx)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-sec)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      padding: '6px',
                      borderRadius: '8px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                      e.currentTarget.style.color = 'var(--error)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = 'var(--text-sec)';
                    }}
                    title="Eliminar del lote"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
