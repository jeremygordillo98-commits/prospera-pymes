import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, PlusCircle, Save, Trash2, Loader2, AlertTriangle } from 'lucide-react';
import { supabase } from '../services/supabase';
import { AccountSelector } from '../components/AccountSelector';

interface Props { empresaId: string; }
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
        const num = parseInt(tx.numero_comprobante.trim(), 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    });
    
    return (maxNum + 1).toString();
  } catch {
    return '1';
  }
};



export const Asientos: React.FC<Props> = ({ empresaId }) => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string>('');
  
  const [form, setForm] = useState({
    fecha: new Date().toISOString().slice(0, 10),
    concepto: '',
    tipo_comprobante: 'Asiento Manual',
    numero_comprobante: '',
    id_entidad: '',
  });
  const [lines, setLines] = useState<Line[]>([createLine(), createLine()]);

  useEffect(() => {
    if (!empresaId || empresaId === 'undefined') return;
    const load = async () => {
      setLoading(true);
      const [accRes, entRes, nextNum] = await Promise.all([
        supabase.from('plan_cuentas').select('id,codigo_cuenta,nombre,tipo').eq('id_empresa', empresaId).eq('acepta_movimientos', true).order('codigo_cuenta'),
        supabase.from('entidades').select('id,razon_social,ruc_cedula').eq('id_empresa', empresaId).order('razon_social'),
        getNextNumeroComprobante(empresaId)
      ]);

      if (!accRes.error) setAccounts(accRes.data || []);
      if (!entRes.error) setEntities(entRes.data || []);

      const savedDraft = localStorage.getItem(`pymes_asiento_draft_${empresaId}`);
      if (savedDraft) {
        try {
          const parsed = JSON.parse(savedDraft);
          if (parsed.form && parsed.lines) {
            setForm(parsed.form);
            setLines(parsed.lines);
            setLoading(false);
            return;
          }
        } catch {}
      }

      setForm(prev => ({ ...prev, numero_comprobante: nextNum }));
      setLines([createLine(), createLine()]);
      setLoading(false);
    };
    load();
  }, [empresaId]);

  useEffect(() => {
    if (loading || !empresaId || empresaId === 'undefined') return;
    const draft = { form, lines };
    localStorage.setItem(`pymes_asiento_draft_${empresaId}`, JSON.stringify(draft));
  }, [form, lines, loading, empresaId]);

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
      let finalNum = form.numero_comprobante.trim();
      if (!finalNum) finalNum = await getNextNumeroComprobante(empresaId);

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
        <div className="glass-card" style={{ padding: 16, minWidth: 260 }}>
          <div className="text-sec" style={{ marginBottom: 8 }}>Control del asiento</div>
          <div className="flex-between"><strong>Debe</strong><strong>${totals.debe.toFixed(2)}</strong></div>
          <div className="flex-between" style={{ marginTop: 6 }}><strong>Haber</strong><strong>${totals.haber.toFixed(2)}</strong></div>
          <div style={{ marginTop: 10, fontWeight: 800, color: totals.cuadrado ? 'var(--success)' : 'var(--warning)' }}>
            {totals.cuadrado ? 'Asiento cuadrado' : 'Pendiente de cuadre'}
          </div>
        </div>
      </header>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <section className="glass-card">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            <div><label className="text-sec" style={{ display: 'block', marginBottom: 8 }}>Fecha</label><input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} style={inputStyle} /></div>
            <div><label className="text-sec" style={{ display: 'block', marginBottom: 8 }}>Tipo comprobante</label><input value={form.tipo_comprobante} onChange={(e) => setForm({ ...form, tipo_comprobante: e.target.value })} style={inputStyle} /></div>
            <div><label className="text-sec" style={{ display: 'block', marginBottom: 8 }}>No. comprobante</label><input value={form.numero_comprobante} onChange={(e) => setForm({ ...form, numero_comprobante: e.target.value })} style={inputStyle} placeholder="Opcional" /></div>
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

        {message && (
          <div className="glass-card" style={{ padding: 16, borderColor: message.includes('correctamente') ? 'rgba(16,185,129,0.25)' : 'rgba(245,158,11,0.25)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: message.includes('correctamente') ? 'var(--success)' : 'var(--warning)', fontWeight: 700 }}>
              <AlertTriangle size={18} /> {message}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
          <button type="button" className="btn" onClick={resetForm}>Limpiar</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />} Guardar asiento</button>
        </div>
      </form>
    </div>
  );
};
export default Asientos;
