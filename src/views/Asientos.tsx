import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, PlusCircle, Save, Trash2, Loader2, AlertTriangle, Search, RefreshCw } from 'lucide-react';
import { supabase } from '../services/supabase';
import { AccountSelector } from '../components/AccountSelector';
import { CustomModal } from '../components/CustomModal';

interface Props { empresaId: string; activeView?: string; }
interface Account { id: string; codigo_cuenta: string; nombre: string; tipo: string; }
interface Entity { id: string; razon_social: string; ruc_cedula: string; }
interface Line { id: string; id_cuenta: string; detalle: string; debe: string; haber: string; }

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid var(--border-color)',
  background: 'var(--input-bg)', color: 'var(--text-main)', outline: 'none'
};

const createLine = (): Line => ({
  id: crypto.randomUUID(), id_cuenta: '', detalle: '', debe: '', haber: ''
});

const getNextNumeroComprobante = async (empresaId: string): Promise<string> => {
  if (!empresaId || empresaId === 'undefined') return '1';
  try {
    const { data, error } = await supabase
      .from('transacciones')
      .select('numero_comprobante')
      .eq('id_empresa', empresaId);
      
    if (error || !data || data.length === 0) return '1';
    
    let maxNum = 0;
    data.forEach(tx => {
      if (tx.numero_comprobante) {
        const val = tx.numero_comprobante.trim();
        if (/^\d+$/.test(val)) {
          const num = parseInt(val, 10);
          if (!isNaN(num) && num > maxNum) {
            maxNum = num;
          }
        }
      }
    });
    
    return (maxNum + 1).toString();
  } catch {
    return '1';
  }
};



