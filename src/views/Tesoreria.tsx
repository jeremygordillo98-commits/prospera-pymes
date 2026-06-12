import React, { useMemo, useState } from 'react';
import { Wallet, Landmark, ArrowDownCircle, ArrowUpCircle, Repeat, Loader2, CheckCircle2 } from 'lucide-react';
import { supabase } from '../services/supabase';
import { useQuery, useQueryClient } from '@tanstack/react-query';

interface Props { empresaId: string; mode?: 'resumen' | 'cobros' | 'pagos' | 'conciliacion'; }

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-main)', outline: 'none'
};

const cardTitle: React.CSSProperties = { fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: 1.2, color: 'var(--text-sec)', fontWeight: 800 };

export const Tesoreria: React.FC<Props> = ({ empresaId, mode = 'resumen' }) => {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [showCuentaForm, setShowCuentaForm] = useState(false);

  const [cuentaForm, setCuentaForm] = useState({ nombre: '', tipo: 'Banco', saldo_inicial: '0', moneda: 'USD', numero_referencia: '' });
  const [movForm, setMovForm] = useState({
    fecha: new Date().toISOString().slice(0, 10),
    tipo_movimiento: mode === 'pagos' ? 'Pago' : 'Cobro',
    concepto: '', monto: '', id_cuenta_financiera: '', id_cuenta_banco_contable: '', id_entidad: '', id_documento: '', referencia: '', estado: 'Aplicado'
  });
  const [docForm, setDocForm] = useState({
    tipo_documento: mode === 'pagos' ? 'Cuenta por pagar' : 'Cuenta por cobrar',
    fecha_emision: new Date().toISOString().slice(0, 10), fecha_vencimiento: '', id_entidad: '', concepto: '', referencia: '', total: ''
  });

  const { data, isLoading: loading } = useQuery({
    queryKey: ['tesoreria', empresaId],
    queryFn: async () => {
      const [cuentasRes, docsRes, movRes, entRes, pcRes] = await Promise.all([
        supabase.from('cuentas_financieras').select('*').eq('id_empresa', empresaId).order('nombre'),
        supabase.from('tesoreria_documentos').select('id,fecha_emision,fecha_vencimiento,tipo_documento,referencia,concepto,saldo_pendiente,total,estado,entidades(id,razon_social)').eq('id_empresa', empresaId).order('fecha_emision', { ascending: false }),
        supabase.from('tesoreria_movimientos').select('id,fecha,tipo_movimiento,concepto,monto,estado,referencia,cuenta_financiera:cuentas_financieras(nombre),entidades(id,razon_social),documento:tesoreria_documentos(referencia,concepto)').eq('id_empresa', empresaId).order('fecha', { ascending: false }).limit(30),
        supabase.from('entidades').select('id,razon_social,tipo_entidad').eq('id_empresa', empresaId).order('razon_social'),
        supabase.from('plan_cuentas').select('id, codigo_cuenta, nombre').eq('id_empresa', empresaId).order('codigo_cuenta')
      ]);

      return {
        cuentas: cuentasRes.data || [],
        documentos: (docsRes.data || []).map((item: any) => ({ ...item, entidades: Array.isArray(item.entidades) ? item.entidades[0] : item.entidades })),
        movimientos: (movRes.data || []).map((item: any) => ({
          ...item,
          cuenta_financiera: Array.isArray(item.cuenta_financiera) ? item.cuenta_financiera[0] : item.cuenta_financiera,
          entidades: Array.isArray(item.entidades) ? item.entidades[0] : item.entidades,
          documento: Array.isArray(item.documento) ? item.documento[0] : item.documento,
        })),
        entities: entRes.data || [],
        cuentasContables: pcRes?.data || []
      };
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 mins
  });

  const cuentas = data?.cuentas || [];
  const documentos = data?.documentos || [];
  const movimientos = data?.movimientos || [];
  const entities = data?.entities || [];
  const cuentasContables = data?.cuentasContables || [];
  // Filtrar de las cuentas contables solo las que son de activo corriente (Bancos/Caja)
  const cuentasContablesBancos = cuentasContables.filter((c: any) => c.codigo_cuenta?.startsWith('1.1.1') || c.nombre?.toLowerCase().includes('banco') || c.nombre?.toLowerCase().includes('caja'));



  const summary = useMemo(() => {
    const saldoInicialCuentas = cuentas.reduce((acc, c) => acc + Number(c.saldo_inicial || 0), 0);
    const cobradoTotal = movimientos.filter(m => m.tipo_movimiento === 'Cobro' && m.estado !== 'Anulado').reduce((acc, m) => acc + Number(m.monto || 0), 0);
    const pagadoTotal = movimientos.filter(m => m.tipo_movimiento === 'Pago' && m.estado !== 'Anulado').reduce((acc, m) => acc + Number(m.monto || 0), 0);
    const disponible = saldoInicialCuentas + cobradoTotal - pagadoTotal;

    const porCobrar = documentos.filter((d) => d.tipo_documento === 'Cuenta por cobrar').reduce((acc, d) => acc + Number(d.saldo_pendiente || 0), 0);
    const porPagar = documentos.filter((d) => d.tipo_documento === 'Cuenta por pagar').reduce((acc, d) => acc + Number(d.saldo_pendiente || 0), 0);
    const thisMonth = new Date().toISOString().slice(0, 7);
    const cobradoMes = movimientos.filter((m) => m.tipo_movimiento === 'Cobro' && (m.fecha || '').startsWith(thisMonth)).reduce((acc, m) => acc + Number(m.monto || 0), 0);
    const pagadoMes = movimientos.filter((m) => m.tipo_movimiento === 'Pago' && (m.fecha || '').startsWith(thisMonth)).reduce((acc, m) => acc + Number(m.monto || 0), 0);
    return { disponible, porCobrar, porPagar, cobradoMes, pagadoMes, proyectado: disponible + porCobrar - porPagar };
  }, [cuentas, documentos, movimientos]);

  const docsFiltrados = useMemo(() => {
    // Nunca mostrar documentos anulados en las vistas de cobros/pagos
    const activos = documentos.filter((d) => d.estado !== 'Anulado');
    if (mode === 'cobros') return activos.filter((d) => d.tipo_documento === 'Cuenta por cobrar');
    if (mode === 'pagos') return activos.filter((d) => d.tipo_documento === 'Cuenta por pagar');
    return activos;
  }, [documentos, mode]);

  const handleCrearCuenta = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const { error } = await supabase.from('cuentas_financieras').insert({
        id_empresa: empresaId,
        nombre: cuentaForm.nombre,
        tipo: cuentaForm.tipo,
        saldo_inicial: parseFloat(cuentaForm.saldo_inicial) || 0,
        moneda: cuentaForm.moneda,
        numero_referencia: cuentaForm.numero_referencia || null,
      });
      if (error) throw error;
      setCuentaForm({ nombre: '', tipo: 'Banco', saldo_inicial: '0', moneda: 'USD', numero_referencia: '' });
      setShowCuentaForm(false);
      setMessage('Cuenta financiera registrada.');
      await queryClient.invalidateQueries({ queryKey: ['tesoreria', empresaId] });
    } catch (error: any) {
      setMessage(error.message || 'No se pudo crear la cuenta financiera.');
    } finally { setSaving(false); }
  };

  const handleCrearDocumento = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const total = parseFloat(docForm.total) || 0;
      const { error } = await supabase.from('tesoreria_documentos').insert({
        id_empresa: empresaId,
        id_entidad: docForm.id_entidad || null,
        tipo_documento: docForm.tipo_documento,
        fecha_emision: docForm.fecha_emision,
        fecha_vencimiento: docForm.fecha_vencimiento || null,
        concepto: docForm.concepto,
        referencia: docForm.referencia || null,
        total,
        saldo_pendiente: total,
        estado: 'Pendiente',
        origen: 'Manual'
      });
      if (error) throw error;
      setDocForm({ tipo_documento: mode === 'pagos' ? 'Cuenta por pagar' : 'Cuenta por cobrar', fecha_emision: new Date().toISOString().slice(0, 10), fecha_vencimiento: '', id_entidad: '', concepto: '', referencia: '', total: '' });
      setMessage('Documento de tesorería registrado.');
      await queryClient.invalidateQueries({ queryKey: ['tesoreria', empresaId] });
    } catch (error: any) {
      setMessage(error.message || 'No se pudo crear el documento.');
    } finally { setSaving(false); }
  };

  const handleRegistrarMovimiento = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const monto = parseFloat(movForm.monto) || 0;
      const { data: mov, error } = await supabase.from('tesoreria_movimientos').insert({
        id_empresa: empresaId,
        fecha: movForm.fecha,
        tipo_movimiento: movForm.tipo_movimiento,
        concepto: movForm.concepto,
        monto,
        id_cuenta_financiera: movForm.id_cuenta_financiera || null,
        id_entidad: movForm.id_entidad || null,
        id_documento: movForm.id_documento || null,
        referencia: movForm.referencia || null,
        estado: movForm.estado,
        origen: 'Manual'
      }).select('id_documento').single();
      if (error) throw error;

      if (mov?.id_documento) {
        const target = documentos.find((d) => d.id === mov.id_documento);
        if (target) {
          const nuevoSaldo = Math.max(0, Number(target.saldo_pendiente || 0) - monto);
          const estado = nuevoSaldo === 0 ? 'Liquidado' : 'Parcial';
          await supabase.from('tesoreria_documentos').update({ saldo_pendiente: nuevoSaldo, estado }).eq('id', target.id);
        }
      }

      // AUTOMATIZACIÓN DE ASIENTO CONTABLE
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: qCuentas } = await supabase.from('plan_cuentas').select('id, codigo_cuenta, nombre').eq('id_empresa', empresaId);
        if (qCuentas) {
          const ctasBancos = qCuentas.filter(c => c.codigo_cuenta.startsWith('1.1.1') || c.nombre.toLowerCase().includes('banco') || c.nombre.toLowerCase().includes('caja'));
          const ctasCobrar = qCuentas.filter(c => c.codigo_cuenta.startsWith('1.1.2') || c.nombre.toLowerCase().includes('cobrar') || c.nombre.toLowerCase().includes('cliente'));
          const ctasPagar = qCuentas.filter(c => c.codigo_cuenta.startsWith('2.1.1') || c.nombre.toLowerCase().includes('pagar') || c.nombre.toLowerCase().includes('proveedor'));

          const bancoId = movForm.id_cuenta_banco_contable || ctasBancos[0]?.id;
          const cxcId = ctasCobrar[0]?.id;
          const cxpId = ctasPagar[0]?.id;

          if (bancoId && ((movForm.tipo_movimiento === 'Cobro' && cxcId) || (movForm.tipo_movimiento === 'Pago' && cxpId))) {
            const { data: transaccion } = await supabase.from('transacciones').insert({
              id_empresa: empresaId,
              id_usuario: user.id,
              fecha: movForm.fecha,
              concepto: movForm.concepto || `${movForm.tipo_movimiento} de Tesorería`,
              tipo_comprobante: movForm.tipo_movimiento === 'Cobro' ? 'Ingreso' : 'Egreso',
              numero_comprobante: movForm.referencia || `TES-${Date.now().toString().slice(-6)}`,
              id_entidad: movForm.id_entidad || null
            }).select('id').single();

            if (transaccion) {
              const payloadMovimientos = [];
              if (movForm.tipo_movimiento === 'Cobro') {
                payloadMovimientos.push({ id_transaccion: transaccion.id, id_cuenta: bancoId, debe: monto, haber: 0 });
                payloadMovimientos.push({ id_transaccion: transaccion.id, id_cuenta: cxcId, debe: 0, haber: monto });
              } else {
                payloadMovimientos.push({ id_transaccion: transaccion.id, id_cuenta: cxpId, debe: monto, haber: 0 });
                payloadMovimientos.push({ id_transaccion: transaccion.id, id_cuenta: bancoId, debe: 0, haber: monto });
              }
              await supabase.from('movimientos').insert(payloadMovimientos);
            }
          }
        }
      }

      setMovForm({ fecha: new Date().toISOString().slice(0, 10), tipo_movimiento: mode === 'pagos' ? 'Pago' : 'Cobro', concepto: '', monto: '', id_cuenta_financiera: '', id_cuenta_banco_contable: '', id_entidad: '', id_documento: '', referencia: '', estado: 'Aplicado' });
      setMessage('Movimiento registrado contable y financieramente.');
      await queryClient.invalidateQueries({ queryKey: ['tesoreria', empresaId] });
    } catch (error: any) {
      setMessage(error.message || 'No se pudo registrar el movimiento.');
    } finally { setSaving(false); }
  };

  // --- RENDERIZADO POR MODOS ---

  const renderResumen = () => (
    <div className="space-y-6" style={{ animation: 'fadeIn 0.5s ease' }}>
      <header>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--primary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.5, fontSize: '0.8rem', marginBottom: 8 }}>
            <Landmark size={14} /> Panorama Financiero
        </div>
        <h2 className="h1" style={{ fontSize: '2.2rem' }}>Centro de Mando de Tesorería</h2>
        <p className="text-sec">Visión general del efectivo, obligaciones y liquidez de la empresa.</p>
      </header>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 16 }}>
        {[
          { label: 'Efectivo Disponible', value: summary.disponible, icon: Wallet },
          { label: 'Cuentas por Cobrar', value: summary.porCobrar, icon: ArrowDownCircle },
          { label: 'Cuentas por Pagar', value: summary.porPagar, icon: ArrowUpCircle },
          { label: 'Liquidez Proyectada', value: summary.proyectado, icon: Repeat },
        ].map((item) => (
          <div key={item.label} className="glass-card" style={{ padding: 20 }}>
            <div className="flex-between">
              <div>
                <div style={cardTitle}>{item.label}</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 900, marginTop: 8, color: item.value < 0 ? 'var(--error)' : 'var(--text-main)' }}>${item.value.toFixed(2)}</div>
              </div>
              <div style={{ width: 48, height: 48, borderRadius: 16, background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <item.icon size={24} />
              </div>
            </div>
          </div>
        ))}
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 24 }}>
          {/* Cuentas Financieras Totales */}
          <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: 20, borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Cuentas Registradas</h3>
              <button 
                  style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 800, cursor: 'pointer', fontSize: '0.85rem' }}
                  onClick={() => setShowCuentaForm(v => !v)}
              >
                  + Nueva
              </button>
            </div>
            
            {showCuentaForm && (
                <form onSubmit={handleCrearCuenta} style={{ padding: 20, background: 'var(--primary-light)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <input value={cuentaForm.nombre} onChange={e => setCuentaForm({...cuentaForm, nombre: e.target.value})} style={inputStyle} placeholder="Nombre (Ej. Banco Pichincha, Caja)" required />
                        <select value={cuentaForm.tipo} onChange={e => setCuentaForm({...cuentaForm, tipo: e.target.value})} style={inputStyle}>
                            <option>Banco</option><option>Caja</option>
                        </select>
                        <input value={cuentaForm.saldo_inicial} onChange={e => setCuentaForm({...cuentaForm, saldo_inicial: e.target.value})} style={inputStyle} placeholder="Saldo Inicial" required />
                        <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Guardar</button>
                    </div>
                </form>
            )}

            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
                {cuentas.map(c => (
                    <div key={c.id} className="flex-between" style={{ paddingBottom: 12, borderBottom: '1px dashed var(--border-color)' }}>
                        <div>
                            <div style={{ fontWeight: 800 }}>{c.nombre}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-sec)' }}>{c.tipo}</div>
                        </div>
                        <div style={{ fontWeight: 900, fontSize: '1.1rem' }}>${Number(c.saldo_inicial).toFixed(2)}</div>
                    </div>
                ))}
            </div>
          </div>

          {/* Últimos Movimientos Generales */}
          <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="flex-between" style={{ padding: 20, borderBottom: '1px solid var(--border-color)' }}>
              <div>
                <h3 style={{ margin: 0 }}>Flujo de Caja Reciente</h3>
                <p className="text-sec" style={{ margin: '6px 0 0' }}>Últimas entradas y salidas de dinero.</p>
              </div>
              <div style={{ fontWeight: 800, fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--success)', marginRight: 16 }}>Entró: ${summary.cobradoMes.toFixed(2)}</span>
                  <span style={{ color: 'var(--warning)' }}>Salió: ${summary.pagadoMes.toFixed(2)}</span>
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead><tr><th>Fecha</th><th>Tercero</th><th>Concepto</th><th>Importe</th></tr></thead>
                <tbody>
                  {movimientos.slice(0, 8).map((mov) => (
                    <tr key={mov.id}>
                      <td style={{ padding: '12px 16px', fontSize: '0.85rem' }}>{mov.fecha}</td>
                      <td style={{ padding: '12px 16px', fontWeight: 600 }}>{mov.entidades?.razon_social || 'N/A'}</td>
                      <td style={{ padding: '12px 16px' }}>{mov.concepto}</td>
                      <td style={{ padding: '12px 16px', fontWeight: 800, color: mov.tipo_movimiento === 'Cobro' ? 'var(--success)' : 'var(--text-main)', textAlign: 'right' }}>
                          {mov.tipo_movimiento === 'Cobro' ? '+' : '-'}${Number(mov.monto).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                  {movimientos.length === 0 && <tr><td colSpan={4} style={{ padding: 28, textAlign: 'center', color: 'var(--text-sec)' }}>Sin movimientos.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
      </div>
    </div>
  );

  const renderCobrosPagos = () => {
    const isCobro = mode === 'cobros';
    const color = isCobro ? 'var(--success)' : 'var(--error)';
    
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
                <div style={{ fontSize: '2rem', fontWeight: 900 }}>${isCobro ? summary.porCobrar.toFixed(2) : summary.porPagar.toFixed(2)}</div>
            </div>
        </header>

        <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)', gap: 24, alignItems: 'start' }}>
            {/* Lista de Documentos Pendientes */}
            <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: 20, borderBottom: '1px solid var(--border-color)' }}>
                    <h3 style={{ margin: 0, fontSize: '1.2rem' }}>{isCobro ? 'Facturas de Clientes' : 'Facturas de Proveedores'}</h3>
                    <p className="text-sec" style={{ fontSize: '0.85rem' }}>Documentos con saldos pendientes.</p>
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
                                ${Number(doc.saldo_pendiente || 0).toFixed(2)}
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

            {/* Panel de Operaciones (Añadir Documento o Registrar Pago) */}
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
                                {docsFiltrados.filter(d => d.saldo_pendiente > 0).map(doc => <option key={doc.id} value={doc.id}>{doc.entidades?.razon_social} - {doc.referencia} (${Number(doc.saldo_pendiente).toFixed(2)})</option>)}
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
                                <select value={movForm.id_cuenta_financiera} onChange={e => setMovForm({...movForm, id_cuenta_financiera: e.target.value})} style={inputStyle}>
                                    <option value="">No deducir de panel</option>
                                    {cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-sec" style={{ fontSize: '0.75rem', fontWeight: 800 }}>Cuenta Contable (Libro Diario)</label>
                                <select value={movForm.id_cuenta_banco_contable} onChange={e => setMovForm({...movForm, id_cuenta_banco_contable: e.target.value})} style={inputStyle} required>
                                    <option value="">Selecciona Banco Contable</option>
                                    {cuentasContablesBancos.map((c: any) => <option key={c.id} value={c.id}>{c.codigo_cuenta} - {c.nombre}</option>)}
                                </select>
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
    </div>
    );
  };

  const renderConciliacion = () => (
      <div className="space-y-6" style={{ animation: 'fadeIn 0.5s ease' }}>
        <header>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--primary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.5, fontSize: '0.8rem', marginBottom: 8 }}>
                <CheckCircle2 size={14} /> Auditoría
            </div>
            <h2 className="h1" style={{ fontSize: '2.2rem' }}>Conciliación Bancaria</h2>
            <p className="text-sec">Verifica que los saldos del sistema coincidan con tu estado de cuenta real.</p>
        </header>

        <section style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 24, alignItems: 'start' }}>
            {/* Lista Bancos */}
            <div className="glass-card" style={{ padding: 0 }}>
                <div style={{ padding: 20, borderBottom: '1px solid var(--border-color)', background: 'var(--primary-light)' }}>
                    <h3 style={{ margin: 0, color: 'var(--primary)' }}>Saldos Contables</h3>
                    <div style={{ fontSize: '0.75rem', marginTop: 4, color: 'var(--text-main)' }}>Valores calculados por el sistema</div>
                </div>
                <div>
                   {cuentas.map(c => {
                       const c_movs = movimientos.filter(m => m.cuenta_financiera?.nombre === c.nombre);
                       const ingresos = c_movs.filter(m => m.tipo_movimiento === 'Cobro').reduce((a, b) => a + Number(b.monto), 0);
                       const egresos = c_movs.filter(m => m.tipo_movimiento === 'Pago').reduce((a, b) => a + Number(b.monto), 0);
                       const saldoFinal = Number(c.saldo_inicial) + ingresos - egresos;

                       return (
                       <div key={c.id} style={{ padding: 20, borderBottom: '1px solid var(--border-color)' }}>
                           <div style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: 12 }}>{c.nombre}</div>
                           <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 6 }}>
                               <span className="text-sec">Inicial:</span> <span>${Number(c.saldo_inicial).toFixed(2)}</span>
                           </div>
                           <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 6, color: 'var(--success)' }}>
                               <span>Ingresos:</span> <span>+${ingresos.toFixed(2)}</span>
                           </div>
                           <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 12, color: 'var(--error)' }}>
                               <span>Egresos:</span> <span>-${egresos.toFixed(2)}</span>
                           </div>
                           <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem', fontWeight: 900, paddingTop: 12, borderTop: '1px dashed var(--border-color)' }}>
                               <span>Calculado:</span> <span>${saldoFinal.toFixed(2)}</span>
                           </div>
                       </div>
                       );
                   })}
                </div>
            </div>

            {/* Libro Auxiliar de Bancos */}
            <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: 20, borderBottom: '1px solid var(--border-color)' }}>
                    <h3 style={{ margin: 0 }}>Libro Auxiliar de Bancos</h3>
                    <p className="text-sec" style={{ margin: '6px 0 0' }}>Historial detallado para cotejar (Cartola).</p>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                        <thead><tr><th>Fecha / Ref</th><th>Cuenta</th><th>Concepto / Proveedor</th><th style={{ textAlign: 'right' }}>Cobros</th><th style={{ textAlign: 'right' }}>Pagos</th></tr></thead>
                        <tbody>
                            {movimientos.map(mov => (
                                <tr key={mov.id}>
                                    <td style={{ padding: '12px 16px' }}>
                                        <div style={{ fontWeight: 800 }}>{mov.fecha}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-sec)' }}>{mov.referencia || 'S/N'}</div>
                                    </td>
                                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>{mov.cuenta_financiera?.nombre}</td>
                                    <td style={{ padding: '12px 16px' }}>
                                        <div>{mov.concepto}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-sec)' }}>{mov.entidades?.razon_social}</div>
                                    </td>
                                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: 'var(--success)' }}>
                                        {mov.tipo_movimiento === 'Cobro' ? `$${Number(mov.monto).toFixed(2)}` : ''}
                                    </td>
                                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: 'var(--error)' }}>
                                        {mov.tipo_movimiento === 'Pago' ? `$${Number(mov.monto).toFixed(2)}` : ''}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
      </div>
  );

  if (loading) return <div style={{ padding: '120px 0', width: '100%', display: 'flex', justifyContent: 'center' }}><Loader2 className="animate-spin" size={36} style={{ color: 'var(--primary)' }} /></div>;

  return (
      <div className="tesoreria-module">
          {message && <div style={{ background: 'var(--primary)', color: '#000', padding: 12, borderRadius: 12, fontWeight: 800, marginBottom: 20, animation: 'fadeIn 0.3s ease' }}>INFO: {message}</div>}
          
          {mode === 'resumen' && renderResumen()}
          {(mode === 'cobros' || mode === 'pagos') && renderCobrosPagos()}
          {mode === 'conciliacion' && renderConciliacion()}
      </div>
  );
};
