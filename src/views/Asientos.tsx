import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, Loader2, AlertTriangle } from 'lucide-react';
import { supabase } from '../services/supabase';
import { CustomModal } from '../components/CustomModal';
import { AsientosHistoryTable } from '../components/AsientosHistoryTable';
import { AsientoForm } from '../components/AsientoForm';

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
  const [fechaBloqueo, setFechaBloqueo] = useState<string | null>(null);
  
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
    if (fechaBloqueo && tx.fecha <= fechaBloqueo) {
      return alert(`Período contable cerrado. No se puede editar transacciones en o antes del ${new Date(fechaBloqueo + 'T12:00:00').toLocaleDateString()}.`);
    }
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
    if (fechaBloqueo && tx.fecha <= fechaBloqueo) {
      return alert(`Período contable cerrado. No se puede anular transacciones en o antes del ${new Date(fechaBloqueo + 'T12:00:00').toLocaleDateString()}.`);
    }
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
      const [accRes, entRes, nextNum, empRes] = await Promise.all([
        supabase.from('plan_cuentas').select('id,codigo_cuenta,nombre,tipo').eq('id_empresa', empresaId).eq('acepta_movimientos', true).order('codigo_cuenta'),
        supabase.from('entidades').select('id,razon_social,ruc_cedula').eq('id_empresa', empresaId).order('razon_social'),
        getNextNumeroComprobante(empresaId),
        supabase.from('empresas_gestionadas').select('fecha_bloqueo').eq('id', empresaId).single()
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
      if (!empRes.error && empRes.data) {
        setFechaBloqueo(empRes.data.fecha_bloqueo || null);
      }

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

    if (fechaBloqueo && form.fecha <= fechaBloqueo) {
      return setMessage(`Período contable cerrado. No se admiten cambios en o antes del ${new Date(fechaBloqueo + 'T12:00:00').toLocaleDateString()}.`);
    }

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

  const decimals = parseInt(localStorage.getItem('pref_decimals') || '2', 10);

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
            <div className="flex-between"><strong>Debe</strong><strong>${totals.debe.toFixed(decimals)}</strong></div>
            <div className="flex-between" style={{ marginTop: 6 }}><strong>Haber</strong><strong>${totals.haber.toFixed(decimals)}</strong></div>
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
        <AsientoForm
          editingTxId={editingTxId}
          form={form}
          setForm={setForm}
          entities={entities}
          lines={lines}
          addLine={addLine}
          removeLine={removeLine}
          updateLine={updateLine}
          accounts={accounts}
          fechaBloqueo={fechaBloqueo}
          saving={saving}
          handleSubmit={handleSubmit}
          handleCancelEdit={handleCancelEdit}
          resetForm={resetForm}
          inputStyle={inputStyle}
        />
      ) : (
        <AsientosHistoryTable
          filteredHistory={filteredHistory}
          historySearch={historySearch}
          setHistorySearch={setHistorySearch}
          fetchHistory={fetchHistory}
          loadingHistory={loadingHistory}
          onViewDetails={setViewingTx}
          onEdit={handleEdit}
          onAnular={handleAnular}
        />
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
                      <td style={{ textAlign: 'right', fontWeight: m.debe > 0 ? 800 : 400 }}>{m.debe > 0 ? `$${m.debe.toFixed(decimals)}` : '-'}</td>
                      <td style={{ textAlign: 'right', fontWeight: m.haber > 0 ? 800 : 400 }}>{m.haber > 0 ? `$${m.haber.toFixed(decimals)}` : '-'}</td>
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
