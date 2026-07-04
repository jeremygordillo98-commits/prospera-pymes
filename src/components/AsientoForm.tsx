import React from 'react';
import { AlertTriangle, PlusCircle, Trash2, Loader2, Save } from 'lucide-react';
import { AccountSelector } from './AccountSelector';

interface Line {
  id: string;
  id_cuenta: string;
  detalle: string;
  debe: string;
  haber: string;
}

interface AsientoFormProps {
  editingTxId: string | null;
  form: {
    fecha: string;
    tipo_comprobante: string;
    numero_comprobante: string;
    id_entidad: string;
    concepto: string;
  };
  setForm: React.Dispatch<React.SetStateAction<any>>;
  entities: any[];
  lines: Line[];
  addLine: () => void;
  removeLine: (id: string) => void;
  updateLine: (id: string, field: keyof Line, value: string) => void;
  accounts: any[];
  fechaBloqueo: string | null;
  saving: boolean;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  handleCancelEdit: () => void;
  resetForm: () => void;
  inputStyle: React.CSSProperties;
}

export const AsientoForm: React.FC<AsientoFormProps> = ({
  editingTxId,
  form,
  setForm,
  entities,
  lines,
  addLine,
  removeLine,
  updateLine,
  accounts,
  fechaBloqueo,
  saving,
  handleSubmit,
  handleCancelEdit,
  resetForm,
  inputStyle
}) => {
  return (
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

      {fechaBloqueo && form.fecha <= fechaBloqueo && (
        <div className="glass-card" style={{ padding: 12, borderColor: 'var(--error)', background: 'rgba(239, 68, 68, 0.05)', color: 'var(--error)', fontWeight: 700, display: 'flex', gap: 8, alignItems: 'center' }}>
          <AlertTriangle size={18} />
          <span>Período contable cerrado y bloqueado. La fecha seleccionada ({new Date(form.fecha + 'T12:00:00').toLocaleDateString()}) es igual o anterior al cierre ({new Date(fechaBloqueo + 'T12:00:00').toLocaleDateString()}).</span>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
        {editingTxId ? (
          <button type="button" className="btn" onClick={handleCancelEdit}>Cancelar Edición</button>
        ) : (
          <button type="button" className="btn" onClick={resetForm}>Limpiar</button>
        )}
        <button type="submit" className="btn btn-primary" disabled={saving || (fechaBloqueo !== null && form.fecha <= fechaBloqueo)}>{saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />} {editingTxId ? 'Guardar Cambios' : 'Guardar asiento'}</button>
      </div>
    </form>
  );
};
