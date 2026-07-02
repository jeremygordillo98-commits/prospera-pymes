import React, { useMemo, useState, useEffect, useRef } from 'react';
import { ArrowDownCircle, ArrowUpCircle, CheckCircle2, Download } from 'lucide-react';
import {
  exportCuentasExcel,
  exportCuentasPDF,
  exportHistorialExcel,
  exportHistorialPDF
} from '../utils/tesoreriaExport';

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-main)', outline: 'none'
};

interface TesoreriaCobrosPagosProps {
  empresaId: string;
  mode: 'cobros' | 'pagos';
  summary: any;
  docsFiltrados: any[];
  movForm: any;
  setMovForm: (val: any) => void;
  docForm: any;
  setDocForm: (val: any) => void;
  cuentas: any[];
  cuentasContables: any[];
  entities: any[];
  movimientos: any[];
  saving: boolean;
  handleRegistrarMovimiento: (e: React.FormEvent) => void;
  handleCrearDocumento: (e: React.FormEvent) => void;
  handleOpenEditModal: (mov: any) => void;
  handleAnularMovimientoTesoreria: (movId: string) => void;
}

export const TesoreriaCobrosPagos: React.FC<TesoreriaCobrosPagosProps> = ({
  empresaId,
  mode,
  summary,
  docsFiltrados,
  movForm,
  setMovForm,
  docForm,
  setDocForm,
  cuentas,
  cuentasContables,
  entities,
  movimientos,
  saving,
  handleRegistrarMovimiento,
  handleCrearDocumento,
  handleOpenEditModal,
  handleAnularMovimientoTesoreria
}) => {
  const decimals = parseInt(localStorage.getItem('pref_decimals') || '2', 10);
  const [searchAccount, setSearchAccount] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedAccountText = useMemo(() => {
    const selected = cuentasContables.find((c: any) => c.id === movForm.id_cuenta_banco_contable);
    return selected ? `${selected.codigo_cuenta} - ${selected.nombre}` : '';
  }, [cuentasContables, movForm.id_cuenta_banco_contable]);

  useEffect(() => {
    if (!isDropdownOpen) {
      setSearchAccount(selectedAccountText);
    }
  }, [selectedAccountText, isDropdownOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const filteredCuentasContables = useMemo(() => {
    const movementCuentas = cuentasContables.filter((c: any) => c.acepta_movimientos);
    if (!searchAccount || searchAccount === selectedAccountText) {
      return movementCuentas;
    }
    const query = searchAccount.toLowerCase();
    return movementCuentas.filter((c: any) =>
      c.codigo_cuenta?.toLowerCase().includes(query) ||
      c.nombre?.toLowerCase().includes(query)
    );
  }, [cuentasContables, searchAccount, selectedAccountText]);

  const cuentasContablesBancos = useMemo(() => {
    return cuentasContables.filter((c: any) => 
      c.acepta_movimientos && (
        c.codigo_cuenta?.startsWith('1.1.1') || 
        c.nombre?.toLowerCase().includes('banco') || 
        c.nombre?.toLowerCase().includes('caja') ||
        c.nombre?.toLowerCase().includes('fondo')
      )
    );
  }, [cuentasContables]);

  const isCobro = mode === 'cobros';
  const color = isCobro ? 'var(--success)' : 'var(--error)';

  const movimientosFiltrados = useMemo(() => {
    return movimientos.filter(m => m.tipo_movimiento === (isCobro ? 'Cobro' : 'Pago') && m.estado !== 'Anulado');
  }, [movimientos, isCobro]);

  const formatEcuadorianDate = (dateStr: string) => {
    if (!dateStr) return '—';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
    } catch {}
    return dateStr;
  };

  return (
    <div className="space-y-6" style={{ animation: 'fadeIn 0.5s ease' }}>
        <header className="flex-between" style={{ alignItems: 'flex-start' }}>
            <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--primary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.5, fontSize: '0.8rem', marginBottom: 8 }}>
                    {isCobro ? <ArrowDownCircle size={14} /> : <ArrowUpCircle size={14} />} 
                    Gestión de {isCobro ? 'Cobranzas' : 'Obligaciones'}
                </div>
                <h2 className="h1" style={{ fontSize: '2.2rem' }}>{isCobro ? 'Cuentas x Cobrar' : 'Cuentas x Pagar'}</h2>
                <p className="text-sec">Administra tus facturas y registra {isCobro ? 'recibos' : 'desembolsos'}.</p>
            </div>
            
            <div className="glass-card" style={{ padding: '16px 24px', textAlign: 'right', border: `1px solid ${color}33`, background: `${color}11` }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color, textTransform: 'uppercase' }}>Total {isCobro ? 'Por Cobrar' : 'Por Pagar'}</div>
                <div style={{ fontSize: '2rem', fontWeight: 900 }}>${isCobro ? summary.porCobrar.toFixed(decimals) : summary.porPagar.toFixed(decimals)}</div>
            </div>
        </header>

        <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)', gap: 24, alignItems: 'start' }}>
            {/* Lista de Documentos Pendientes */}
            <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: 20, borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '1.2rem' }}>{isCobro ? 'Facturas de Clientes' : 'Facturas de Proveedores'}</h3>
                        <p className="text-sec" style={{ fontSize: '0.85rem' }}>Documentos con saldos pendientes.</p>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                            className="btn" 
                            type="button"
                            onClick={() => exportCuentasPDF(empresaId, docsFiltrados, isCobro ? 'cobrar' : 'pagar')}
                            disabled={docsFiltrados.length === 0}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 800 }}
                            title="Exportar a PDF"
                        >
                            <Download size={14} /><span>PDF</span>
                        </button>
                        <button 
                            className="btn" 
                            type="button"
                            onClick={() => exportCuentasExcel(docsFiltrados, isCobro ? 'cobrar' : 'pagar')}
                            disabled={docsFiltrados.length === 0}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 800 }}
                            title="Exportar a Excel"
                        >
                            <Download size={14} /><span>Excel</span>
                        </button>
                    </div>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                    <thead><tr><th>Tercero</th><th>Referencia</th><th>Vence</th><th style={{ textAlign: 'right' }}>Saldo</th><th>Estado</th></tr></thead>
                    <tbody>
                        {docsFiltrados.map((doc) => (
                        <tr key={doc.id}>
                            <td style={{ padding: '14px 16px' }}>
                                <div style={{ fontWeight: 800 }}>{doc.entidades?.razon_social || 'Sin tercero'}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-sec)' }}>{doc.concepto}</div>
                            </td>
                            <td style={{ padding: '14px 16px', fontWeight: 600 }}>{doc.referencia}</td>
                            <td style={{ padding: '14px 16px', fontSize: '0.85rem' }}>
                                {doc.fecha_vencimiento}
                                {doc.fecha_vencimiento && new Date(doc.fecha_vencimiento) < new Date() && doc.saldo_pendiente > 0 && 
                                    <span style={{ color: 'var(--error)', marginLeft: 8, fontWeight: 800 }}>⚠️</span>}
                            </td>
                            <td style={{ padding: '14px 16px', fontWeight: 800, textAlign: 'right', color: doc.saldo_pendiente > 0 ? color : 'var(--text-main)' }}>
                                ${Number(doc.saldo_pendiente || 0).toFixed(decimals)}
                            </td>
                            <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                                <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', padding: '4px 8px', borderRadius: 999, background: doc.estado === 'Liquidado' ? 'rgba(16,185,129,0.1)' : 'var(--primary-light)', color: doc.estado === 'Liquidado' ? 'var(--success)' : 'var(--primary)', fontWeight: 800 }}>{doc.estado}</span>
                            </td>
                        </tr>
                        ))}
                        {docsFiltrados.length === 0 && <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: 'var(--text-sec)', fontWeight: 600 }}>No hay documentos pendientes aquí.</td></tr>}
                    </tbody>
                    </table>
                </div>
            </div>

            {/* Panel de Operaciones */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* 1. Registrar Operación */}
                <form className="glass-card" onSubmit={handleRegistrarMovimiento} style={{ border: `1px solid var(--primary)` }}>
                    <h3 style={{ margin: '0 0 16px', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <CheckCircle2 color="var(--primary)" /> {isCobro ? 'Aplicar Cobro' : 'Aplicar Pago'}
                    </h3>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div>
                            <label className="text-sec" style={{ fontSize: '0.75rem', fontWeight: 800 }}>Documento a saldar</label>
                            <select value={movForm.id_documento} onChange={e => {
                                const did = e.target.value;
                                const doc = docsFiltrados.find(d => d.id === did);
                                setMovForm({...movForm, id_documento: e.target.value, id_entidad: doc?.entidades?.id || movForm.id_entidad, monto: doc ? String(doc.saldo_pendiente) : movForm.monto});
                            }} style={inputStyle}>
                                <option value="">Selecciona (Factura/Deuda)</option>
                                {docsFiltrados.filter(d => d.saldo_pendiente > 0).map(doc => <option key={doc.id} value={doc.id}>{doc.entidades?.razon_social} - {doc.referencia} (${Number(doc.saldo_pendiente).toFixed(decimals)})</option>)}
                            </select>
                        </div>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <div>
                                <label className="text-sec" style={{ fontSize: '0.75rem', fontWeight: 800 }}>Monto a aplicar ($)</label>
                                <input value={movForm.monto} onChange={e => setMovForm({...movForm, monto: e.target.value})} style={{...inputStyle, fontWeight: 900, color}} required />
                            </div>
                            <div>
                                <label className="text-sec" style={{ fontSize: '0.75rem', fontWeight: 800 }}>Fecha</label>
                                <input type="date" value={movForm.fecha} onChange={e => setMovForm({...movForm, fecha: e.target.value})} style={inputStyle} required />
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                             <div>
                                <label className="text-sec" style={{ fontSize: '0.75rem', fontWeight: 800 }}>Caja / Banco de Tesorería (Opcional)</label>
                                <select value={movForm.id_cuenta_financiera} onChange={e => {
                                    const fid = e.target.value;
                                    const selectedFinCta = cuentas.find(c => c.id === fid);
                                    let matchedContableId = movForm.id_cuenta_banco_contable;
                                    if (selectedFinCta) {
                                        const match = cuentasContablesBancos.find((cc: any) => 
                                            cc.nombre.toLowerCase().includes(selectedFinCta.nombre.toLowerCase()) ||
                                            selectedFinCta.nombre.toLowerCase().includes(cc.nombre.toLowerCase())
                                        );
                                        if (match) {
                                            matchedContableId = match.id;
                                        }
                                    }
                                    setMovForm({
                                        ...movForm, 
                                        id_cuenta_financiera: fid,
                                        id_cuenta_banco_contable: matchedContableId
                                    });
                                }} style={inputStyle}>
                                    <option value="">No deducir de panel</option>
                                    {cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-sec" style={{ fontSize: '0.75rem', fontWeight: 800 }}>Cuenta Contable (Libro Diario)</label>
                                <div ref={dropdownRef} style={{ position: 'relative' }}>
                                    <input 
                                        value={searchAccount}
                                        onChange={e => {
                                            setSearchAccount(e.target.value);
                                            setIsDropdownOpen(true);
                                        }}
                                        onFocus={() => {
                                            setSearchAccount('');
                                            setIsDropdownOpen(true);
                                        }}
                                        placeholder="Buscar cuenta contable..."
                                        style={inputStyle}
                                        required={!movForm.id_cuenta_banco_contable}
                                    />
                                    <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', opacity: 0.6, fontSize: '0.8rem', color: 'var(--text-sec)' }}>
                                        ▼
                                    </span>
                                    
                                    {isDropdownOpen && (
                                        <div style={{ 
                                            position: 'absolute', 
                                            top: '100%', 
                                            left: 0, 
                                            right: 0, 
                                            maxHeight: '260px', 
                                            overflowY: 'auto', 
                                            background: '#0c101f', 
                                            border: '1px solid var(--border-color)', 
                                            borderRadius: '12px', 
                                            marginTop: '4px', 
                                            zIndex: 9999,
                                            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)'
                                        }}>
                                            {filteredCuentasContables.length === 0 ? (
                                                <div style={{ padding: '10px 12px', color: 'var(--text-sec)', fontSize: '0.85rem' }}>No se encontraron cuentas</div>
                                            ) : (
                                                filteredCuentasContables.map((c: any) => {
                                                    const isSelected = c.id === movForm.id_cuenta_banco_contable;
                                                    return (
                                                        <div 
                                                            key={c.id}
                                                            onClick={() => {
                                                                setMovForm({...movForm, id_cuenta_banco_contable: c.id});
                                                                setIsDropdownOpen(false);
                                                            }}
                                                            style={{ 
                                                                padding: '8px 12px', 
                                                                cursor: 'pointer', 
                                                                background: isSelected ? 'var(--primary-light)' : 'transparent',
                                                                color: isSelected ? 'var(--primary)' : 'var(--text-main)',
                                                                fontSize: '0.85rem',
                                                                borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
                                                                transition: 'background 0.2s',
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
                        <input value={movForm.referencia} onChange={e => setMovForm({...movForm, referencia: e.target.value})} placeholder="Referencia bancaria / Voucher..." style={inputStyle} />
                        
                        <button className="btn btn-primary" type="submit" disabled={saving || !movForm.monto || !movForm.id_cuenta_banco_contable} style={{ width: '100%', marginTop: 8 }}>
                            Confirmar Operación
                        </button>
                    </div>
                </form>

                {/* 2. Añadir Documento Manual */}
                <form className="glass-card" onSubmit={handleCrearDocumento}>
                    <h3 style={{ margin: '0 0 16px', fontSize: '1rem', color: 'var(--text-sec)' }}>Añadir Documento Manual</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <select value={docForm.id_entidad} onChange={e => setDocForm({...docForm, id_entidad: e.target.value})} style={inputStyle} required>
                            <option value="">Seleccionar Tercero...</option>
                            {entities.map(e => <option key={e.id} value={e.id}>{e.razon_social}</option>)}
                        </select>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                           <input value={docForm.referencia} onChange={e => setDocForm({...docForm, referencia: e.target.value})} placeholder="Nº Factura / Ref" style={inputStyle} required />
                           <input value={docForm.total} onChange={e => setDocForm({...docForm, total: e.target.value})} placeholder="Total $" style={inputStyle} required />
                        </div>
                        <input type="date" value={docForm.fecha_vencimiento} onChange={e => setDocForm({...docForm, fecha_vencimiento: e.target.value})} style={inputStyle} />
                        <button className="btn" type="submit" disabled={saving || !docForm.total || !docForm.id_entidad}>Registrar Deuda</button>
                    </div>
                </form>
            </div>
        </section>

        {/* Historial de Movimientos de Tesorería */}
        <div className="glass-card" style={{ padding: 0, overflow: 'hidden', marginTop: 24 }}>
          <div style={{ padding: 20, borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.2rem' }}>
                Historial de {isCobro ? 'Cobros' : 'Pagos'} Aplicados
              </h3>
              <p className="text-sec" style={{ fontSize: '0.85rem' }}>
                Últimas operaciones registradas. Puedes anular cualquier registro erróneo aquí.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                    className="btn" 
                    type="button"
                    onClick={() => exportHistorialPDF(empresaId, movimientosFiltrados, isCobro ? 'cobro' : 'pago')}
                    disabled={movimientosFiltrados.length === 0}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 800 }}
                    title="Exportar a PDF"
                >
                    <Download size={14} /><span>PDF</span>
                </button>
                <button 
                    className="btn" 
                    type="button"
                    onClick={() => exportHistorialExcel(movimientosFiltrados, isCobro ? 'cobro' : 'pago')}
                    disabled={movimientosFiltrados.length === 0}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 800 }}
                    title="Exportar a Excel"
                >
                    <Download size={14} /><span>Excel</span>
                </button>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ padding: '12px 16px' }}>{isCobro ? 'Fecha de Cobro' : 'Fecha de Pago'}</th>
                  <th style={{ padding: '12px 16px' }}>Tercero y Documento</th>
                  <th style={{ padding: '12px 16px' }}>Factura Original</th>
                  <th style={{ padding: '12px 16px' }}>Detalles del {isCobro ? 'Cobro' : 'Pago'}</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Monto Aplicado</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {movimientosFiltrados
                  .map(mov => {
                    const doc = mov.documento;
                    const ent = mov.entidades;
                    
                    return (
                      <tr key={mov.id}>
                        <td style={{ padding: '16px', fontSize: '0.88rem', fontWeight: 600 }}>
                          {formatEcuadorianDate(mov.fecha)}
                        </td>
                        
                        <td style={{ padding: '16px' }}>
                          <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-main)' }}>
                            {ent?.razon_social || 'N/A'}
                          </div>
                          <div style={{ marginTop: 4 }}>
                            {doc ? (
                              <span style={{ 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: 4, 
                                fontSize: '0.75rem', 
                                color: 'var(--primary)', 
                                backgroundColor: 'rgba(99, 102, 241, 0.1)', 
                                border: '1px solid rgba(99, 102, 241, 0.2)', 
                                padding: '2px 8px', 
                                borderRadius: 12,
                                fontFamily: 'monospace',
                                fontWeight: 700
                              }}>
                                Factura: #{doc.referencia}
                              </span>
                            ) : (
                              <span style={{ 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: 4, 
                                fontSize: '0.72rem', 
                                color: 'var(--text-sec)', 
                                backgroundColor: 'rgba(255,255,255,0.05)', 
                                padding: '2px 8px', 
                                borderRadius: 12,
                                fontStyle: 'italic'
                              }}>
                                Anticipo / Sin Factura
                              </span>
                            )}
                          </div>
                        </td>

                        <td style={{ padding: '16px', fontSize: '0.85rem' }}>
                          {doc ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                              <div>
                                <span style={{ color: 'var(--text-sec)' }}>Total Factura:</span>{' '}
                                <strong style={{ color: 'var(--text-main)' }}>
                                  ${Number(doc.total || 0).toFixed(decimals)}
                                </strong>
                              </div>
                              <div style={{ fontSize: '0.78rem', color: 'var(--text-sec)' }}>
                                Vencimiento: <span style={{ fontWeight: 600, color: '#f59e0b' }}>{formatEcuadorianDate(doc.fecha_vencimiento)}</span>
                              </div>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-sec)', fontStyle: 'italic' }}>—</span>
                          )}
                        </td>

                        <td style={{ padding: '16px', fontSize: '0.85rem' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <div>
                              <span style={{ color: 'var(--text-sec)' }}>Concepto:</span>{' '}
                              <span style={{ color: 'var(--text-main)', fontStyle: mov.concepto ? 'normal' : 'italic' }}>
                                {mov.concepto || '—'}
                              </span>
                            </div>
                            <div style={{ fontSize: '0.78rem' }}>
                              <span style={{ color: 'var(--text-sec)' }}>Ref. Pago / N° Documento:</span>{' '}
                              <strong style={{ fontFamily: 'monospace', color: 'var(--text-main)' }}>
                                {mov.referencia || '—'}
                              </strong>
                            </div>
                          </div>
                        </td>

                        <td style={{ padding: '16px', textAlign: 'right' }}>
                          <div style={{ 
                            fontWeight: 900, 
                            fontSize: '1.05rem', 
                            color: isCobro ? 'var(--success)' : 'var(--error)' 
                          }}>
                            {isCobro ? '+' : '-'}${Number(mov.monto).toFixed(decimals)}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-sec)', textTransform: 'uppercase', fontWeight: 700, marginTop: 2 }}>
                            {isCobro ? 'Monto Cobrado' : 'Monto Pagado'}
                          </div>
                        </td>

                        <td style={{ padding: '16px', textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', gap: 8 }}>
                            <button
                              className="btn"
                              style={{ 
                                padding: '8px 16px', 
                                background: 'rgba(59,130,246,0.1)', 
                                color: '#3b82f6', 
                                border: 'none', 
                                borderRadius: 10, 
                                cursor: 'pointer', 
                                fontWeight: 'bold', 
                                fontSize: '0.8rem',
                                transition: 'all 0.2s'
                              }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.2)'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.1)'; }}
                              onClick={() => handleOpenEditModal(mov)}
                              disabled={saving}
                            >
                              Editar
                            </button>
                            <button
                              className="btn"
                              style={{ 
                                padding: '8px 16px', 
                                background: 'rgba(239,68,68,0.1)', 
                                color: 'var(--error)', 
                                border: 'none', 
                                borderRadius: 10, 
                                cursor: 'pointer', 
                                fontWeight: 'bold', 
                                fontSize: '0.8rem',
                                transition: 'all 0.2s'
                              }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.2)'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }}
                              onClick={() => handleAnularMovimientoTesoreria(mov.id)}
                              disabled={saving}
                            >
                              Anular
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                {movimientosFiltrados.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: 32, textAlign: 'center', color: 'var(--text-sec)' }}>
                      Sin movimientos recientes de {isCobro ? 'cobro' : 'pago'} aplicados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
    </div>
  );
};
