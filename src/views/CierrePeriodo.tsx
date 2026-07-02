import React, { useEffect, useState } from 'react';
import { Calendar, CheckCircle2, AlertTriangle, Play, RefreshCw, Loader2 } from 'lucide-react';
import { supabase } from '../services/supabase';
import { CierreService } from '../services/cierreService';
import type { SaldoCuentaCierre } from '../services/cierreService';
import { motion } from 'framer-motion';

interface Props {
  empresaId: string;
}

interface AccountOption {
  id: string;
  codigo_cuenta: string;
  nombre: string;
}

const selectStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: 10,
  border: '1px solid var(--border-color)',
  background: 'var(--input-bg)',
  color: 'var(--text-main)',
  outline: 'none',
  fontSize: '0.9rem',
  marginTop: 6
};

export const CierrePeriodo: React.FC<Props> = ({ empresaId }) => {
  const [loading, setLoading] = useState(true);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const [anio, setAnio] = useState<number>(() => new Date().getFullYear());
  const [aniosDisponibles, setAniosDisponibles] = useState<number[]>([]);
  const [fechaBloqueoActual, setFechaBloqueoActual] = useState<string | null>(null);

  // Mapeo de cuentas
  const [patrimonioAccounts, setPatrimonioAccounts] = useState<AccountOption[]>([]);
  const [cuentaResultadoId, setCuentaResultadoId] = useState('');
  const [cuentaUtilidadAcumId, setCuentaUtilidadAcumId] = useState('');
  const [cuentaPerdidaAcumId, setCuentaPerdidaAcumId] = useState('');

  // Vista preliminar del cierre
  const [previewData, setPreviewData] = useState<{
    saldos: SaldoCuentaCierre[];
    ingresos: number;
    gastos: number;
    resultado: number;
  } | null>(null);

  const loadBaseConfig = async () => {
    setLoading(true);
    setMessage(null);
    try {
      // 1. Obtener la fecha de bloqueo actual de la empresa
      const { data: emp, error: empErr } = await supabase
        .from('empresas_gestionadas')
        .select('fecha_bloqueo')
        .eq('id', empresaId)
        .single();
      if (empErr) throw empErr;
      setFechaBloqueoActual(emp?.fecha_bloqueo || null);

      // 2. Cargar todas las cuentas del Patrimonio que aceptan movimientos
      const { data: accounts, error: accErr } = await supabase
        .from('plan_cuentas')
        .select('id, codigo_cuenta, nombre')
        .eq('id_empresa', empresaId)
        .eq('tipo', 'Patrimonio')
        .eq('acepta_movimientos', true)
        .order('codigo_cuenta');
      if (accErr) throw accErr;

      const accOptions = accounts || [];
      setPatrimonioAccounts(accOptions);

      // Preselección por códigos estándar:
      // Cuenta Resultado del Ejercicio: 3.1.7.1
      const resAcc = accOptions.find(a => a.codigo_cuenta === '3.1.7.1');
      if (resAcc) setCuentaResultadoId(resAcc.id);
      else if (accOptions.length > 0) setCuentaResultadoId(accOptions[0].id);

      // Cuenta Utilidad Acumulada: 3.1.6.1.1.1
      const utilAcc = accOptions.find(a => a.codigo_cuenta === '3.1.6.1.1.1');
      if (utilAcc) setCuentaUtilidadAcumId(utilAcc.id);
      else if (accOptions.length > 0) setCuentaUtilidadAcumId(accOptions[0].id);

      // Cuenta Pérdida Acumulada: 3.1.6.1.2.1
      const perdAcc = accOptions.find(a => a.codigo_cuenta === '3.1.6.1.2.1');
      if (perdAcc) setCuentaPerdidaAcumId(perdAcc.id);
      else if (accOptions.length > 0) setCuentaPerdidaAcumId(accOptions[0].id);

      // 3. Definir años disponibles para cerrar (los últimos 3 años y el actual)
      const curYear = new Date().getFullYear();
      setAniosDisponibles([curYear - 2, curYear - 1, curYear, curYear + 1]);
      setAnio(curYear - 1); // Predeterminar el año anterior
    } catch (err: any) {
      console.error(err);
      setMessage({ type: 'error', text: err.message || 'No se pudo cargar la configuración de cierres.' });
    } finally {
      setLoading(false);
    }
  };

  const loadPreview = async () => {
    if (!empresaId || !anio) return;
    setLoadingPreview(true);
    setMessage(null);
    try {
      const data = await CierreService.obtenerSaldosResultados(empresaId, anio);
      setPreviewData(data);
    } catch (err: any) {
      console.error(err);
      setMessage({ type: 'error', text: `Error al calcular saldos: ${err.message}` });
      setPreviewData(null);
    } finally {
      setLoadingPreview(false);
    }
  };

  useEffect(() => {
    if (empresaId) {
      loadBaseConfig();
    }
  }, [empresaId]);

  useEffect(() => {
    if (empresaId && anio) {
      loadPreview();
    }
  }, [anio, empresaId]);

  const handleCerrarAño = async () => {
    if (!previewData) return;
    if (!cuentaResultadoId) {
      return setMessage({ type: 'error', text: 'Debes seleccionar la cuenta para registrar el Resultado del Ejercicio.' });
    }

    setSaving(true);
    setMessage(null);
    try {
      await CierreService.cerrarPeriodo(empresaId, anio, previewData.saldos, previewData.resultado, {
        resultadoEjercicioId: cuentaResultadoId,
        utilidadAcumuladaId: cuentaUtilidadAcumId || undefined,
        perdidaAcumuladaId: cuentaPerdidaAcumId || undefined
      });

      setMessage({ type: 'success', text: `¡Cierre del ejercicio ${anio} realizado con éxito! Todas las cuentas de ingresos y gastos han sido enceradas y el período contable está bloqueado.` });
      
      // Recargar datos
      await loadBaseConfig();
      await loadPreview();
    } catch (err: any) {
      console.error(err);
      setMessage({ type: 'error', text: err.message || 'No se pudo completar el cierre.' });
    } finally {
      setSaving(false);
    }
  };

  const handleReabrirAño = async () => {
    if (!window.confirm(`¿Estás completamente seguro de reabrir el período ${anio}? Esto eliminará los asientos de cierre automáticos y desbloqueará las transacciones anteriores.`)) {
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      await CierreService.reabrirPeriodo(empresaId, anio);
      setMessage({ type: 'success', text: `El período ${anio} ha sido reabierto con éxito. Los asientos de cierre han sido eliminados.` });
      
      // Recargar datos
      await loadBaseConfig();
      await loadPreview();
    } catch (err: any) {
      console.error(err);
      setMessage({ type: 'error', text: err.message || 'No se pudo reabrir el período.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-center" style={{ padding: '100px 0' }}>
        <Loader2 className="animate-spin" size={36} style={{ color: 'var(--primary)' }} />
      </div>
    );
  }

  const decimals = parseInt(localStorage.getItem('pref_decimals') || '2', 10);
  const esPeriodoCerrado = !!(fechaBloqueoActual && new Date(fechaBloqueoActual).getFullYear() >= anio);

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 900, margin: '20px auto' }}>
      <header>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--primary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.5, fontSize: '0.8rem', marginBottom: 8 }}>
          <Calendar size={14} /> Contabilidad Operativa
        </div>
        <h1 className="h1" style={{ fontSize: '2.2rem' }}>Cierre de Ejercicio</h1>
        <p className="text-sec">Ejecuta el cierre del año contable, encera las cuentas de ingresos y gastos, y traslada el resultado neto al Patrimonio.</p>
      </header>

      {message && (
        <div style={{
          padding: '14px 20px', borderRadius: 12, fontSize: '0.9rem', fontWeight: 600,
          background: message.type === 'success' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.1)',
          color: message.type === 'success' ? 'var(--success)' : 'var(--error)',
          border: `1px solid ${message.type === 'success' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`
        }}>
          {message.text}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20 }}>
        
        {/* PANEL DE CONTROL DE PARÁMETROS */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>1. Configurar Cierre</h3>
          
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-sec)', fontWeight: 700, textTransform: 'uppercase' }}>Ejercicio Fiscal a Cerrar</label>
            <select value={anio} onChange={e => setAnio(Number(e.target.value))} style={selectStyle} disabled={saving}>
              {aniosDisponibles.map(y => (
                <option key={y} value={y}>Año {y}</option>
              ))}
            </select>
          </div>

          <div style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-sec)' }}>Estado de Bloqueo Contable</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800 }}>
              {esPeriodoCerrado ? (
                <>
                  <CheckCircle2 size={16} style={{ color: 'var(--success)' }} />
                  <span style={{ color: 'var(--success)' }}>CERRADO Y BLOQUEADO</span>
                </>
              ) : (
                <>
                  <AlertTriangle size={16} style={{ color: 'var(--warning)' }} />
                  <span style={{ color: 'var(--warning)' }}>ABIERTO / MODIFICABLE</span>
                </>
              )}
            </div>
            {fechaBloqueoActual && (
              <span style={{ fontSize: '0.78rem', color: 'var(--text-sec)', marginTop: 4 }}>
                Último cierre guardado hasta la fecha: <strong>{new Date(fechaBloqueoActual + 'T12:00:00').toLocaleDateString()}</strong>
              </span>
            )}
          </div>

          {/* MAPEO DE CUENTAS */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, borderTop: '1px solid var(--border-color)', paddingTop: 16 }}>
            <span style={{ fontWeight: 800, fontSize: '0.9rem' }}>Mapeo de Cuentas Patrimoniales</span>
            
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-sec)' }}>Resultado del Ejercicio (3.1.7.1)</label>
              <select value={cuentaResultadoId} onChange={e => setCuentaResultadoId(e.target.value)} style={selectStyle} disabled={saving || esPeriodoCerrado}>
                <option value="">-- Seleccionar cuenta --</option>
                {patrimonioAccounts.map(a => (
                  <option key={a.id} value={a.id}>{a.codigo_cuenta} · {a.nombre}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-sec)' }}>Utilidades Acumuladas Años Anteriores (3.1.6.1.1.1)</label>
              <select value={cuentaUtilidadAcumId} onChange={e => setCuentaUtilidadAcumId(e.target.value)} style={selectStyle} disabled={saving || esPeriodoCerrado}>
                <option value="">-- Seleccionar cuenta --</option>
                {patrimonioAccounts.map(a => (
                  <option key={a.id} value={a.id}>{a.codigo_cuenta} · {a.nombre}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-sec)' }}>Pérdidas Acumuladas Años Anteriores (3.1.6.1.2.1)</label>
              <select value={cuentaPerdidaAcumId} onChange={e => setCuentaPerdidaAcumId(e.target.value)} style={selectStyle} disabled={saving || esPeriodoCerrado}>
                <option value="">-- Seleccionar cuenta --</option>
                {patrimonioAccounts.map(a => (
                  <option key={a.id} value={a.id}>{a.codigo_cuenta} · {a.nombre}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* PANEL DE VISTA PREVIA Y ACCIONES */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 400 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, marginBottom: 16 }}>2. Vista Preliminar ({anio})</h3>
            
            {loadingPreview ? (
              <div className="flex-center" style={{ padding: '60px 0' }}><Loader2 className="animate-spin" size={24} style={{ color: 'var(--primary)' }} /></div>
            ) : previewData ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 10, borderBottom: '1px solid var(--border-color)' }}>
                  <span style={{ color: 'var(--text-sec)' }}>Total Ingresos del Año</span>
                  <strong>${previewData.ingresos.toFixed(decimals)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 10, borderBottom: '1px solid var(--border-color)' }}>
                  <span style={{ color: 'var(--text-sec)' }}>Total Gastos y Costos</span>
                  <strong>${previewData.gastos.toFixed(decimals)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 10, borderBottom: '2px solid var(--border-color)' }}>
                  <span style={{ color: 'var(--text-sec)' }}>Número de Cuentas a Encerrar</span>
                  <strong>{previewData.saldos.length} cuentas</strong>
                </div>
                <div style={{ 
                  display: 'flex', justifyContent: 'space-between', padding: '12px 16px', borderRadius: 10,
                  background: previewData.resultado >= 0 ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)',
                  color: previewData.resultado >= 0 ? 'var(--success)' : 'var(--error)',
                  fontWeight: 900, fontSize: '1.1rem'
                }}>
                  <span>{previewData.resultado >= 0 ? 'Utilidad del Ejercicio' : 'Pérdida del Ejercicio'}</span>
                  <span>${previewData.resultado.toFixed(decimals)}</span>
                </div>
              </div>
            ) : (
              <p className="text-sec">Selecciona un año para calcular la simulación contable.</p>
            )}
          </div>

          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 16, marginTop: 24, display: 'flex', gap: 12 }}>
            {esPeriodoCerrado ? (
              <button 
                onClick={handleReabrirAño} 
                className="btn" 
                style={{ width: '100%', padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'rgba(239,68,68,0.1)', color: 'var(--error)', fontWeight: 800 }}
                disabled={saving}
              >
                {saving ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />} Reabrir Periodo Contable
              </button>
            ) : (
              <button 
                onClick={handleCerrarAño} 
                className="btn btn-primary" 
                style={{ width: '100%', padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontWeight: 800 }}
                disabled={saving || !previewData || previewData.saldos.length === 0}
              >
                {saving ? <Loader2 className="animate-spin" size={16} /> : <Play size={16} />} Ejecutar Cierre Anual
              </button>
            )}
          </div>
        </div>
      </div>

      {/* DETALLE DE CUENTAS A ENCERRAR */}
      {!esPeriodoCerrado && previewData && previewData.saldos.length > 0 && (
        <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.01)' }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>Listado de Cuentas a Encerrar (Saldo actual del año)</h3>
          </div>
          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-sec)' }}>
                  <th style={{ padding: '10px 20px' }}>Código</th>
                  <th style={{ padding: '10px 20px' }}>Nombre Cuenta</th>
                  <th style={{ padding: '10px 20px' }}>Tipo</th>
                  <th style={{ padding: '10px 20px', textAlign: 'right' }}>Saldo Acumulado</th>
                </tr>
              </thead>
              <tbody>
                {previewData.saldos.map(s => (
                  <tr key={s.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                    <td style={{ padding: '10px 20px', fontFamily: 'monospace' }}>{s.codigo_cuenta}</td>
                    <td style={{ padding: '10px 20px', fontWeight: 600 }}>{s.nombre}</td>
                    <td style={{ padding: '10px 20px' }}>
                      <span style={{ 
                        padding: '2px 8px', borderRadius: 4, fontSize: '0.75rem', fontWeight: 700,
                        background: s.tipo === 'Ingreso' ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.08)',
                        color: s.tipo === 'Ingreso' ? 'var(--success)' : 'var(--warning)'
                      }}>{s.tipo}</span>
                    </td>
                    <td style={{ padding: '10px 20px', textAlign: 'right', fontWeight: 700 }}>
                      ${s.saldo.toFixed(decimals)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </motion.div>
  );
};