export const Asientos: React.FC<Props> = ({ empresaId, activeView }) => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string>('');
  const [isNumeroEdited, setIsNumeroEdited] = useState(false);
  
  const [form, setForm] = useState({
    fecha: new Date().toISOString().slice(0, 10),
    concepto: '',
    tipo_comprobante: 'Asiento Manual',
    numero_comprobante: '',
    id_entidad: '',
  });
  const [lines, setLines] = useState<Line[]>([createLine(), createLine()]);

  // Estados para historial y flujos adicionales
  const [activeTab, setActiveTab] = useState<'nuevo' | 'historial'>('nuevo');
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [viewingTx, setViewingTx] = useState<any | null>(null);
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  
  const [annulModal, setAnnulModal] = useState<{
    isOpen: boolean;
    txId: string;
    confirmText: string;
    promptText: string;
    onSuccess: (reason: string) => void;
  }>({
    isOpen: false,
    txId: '',
    confirmText: '',
    promptText: '',
    onSuccess: () => {}
  });
  const [annulReason, setAnnulReason] = useState('');

  const fetchHistory = async () => {
    if (!empresaId || empresaId === 'undefined') return;
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('transacciones')
        .select(`
          id,
          fecha,
          concepto,
          tipo_comprobante,
          numero_comprobante,
          id_entidad,
          xml_referencia,
          entidades (razon_social),
          movimientos (
            id,
            id_cuenta,
            debe,
            haber,
            plan_cuentas (nombre, codigo_cuenta)
          )
        `)
        .eq('id_empresa', empresaId)
        .eq('tipo_comprobante', 'Asiento Manual')
        .order('fecha', { ascending: false });

      if (error) throw error;

      const filtered = data || [];

      const mapped = filtered.map((tx: any) => ({
        ...tx,
        entidades: Array.isArray(tx.entidades) ? tx.entidades[0] : tx.entidades,
        movimientos: (tx.movimientos || []).map((m: any) => ({
          ...m,
          plan_cuentas: Array.isArray(m.plan_cuentas) ? m.plan_cuentas[0] : m.plan_cuentas
        }))
      }));

      mapped.sort((a: any, b: any) => {
        const numA = parseInt(a.numero_comprobante || '0', 10) || 0;
        const numB = parseInt(b.numero_comprobante || '0', 10) || 0;
        if (numA !== numB) return numB - numA;
        return new Date(b.fecha).getTime() - new Date(a.fecha).getTime();
      });

      setHistory(mapped);
    } catch (err) {
      console.error('Error al obtener historial:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (empresaId && empresaId !== 'undefined') {
      fetchHistory();
    }
  }, [empresaId, activeTab]);

  const filteredHistory = useMemo(() => {
    if (!historySearch) return history;
    const query = historySearch.toLowerCase();
    return history.filter(tx => 
      tx.concepto?.toLowerCase().includes(query) ||
      tx.numero_comprobante?.toLowerCase().includes(query) ||
      tx.entidades?.razon_social?.toLowerCase().includes(query)
    );
  }, [history, historySearch]);

  const handleEdit = (tx: any) => {
    setEditingTxId(tx.id);
    setForm({
      fecha: tx.fecha,
      concepto: tx.concepto,
      tipo_comprobante: tx.tipo_comprobante,
      numero_comprobante: tx.numero_comprobante,
      id_entidad: tx.id_entidad || '',
    });
    const mappedLines = tx.movimientos.map((m: any) => ({
      id: m.id,
      id_cuenta: m.id_cuenta,
      detalle: m.detalle || '',
      debe: m.debe > 0 ? String(m.debe) : '',
      haber: m.haber > 0 ? String(m.haber) : ''
    }));
    setLines(mappedLines);
    setIsNumeroEdited(true);
    setActiveTab('nuevo');
  };

  const handleCancelEdit = () => {
    setEditingTxId(null);
    resetForm();
    setActiveTab('historial');
  };

  const handleAnular = (tx: any) => {
    setAnnulModal({
      isOpen: true,
      txId: tx.id,
      confirmText: `¿Estás seguro de anular el asiento contable #${tx.numero_comprobante}?\n\n"${tx.concepto}"\n\nSe conservará el registro con valores en cero para auditoría y se eliminarán sus movimientos contables.`,
      promptText: 'Por favor, ingresa el motivo de la anulación:',
      onSuccess: async (reason) => {
        try {
          const ahora = new Date().toLocaleString('es-EC', { 
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit' 
          });
          const cleanConcept = tx.concepto.startsWith('[ANULADO]') ? tx.concepto.replace(/^\[ANULADO\]\s*Motivo:\s*.*?\s*\|\s*Fecha:\s*.*?\s*\|\s*/, '') : tx.concepto;
          const newConcepto = `[ANULADO] Motivo: ${reason} | Fecha: ${ahora} | ${cleanConcept}`;
          
          const { error: txError } = await supabase
            .from('transacciones')
            .update({ concepto: newConcepto, tipo_comprobante: 'Anulado' })
            .eq('id', tx.id);
          if (txError) throw txError;

          const { error: movError } = await supabase
            .from('movimientos')
            .delete()
            .eq('id_transaccion', tx.id);
          if (movError) throw movError;

          await supabase
            .from('tesoreria_documentos')
            .delete()
            .eq('id_empresa', empresaId)
            .eq('referencia', tx.numero_comprobante);

          fetchHistory();
          setMessage('Asiento contable anulado correctamente.');
        } catch (err: any) {
          console.error(err);
          setMessage(`Error al anular: ${err.message}`);
        }
      }
    });
  };

  // Actualizar el número de comprobante cuando cambie el activeView, empresaId o a través de Supabase Realtime
  useEffect(() => {
    if (!empresaId || empresaId === 'undefined') return;

    const updateNumber = () => {
      getNextNumeroComprobante(empresaId).then(nextNum => {
        if (!isNumeroEdited) {
          setForm(prev => ({ ...prev, numero_comprobante: nextNum }));
        }
      });
    };

    // Actualizar al enfocar/activar la vista o cuando cambia la empresa
    if (!activeView || activeView === 'asientos') {
      updateNumber();
    }

    // Suscribirse a cambios en tiempo real en la tabla de transacciones de Supabase
    const channelTx = supabase
      .channel(`transacciones_asientos_${empresaId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transacciones',
          filter: `id_empresa=eq.${empresaId}`
        },
        () => {
          updateNumber();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channelTx);
    };
  }, [empresaId, activeView, isNumeroEdited]);

  useEffect(() => {
    if (!empresaId || empresaId === 'undefined') return;
    const load = async () => {
      setLoading(true);
      const [accRes, entRes, nextNum] = await Promise.all([
        supabase.from('plan_cuentas').select('id,codigo_cuenta,nombre,tipo').eq('id_empresa', empresaId).eq('acepta_movimientos', true).order('codigo_cuenta'),
        supabase.from('entidades').select('id,razon_social,ruc_cedula').eq('id_empresa', empresaId).order('razon_social'),
        getNextNumeroComprobante(empresaId)
      ]);

      if (!accRes.error) {
        const rawAccounts = accRes.data || [];
        const allCodes = rawAccounts.map(a => a.codigo_cuenta);
        const leafAccounts = rawAccounts.filter(acc => {
          const code = acc.codigo_cuenta;
          const hasChildren = allCodes.some(c => c.startsWith(code + '.'));
          return !hasChildren;
        });
        setAccounts(leafAccounts);
      }
      if (!entRes.error) setEntities(entRes.data || []);

      const savedDraft = localStorage.getItem(`pymes_asiento_draft_${empresaId}`);
      if (savedDraft) {
        try {
          const parsed = JSON.parse(savedDraft);
          if (parsed.form && parsed.lines) {
            setForm(parsed.form);
            setLines(parsed.lines);
            
            let draftEdited = false;
            if (parsed.isNumeroEdited !== undefined) {
              setIsNumeroEdited(parsed.isNumeroEdited);
              draftEdited = parsed.isNumeroEdited;
            }
            
            // Si el número no fue editado por el usuario, actualizamos con el valor más fresco de la DB
            if (!draftEdited) {
              setForm(prev => ({ ...prev, numero_comprobante: nextNum }));
            }

            setLoading(false);
            return;
          }
        } catch {}
      }

      setForm(prev => ({ ...prev, numero_comprobante: nextNum }));
      setIsNumeroEdited(false);
      setLines([createLine(), createLine()]);
      setLoading(false);
    };
    load();
  }, [empresaId]);

  useEffect(() => {
    if (loading || !empresaId || empresaId === 'undefined' || editingTxId) return;
    const draft = { form, lines, isNumeroEdited };
    localStorage.setItem(`pymes_asiento_draft_${empresaId}`, JSON.stringify(draft));
  }, [form, lines, isNumeroEdited, loading, empresaId, editingTxId]);

  const totals = useMemo(() => {
    const debe = lines.reduce((acc, line) => acc + (parseFloat(line.debe) || 0), 0);
    const haber = lines.reduce((acc, line) => acc + (parseFloat(line.haber) || 0), 0);
    return { debe, haber, cuadrado: Math.abs(debe - haber) < 0.001 && debe > 0 };
  }, [lines]);

  const updateLine = (id: string, field: keyof Line, value: string) => {
    setLines((prev) => prev.map((line) => {
      if (line.id !== id) return line;
      const next = { ...line, [field]: value };
      if (field === 'debe' && value) next.haber = '';
      if (field === 'haber' && value) next.debe = '';
      return next;
    }));
  };

  const addLine = () => setLines((prev) => [...prev, createLine()]);
  const removeLine = (id: string) => setLines((prev) => prev.length > 2 ? prev.filter((line) => line.id !== id) : prev);

  const resetForm = () => {
    getNextNumeroComprobante(empresaId).then(nextNum => {
      setForm({ fecha: new Date().toISOString().slice(0, 10), concepto: '', tipo_comprobante: 'Asiento Manual', numero_comprobante: nextNum, id_entidad: '' });
      setLines([createLine(), createLine()]);
      setIsNumeroEdited(false);
    });
    localStorage.removeItem(`pymes_asiento_draft_${empresaId}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');

    const validLines = lines.filter((line) => line.id_cuenta && ((parseFloat(line.debe) || 0) > 0 || (parseFloat(line.haber) || 0) > 0));
    if (!form.concepto.trim()) return setMessage('Ingresa un concepto para el asiento.');
    if (validLines.length < 2) return setMessage('Necesitas al menos dos movimientos válidos.');
    if (!totals.cuadrado) return setMessage('El asiento no cuadra. Debe y Haber deben ser iguales.');

    setSaving(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth?.user?.id;

      if (editingTxId) {
        // Modo Edición: Actualizar transacción existente
        const { error: txError } = await supabase
          .from('transacciones')
          .update({
            fecha: form.fecha,
            concepto: form.concepto,
            tipo_comprobante: form.tipo_comprobante,
            numero_comprobante: form.numero_comprobante,
            id_entidad: form.id_entidad || null
          })
          .eq('id', editingTxId);

        if (txError) throw txError;

        // Eliminar movimientos antiguos
        const { error: delError } = await supabase
          .from('movimientos')
          .delete()
          .eq('id_transaccion', editingTxId);

        if (delError) throw delError;

        // Insertar nuevos movimientos
        const payload = validLines.map((line) => ({
          id_transaccion: editingTxId, id_cuenta: line.id_cuenta,
          debe: parseFloat(line.debe) || 0, haber: parseFloat(line.haber) || 0,
          id_empresa: empresaId,
        }));

        const { error: movError } = await supabase.from('movimientos').insert(payload);
        if (movError) throw movError;

        setMessage('Asiento contable modificado correctamente.');
        setEditingTxId(null);
        resetForm();
        setActiveTab('historial');
      } else {
        // Modo Creación: Insertar nueva transacción
        let finalNum = form.numero_comprobante.trim();
        if (!isNumeroEdited || !finalNum) {
          finalNum = await getNextNumeroComprobante(empresaId);
        }

        const { data: transaccion, error: txError } = await supabase
          .from('transacciones')
          .insert({
            fecha: form.fecha, concepto: form.concepto, tipo_comprobante: form.tipo_comprobante,
            numero_comprobante: finalNum, id_entidad: form.id_entidad || null,
            id_empresa: empresaId, id_usuario: userId || null,
          })
          .select()
          .single();

        if (txError) throw txError;

        const payload = validLines.map((line) => ({
          id_transaccion: transaccion.id, id_cuenta: line.id_cuenta,
          debe: parseFloat(line.debe) || 0, haber: parseFloat(line.haber) || 0,
          id_empresa: empresaId,
        }));

        const { error: movError } = await supabase.from('movimientos').insert(payload);
        if (movError) throw movError;

        localStorage.removeItem(`pymes_asiento_draft_${empresaId}`);
        setMessage('Asiento guardado correctamente.');
        resetForm();
      }
    } catch (error: any) {
      console.error(error);
      setMessage(error.message || 'No se pudo guardar el asiento.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex-center" style={{ padding: '120px 0' }}><Loader2 className="animate-spin" size={36} style={{ color: 'var(--primary)' }} /></div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <header className="flex-between" style={{ gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--primary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.5, fontSize: '0.8rem', marginBottom: 8 }}>
            <BookOpen size={14} /> Contabilidad Operativa
          </div>
          <h1 className="h1" style={{ fontSize: '2.2rem' }}>Asientos Manuales</h1>
          <p className="text-sec">Registra partidas dobles, valida el cuadre y publica al libro diario.</p>
        </div>
        {activeTab === 'nuevo' && (
          <div className="glass-card" style={{ padding: 16, minWidth: 260 }}>
            <div className="text-sec" style={{ marginBottom: 8 }}>Control del asiento</div>
            <div className="flex-between"><strong>Debe</strong><strong>${totals.debe.toFixed(2)}</strong></div>
            <div className="flex-between" style={{ marginTop: 6 }}><strong>Haber</strong><strong>${totals.haber.toFixed(2)}</strong></div>
            <div style={{ marginTop: 10, fontWeight: 800, color: totals.cuadrado ? 'var(--success)' : 'var(--warning)' }}>
              {totals.cuadrado ? 'Asiento cuadrado' : 'Pendiente de cuadre'}
            </div>
          </div>
        )}
      </header>

      {/* Selector de Pestañas */}
      <div style={{ display: 'flex', gap: 12, borderBottom: '1px solid var(--border-color)', paddingBottom: 12 }}>
        <button
          type="button"
          onClick={() => setActiveTab('nuevo')}
          className={`btn ${activeTab === 'nuevo' ? 'btn-primary' : ''}`}
          style={{ padding: '10px 20px', borderRadius: 12, fontSize: '0.9rem', fontWeight: 700 }}
        >
          {editingTxId ? 'Editar Asiento' : 'Nuevo Asiento'}
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab('historial');
            fetchHistory();
          }}
          className={`btn ${activeTab === 'historial' ? 'btn-primary' : ''}`}
          style={{ padding: '10px 20px', borderRadius: 12, fontSize: '0.9rem', fontWeight: 700 }}
        >
          Historial de Asientos
        </button>
      </div>

      {message && (
        <div className="glass-card" style={{ padding: 16, borderColor: message.includes('correctamente') ? 'rgba(16,185,129,0.25)' : 'rgba(245,158,11,0.25)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: message.includes('correctamente') ? 'var(--success)' : 'var(--warning)', fontWeight: 700 }}>
            <AlertTriangle size={18} /> {message}
          </div>
        </div>
      )}

      {activeTab === 'nuevo' ? (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {editingTxId && (
            <div className="glass-card" style={{ background: 'rgba(59, 130, 246, 0.05)', borderColor: 'var(--primary)', color: 'var(--primary)', fontWeight: 800, padding: 16, borderRadius: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
              <AlertTriangle size={18} />
              <span>Modo Edición: Editando Asiento Contable #{form.numero_comprobante}</span>
            </div>
          )}

          <section className="glass-card">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
              <div><label className="text-sec" style={{ display: 'block', marginBottom: 8 }}>Fecha</label><input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} style={inputStyle} /></div>
              <div><label className="text-sec" style={{ display: 'block', marginBottom: 8 }}>Tipo comprobante</label><input value={form.tipo_comprobante} onChange={(e) => setForm({ ...form, tipo_comprobante: e.target.value })} style={inputStyle} /></div>
              <div><label className="text-sec" style={{ display: 'block', marginBottom: 8 }}>No. comprobante</label><input value={form.numero_comprobante} readOnly style={{ ...inputStyle, opacity: 0.7, cursor: 'not-allowed' }} placeholder="Automático" /></div>
              <div><label className="text-sec" style={{ display: 'block', marginBottom: 8 }}>Tercero</label>
                <select value={form.id_entidad} onChange={(e) => setForm({ ...form, id_entidad: e.target.value })} style={inputStyle}>
                  <option value="">Sin tercero</option>
                  {entities.map((entity) => <option key={entity.id} value={entity.id}>{entity.razon_social}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginTop: 16 }}>
              <label className="text-sec" style={{ display: 'block', marginBottom: 8 }}>Concepto</label>
              <input value={form.concepto} onChange={(e) => setForm({ ...form, concepto: e.target.value })} style={inputStyle} placeholder="Ej. Ajuste de caja chica, provisión de servicios, etc." />
            </div>
          </section>

          <section className="glass-card" style={{ padding: 0, overflow: 'visible' }}>
            <div className="flex-between" style={{ padding: 20, borderBottom: '1px solid var(--border-color)' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Movimientos</h3>
                <p className="text-sec" style={{ margin: '6px 0 0' }}>Cada fila permite un solo lado: debe o haber.</p>
              </div>
              <button type="button" className="btn btn-primary" onClick={addLine}><PlusCircle size={18} /> Agregar línea</button>
            </div>
            <div style={{ overflowX: 'visible' }}>
              <table className="data-table" style={{ minWidth: 760, overflow: 'visible' }}>
                <thead>
                  <tr>
                    <th style={{ width: '40%' }}>Cuenta</th>
                    <th>Detalle</th>
                    <th>Debe</th>
                    <th>Haber</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => (
                    <tr key={line.id}>
                      <td style={{ padding: 12, overflow: 'visible' }}>
                        <AccountSelector 
                          value={line.id_cuenta} 
                          onChange={(val) => updateLine(line.id, 'id_cuenta', val)} 
                          accounts={accounts} 
                          placeholder="Buscar o seleccionar cuenta..."
                        />
                      </td>
                      <td style={{ padding: 12 }}><input value={line.detalle} onChange={(e) => updateLine(line.id, 'detalle', e.target.value)} style={inputStyle} placeholder="Detalle opcional" /></td>
                      <td style={{ padding: 12 }}><input inputMode="decimal" value={line.debe} onChange={(e) => updateLine(line.id, 'debe', e.target.value)} style={inputStyle} placeholder="0.00" /></td>
                      <td style={{ padding: 12 }}><input inputMode="decimal" value={line.haber} onChange={(e) => updateLine(line.id, 'haber', e.target.value)} style={inputStyle} placeholder="0.00" /></td>
                      <td style={{ padding: 12, textAlign: 'center' }}>
                        <button type="button" className="btn" onClick={() => removeLine(line.id)} style={{ color: 'var(--error)' }}><Trash2 size={18} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
            {editingTxId ? (
              <button type="button" className="btn" onClick={handleCancelEdit}>Cancelar Edición</button>
            ) : (
              <button type="button" className="btn" onClick={resetForm}>Limpiar</button>
            )}
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />} {editingTxId ? 'Guardar Cambios' : 'Guardar asiento'}</button>
          </div>
        </form>
      ) : (
        /* VISTA DE HISTORIAL */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontWeight: 800, flex: 1, minWidth: 200 }}>
              Historial de Asientos
              <span style={{ marginLeft: 10, fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-sec)', background: 'var(--primary-light)', padding: '3px 10px', borderRadius: 20 }}>
                {filteredHistory.length}
              </span>
            </h3>
            <div style={{ position: 'relative', width: '320px' }}>
              <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-sec)' }} />
              <input
                value={historySearch}
                onChange={e => setHistorySearch(e.target.value)}
                placeholder="Buscar por concepto, número o tercero..."
                style={{ width: '100%', paddingLeft: 36, padding: '10px 12px 10px 36px', borderRadius: 12, border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-main)', fontSize: '0.9rem', boxSizing: 'border-box', outline: 'none' }}
              />
            </div>
            <button 
              type="button" 
              onClick={fetchHistory} 
              className="btn" 
              style={{ padding: 12, borderRadius: 12 }} 
              disabled={loadingHistory}
            >
              {loadingHistory ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
            </button>
          </div>

          {loadingHistory ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} style={{ height: 64, borderRadius: 12, background: 'rgba(255,255,255,0.04)', animation: 'pulse 1.5s ease-in-out infinite' }} />
              ))}
            </div>
          ) : (
            <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{ width: '100%', minWidth: 700 }}>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Nº Comprobante</th>
                      <th>Concepto / Tercero</th>
                      <th style={{ textAlign: 'right' }}>Monto</th>
                      <th style={{ textAlign: 'center' }}>Estado</th>
                      <th style={{ textAlign: 'center' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistory.map((tx) => {
                      const isAnulado = tx.tipo_comprobante === 'Anulado';
                      const match = tx.concepto.match(/^\[ANULADO\]\s*Motivo:\s*(.*?)\s*\|\s*Fecha:\s*(.*?)\s*\|\s*(.*)$/);
                      const conceptoDisplay = isAnulado && match ? match[3] : (isAnulado ? tx.concepto.replace(/^\[ANULADO\]\s*/, '') : tx.concepto);
                      const totalMonto = tx.movimientos?.reduce((acc: number, m: any) => acc + (m.debe || 0), 0) || 0;
                      return (
                        <tr key={tx.id} style={{ opacity: isAnulado ? 0.6 : 1 }}>
                          <td style={{ padding: '14px 16px', fontWeight: 600 }}>{tx.fecha}</td>
                          <td style={{ padding: '14px 16px', fontWeight: 700 }}>#{tx.numero_comprobante}</td>
                          <td style={{ padding: '14px 16px' }}>
                            <div style={{ fontWeight: 800 }}>{conceptoDisplay}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-sec)' }}>{tx.entidades?.razon_social || 'Sin tercero'}</div>
                          </td>
                          <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 800, color: 'var(--primary)' }}>
                            ${totalMonto.toFixed(2)}
                          </td>
                          <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                            <span style={{ 
                              fontSize: '0.7rem', 
                              textTransform: 'uppercase', 
                              padding: '4px 8px', 
                              borderRadius: 999, 
                              background: isAnulado ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)', 
                              color: isAnulado ? 'var(--error)' : 'var(--success)', 
                              fontWeight: 800 
                            }}>
                              {isAnulado ? 'Anulado' : 'Aplicado'}
                            </span>
                          </td>
                          <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                              <button 
                                type="button" 
                                onClick={() => setViewingTx(tx)}
                                className="btn" 
                                style={{ fontSize: '0.75rem', padding: '6px 12px' }}
                              >
                                Ver
                              </button>
                              {!isAnulado && (
                                <>
                                  <button 
                                    type="button" 
                                    onClick={() => handleEdit(tx)}
                                    className="btn" 
                                    style={{ fontSize: '0.75rem', padding: '6px 12px', background: 'var(--primary-light)', color: 'var(--primary)' }}
                                  >
                                    Editar
                                  </button>
                                  <button 
                                    type="button" 
                                    onClick={() => handleAnular(tx)}
                                    className="btn" 
                                    style={{ fontSize: '0.75rem', padding: '6px 12px', color: 'var(--error)', background: 'rgba(239, 68, 68, 0.05)' }}
                                  >
                                    Anular
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredHistory.length === 0 && (
                      <tr>
                        <td colSpan={6} style={{ padding: 40, textAlign: 'center', color: 'var(--text-sec)', fontWeight: 600 }}>
                          No se encontraron asientos manuales registrados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modales */}
      {viewingTx && (
        <CustomModal
          isOpen={!!viewingTx}
          onClose={() => setViewingTx(null)}
          title={`Detalle de Asiento #${viewingTx.numero_comprobante}`}
          confirmLabel="Cerrar"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-sec)' }}>Concepto</div>
              <div style={{ fontWeight: 800, fontSize: '1.05rem', marginTop: 4 }}>
                {viewingTx.tipo_comprobante === 'Anulado' && viewingTx.concepto.match(/^\[ANULADO\]\s*Motivo:\s*(.*?)\s*\|\s*Fecha:\s*(.*?)\s*\|\s*(.*)$/) 
                  ? viewingTx.concepto.match(/^\[ANULADO\]\s*Motivo:\s*(.*?)\s*\|\s*Fecha:\s*(.*?)\s*\|\s*(.*)$/)[3] 
                  : viewingTx.concepto}
              </div>
            </div>
            {viewingTx.tipo_comprobante === 'Anulado' && viewingTx.concepto.match(/^\[ANULADO\]\s*Motivo:\s*(.*?)\s*\|\s*Fecha:\s*(.*?)\s*\|\s*(.*)$/) && (
              <div style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px dashed var(--error)', padding: '10px 12px', borderRadius: 10, color: 'var(--error)', fontSize: '0.85rem' }}>
                <strong>Motivo de Anulación:</strong> {viewingTx.concepto.match(/^\[ANULADO\]\s*Motivo:\s*(.*?)\s*\|\s*Fecha:\s*(.*?)\s*\|\s*(.*)$/)[1]}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-sec)' }}>Fecha</div>
                <div style={{ fontWeight: 700, marginTop: 2 }}>{viewingTx.fecha}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-sec)' }}>Tercero</div>
                <div style={{ fontWeight: 700, marginTop: 2 }}>{viewingTx.entidades?.razon_social || 'Sin tercero'}</div>
              </div>
            </div>
            <div style={{ overflowX: 'auto', marginTop: 10 }}>
              <table className="data-table" style={{ width: '100%', fontSize: '0.85rem' }}>
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Cuenta</th>
                    <th style={{ textAlign: 'right' }}>Debe</th>
                    <th style={{ textAlign: 'right' }}>Haber</th>
                  </tr>
                </thead>
                <tbody>
                  {viewingTx.movimientos?.map((m: any) => (
                    <tr key={m.id}>
                      <td>{m.plan_cuentas?.codigo_cuenta}</td>
                      <td style={{ fontWeight: 600 }}>{m.plan_cuentas?.nombre}</td>
                      <td style={{ textAlign: 'right', fontWeight: m.debe > 0 ? 800 : 400 }}>{m.debe > 0 ? `$${m.debe.toFixed(2)}` : '-'}</td>
                      <td style={{ textAlign: 'right', fontWeight: m.haber > 0 ? 800 : 400 }}>{m.haber > 0 ? `$${m.haber.toFixed(2)}` : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </CustomModal>
      )}

      <CustomModal
        isOpen={annulModal.isOpen}
        onClose={() => {
          setAnnulModal(prev => ({ ...prev, isOpen: false }));
          setAnnulReason('');
        }}
        title="Confirmar Anulación"
        type="prompt"
        message={annulModal.confirmText}
        confirmLabel="Confirmar Anulación"
        cancelLabel="Cancelar"
        inputValue={annulReason}
        onInputChange={setAnnulReason}
        inputPlaceholder="Motivo de la anulación..."
        onConfirm={() => {
          const reason = annulReason.trim();
          if (!reason) {
            alert('Por favor ingresa un motivo.');
            return;
          }
          annulModal.onSuccess(reason);
          setAnnulModal(prev => ({ ...prev, isOpen: false }));
          setAnnulReason('');
        }}
      />
    </div>
  );
};
export default Asientos;
