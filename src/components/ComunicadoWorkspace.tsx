import React from 'react';
import { ArrowLeft, Loader2, Send, Clock, Calendar, Paperclip, FileText, Trash2, Eye, AlertCircle } from 'lucide-react';
import { TEMPLATE_PRESETS } from '../utils/comunicadoPresets';

interface Props {
  form: any;
  setForm: (form: any) => void;
  setIsWorkspaceOpen: (open: boolean) => void;
  sending: boolean;
  sendingProgress: { current: number; total: number } | null;
  sizeLimitExceeded: boolean;
  totalAttachmentsSize: number;
  activePreset: string;
  setActivePreset: (preset: string) => void;
  filesList: File[];
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  removeFile: (idx: number) => void;
  previewHtml: string;
  handleSend: (esBorrador?: boolean) => void;
}

export const ComunicadoWorkspace: React.FC<Props> = ({
  form,
  setForm,
  setIsWorkspaceOpen,
  sending,
  sendingProgress,
  sizeLimitExceeded,
  totalAttachmentsSize,
  activePreset,
  setActivePreset,
  filesList,
  fileInputRef,
  handleFileChange,
  removeFile,
  previewHtml,
  handleSend
}) => {
  const btnStyle = { background: 'var(--input-bg)', border: '1px solid var(--border-color)' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      {/* Top Workspace Bar */}
      <header style={{ 
        padding: '16px 32px', 
        borderBottom: '1px solid var(--border-color)', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        background: 'var(--nav-bg)',
        flexShrink: 0 
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button 
            onClick={() => setIsWorkspaceOpen(false)} 
            className="btn" 
            style={{ ...btnStyle, padding: '8px 16px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
          >
            <ArrowLeft size={16} /> Volver al Historial
          </button>
          <div style={{ width: 1, height: 24, background: 'var(--border-color)' }}></div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900 }}>
              {form.id ? 'Editar Comunicado' : 'Creador de Comunicados Contables'}
            </h2>
            <p className="text-sec" style={{ margin: 0, fontSize: '0.78rem' }}>Redacción en texto plano con previsualización premium interactiva en tiempo real</p>
          </div>
        </div>

        {/* Action buttons top right */}
        <div style={{ display: 'flex', gap: 12 }}>
          <button 
            type="button" 
            onClick={() => handleSend(true)} 
            disabled={sending} 
            className="btn" 
            style={{ ...btnStyle, borderRadius: 12, height: 42, padding: '0 20px', fontWeight: 800 }}
          >
            Guardar Borrador
          </button>
          <button 
            type="button" 
            onClick={() => handleSend(false)} 
            disabled={sending || sizeLimitExceeded} 
            className="btn btn-primary" 
            style={{ borderRadius: 12, height: 42, padding: '0 24px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}
          >
            {sending ? <Loader2 className="animate-spin" size={16} /> : <><Send size={16} /> {form.programado ? 'Programar Envío' : 'Enviar Comunicado'}</>}
          </button>
        </div>
      </header>

      {/* Split Screen Workspace Body */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        {/* LEFT COLUMN: Redactor Form (60% width) */}
        <div className="custom-scrollbar" style={{ 
          width: '60%', 
          padding: '32px', 
          overflowY: 'auto', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: 20, 
          borderRight: '1px solid var(--border-color)',
          boxSizing: 'border-box'
        }}>
          
          {/* Real-time progress bar when sending */}
          {sending && sendingProgress && (
            <div style={{ background: 'var(--primary-light)', border: '1px solid var(--primary)', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 800, color: 'var(--primary)' }}>
                <span>Despachando correos masivos...</span>
                <span>{sendingProgress.current} de {sendingProgress.total} ({Math.round((sendingProgress.current / sendingProgress.total) * 100)}%)</span>
              </div>
              <div style={{ width: '100%', height: 6, background: 'var(--border-color)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', background: 'var(--primary)', width: `${(sendingProgress.current / sendingProgress.total) * 100}%`, transition: 'width 0.2s' }}></div>
              </div>
            </div>
          )}

          {/* Preset templates selector */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-sec)', marginBottom: 8 }}>Elegir Plantilla Base (Precarga el Asunto y Mensaje)</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
              {TEMPLATE_PRESETS.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setActivePreset(p.id)}
                  className="btn"
                  style={{
                    ...btnStyle,
                    padding: 10,
                    fontSize: '0.78rem',
                    borderRadius: 10,
                    borderColor: activePreset === p.id ? 'var(--primary)' : 'var(--border-color)',
                    background: activePreset === p.id ? 'var(--primary-light)' : 'var(--input-bg)',
                    color: activePreset === p.id ? 'var(--primary)' : 'var(--text-main)',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Titulo Interno */}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-sec)', marginBottom: 6 }}>Título del Mensaje (Auditoría Interna)</label>
              <input
                type="text"
                placeholder="Ej. Envío Balances Trimestrales"
                value={form.titulo}
                onChange={e => setForm({ ...form, titulo: e.target.value })}
                style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-main)', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            {/* Asunto Comercial */}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-sec)', marginBottom: 6 }}>Asunto del Correo (Subject)</label>
              <input
                type="text"
                placeholder="Ej. Importante: Estados Financieros"
                value={form.asunto}
                onChange={e => setForm({ ...form, asunto: e.target.value })}
                style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-main)', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          {/* Destinatarios */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-sec)', marginBottom: 6 }}>Grupo de Destinatarios</label>
              <select
                value={form.destinatarios}
                onChange={e => setForm({ ...form, destinatarios: e.target.value as any })}
                style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-main)', outline: 'none', cursor: 'pointer', boxSizing: 'border-box' }}
              >
                <option value="prueba">🧪 Enviar Prueba Única</option>
                <option value="clientes">👥 Todos mis Clientes de la Empresa</option>
                <option value="proveedores">👥 Todos mis Proveedores de la Empresa</option>
                <option value="manual">✏️ Lista de Correos Manual</option>
              </select>
            </div>

            <div>
              {form.destinatarios === 'prueba' && (
                <>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-sec)', marginBottom: 6 }}>Correo de Prueba</label>
                  <input
                    type="email"
                    placeholder="ejemplo@contador.com"
                    value={form.testEmail}
                    onChange={e => setForm({ ...form, testEmail: e.target.value })}
                    style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-main)', outline: 'none', boxSizing: 'border-box' }}
                  />
                </>
              )}

              {form.destinatarios === 'manual' && (
                <>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-sec)', marginBottom: 6 }}>Direcciones de Correo (Salto de línea o comas)</label>
                  <textarea
                    placeholder="cliente1@empresa.com, cliente2@empresa.com"
                    value={form.manualEmails}
                    onChange={e => setForm({ ...form, manualEmails: e.target.value })}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 12, border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-main)', outline: 'none', resize: 'vertical', boxSizing: 'border-box', height: 44 }}
                  />
                </>
              )}

              {form.destinatarios === 'clientes' && (
                <div style={{ background: 'var(--primary-light)', border: '1px solid var(--primary-light)', padding: 12, borderRadius: 12, fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 700, display: 'flex', alignItems: 'center', height: '100%', boxSizing: 'border-box' }}>
                  👥 Enviará a los clientes con email registrado en Entidades.
                </div>
              )}

              {form.destinatarios === 'proveedores' && (
                <div style={{ background: 'var(--primary-light)', border: '1px solid var(--primary-light)', padding: 12, borderRadius: 12, fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 700, display: 'flex', alignItems: 'center', height: '100%', boxSizing: 'border-box' }}>
                  👥 Enviará a los proveedores con email registrado en Entidades.
                </div>
              )}
            </div>
          </div>

          {/* Redacción de Mensaje en TEXTO PLANO */}
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 250 }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-sec)', marginBottom: 6 }}>Mensaje (Escribe el contenido en texto plano limpio)</label>
            <textarea
              placeholder="Estimado cliente, por medio del presente correo le informamos..."
              value={form.cuerpoMsg}
              onChange={e => setForm({ ...form, cuerpoMsg: e.target.value })}
              style={{ width: '100%', flex: 1, padding: 16, borderRadius: 16, border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-main)', outline: 'none', resize: 'none', fontFamily: 'inherit', fontSize: '0.95rem', boxSizing: 'border-box', minHeight: 200 }}
            />
          </div>

          {/* Programador de Envío */}
          <div className="glass-card" style={{ padding: 16, background: 'rgba(255,255,255,0.02)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                type="checkbox"
                id="progCheck"
                checked={form.programado}
                onChange={e => setForm({ ...form, programado: e.target.checked })}
                style={{ cursor: 'pointer', width: 18, height: 18 }}
              />
              <label htmlFor="progCheck" style={{ fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}><Clock size={16} className="text-primary" /> Programar este correo para el futuro</label>
            </div>
            {form.programado && (
              <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
                <Calendar size={16} className="text-sec" />
                <input
                  type="datetime-local"
                  value={form.scheduledDate}
                  onChange={e => setForm({ ...form, scheduledDate: e.target.value })}
                  style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-main)', outline: 'none', fontWeight: 600 }}
                />
              </div>
            )}
          </div>

          {/* Subir Adjuntos Masivos en Memoria */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-sec)', display: 'flex', alignItems: 'center', gap: 6 }}><Paperclip size={14} /> Archivos Adjuntos (Balances, XML, Facturas)</label>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: sizeLimitExceeded ? 'var(--error)' : 'var(--text-sec)' }}>
                Total: {(totalAttachmentsSize / (1024 * 1024)).toFixed(2)} MB / 5.00 MB
              </span>
            </div>
            
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              <button type="button" onClick={() => fileInputRef.current?.click()} className="btn" style={{ ...btnStyle, borderRadius: 10, padding: '8px 16px', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer' }}>
                + Adjuntar Archivos
              </button>
              <input ref={fileInputRef} type="file" multiple onChange={handleFileChange} style={{ display: 'none' }} />
            </div>

            {filesList.length > 0 && (
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {filesList.map((file, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifySelf: 'stretch', background: 'var(--input-bg)', border: '1px solid var(--border-color)', padding: '10px 14px', borderRadius: 10, fontSize: '0.82rem' }}>
                    <FileText size={16} className="text-sec" style={{ marginRight: 10 }} />
                    <span style={{ flex: 1, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
                    <span style={{ color: 'var(--text-sec)', marginRight: 14 }}>{(file.size / 1024).toFixed(1)} KB</span>
                    <button type="button" onClick={() => removeFile(i)} className="text-sec hover:text-error" style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}><Trash2 size={16} /></button>
                  </div>
                ))}
              </div>
            )}

            {sizeLimitExceeded && (
              <div style={{ display: 'flex', gap: 10, color: 'var(--error)', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: 12, borderRadius: 12, fontSize: '0.8rem', marginTop: 10 }}>
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <p style={{ margin: 0 }}><strong>Límite de Peso Excedido:</strong> El peso total de todos los archivos no debe exceder los 5.00 MB.</p>
              </div>
            )}
          </div>

        </div>

        {/* RIGHT COLUMN: Live Real-time Interactive Preview (40% width) */}
        <div style={{ 
          width: '40%', 
          background: '#f1f5f9', 
          display: 'flex', 
          flexDirection: 'column',
          boxSizing: 'border-box',
          overflow: 'hidden'
        }}>
          <div style={{ 
            padding: '12px 24px', 
            background: 'var(--nav-bg)', 
            borderBottom: '1px solid var(--border-color)', 
            display: 'flex', 
            alignItems: 'center', 
            gap: 8,
            flexShrink: 0
          }}>
            <Eye size={16} className="text-primary" />
            <span style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-main)' }}>
              Previsualización en Tiempo Real
            </span>
          </div>
          
          <div style={{ flex: 1, padding: 16, overflow: 'hidden' }}>
            <iframe
              title="Live Mailer Preview"
              srcDoc={previewHtml}
              style={{ width: '100%', height: '100%', border: 'none', borderRadius: 12, background: '#ffffff', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
            />
          </div>
        </div>

      </div>
    </div>
  );
};
