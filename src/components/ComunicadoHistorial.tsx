import React from 'react';
import { Mail, CheckCircle2, Clock, Plus, Trash2, Eye, Layers } from 'lucide-react';
import type { CampanaPymes } from '../hooks/useComunicados';

interface Props {
  listado: CampanaPymes[];
  loadingList: boolean;
  setIsWorkspaceOpen: (open: boolean) => void;
  resetForm: () => void;
  loadDraft: (camp: CampanaPymes) => void;
  handleEditScheduled: (camp: CampanaPymes) => void;
  handleCancelScheduled: (camp: CampanaPymes) => void;
  setSelectedCampanaRecipients: (camp: CampanaPymes) => void;
  deleteRecord: (camp: CampanaPymes) => void;
}

export const ComunicadoHistorial: React.FC<Props> = ({
  listado,
  loadingList,
  setIsWorkspaceOpen,
  resetForm,
  loadDraft,
  handleEditScheduled,
  handleCancelScheduled,
  setSelectedCampanaRecipients,
  deleteRecord
}) => {
  const btnStyle = { background: 'var(--input-bg)', border: '1px solid var(--border-color)' };

  return (
    <>
      <header className="flex-between" style={{ flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', fontWeight: 800, textTransform: 'uppercase', fontSize: '0.8rem', letterSpacing: '2px', marginBottom: '8px' }}>
            <Mail size={14} /> Mailer Contable B2B
          </div>
          <h1 className="h1" style={{ fontSize: '2.5rem', fontWeight: 900 }}>Comunicados</h1>
          <p className="text-sec" style={{ fontSize: '1.1rem' }}>Envía boletines, recordatorios del SRI y reportes financieros a tus clientes.</p>
        </div>
        <button
          onClick={() => { resetForm(); setIsWorkspaceOpen(true); }}
          className="btn btn-primary"
          style={{ padding: '14px 28px', borderRadius: '18px', fontSize: '1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <Plus size={20} /> Redactar Comunicado
        </button>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
        <div className="glass-card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-sec)' }}>Total Mensajes</span>
          <span style={{ fontSize: '2.2rem', fontWeight: 900 }}>{listado.length}</span>
        </div>
        <div className="glass-card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-sec)', display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={12} className="text-success" /> Despachados</span>
          <span style={{ fontSize: '2.2rem', fontWeight: 900, color: 'var(--success)' }}>{listado.filter(c => c.estado === 'Enviado').length}</span>
        </div>
        <div className="glass-card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-sec)', display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={12} className="text-primary" /> Programados</span>
          <span style={{ fontSize: '2.2rem', fontWeight: 900, color: 'var(--primary)' }}>{listado.filter(c => c.estado === 'Programado').length}</span>
        </div>
      </div>

      <section className="glass-card" style={{ padding: '24px' }}>
        <h3 style={{ margin: '0 0 20px', fontSize: '1.2rem', fontWeight: 900 }}>Historial de Envíos Masivos</h3>
        
        {loadingList ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2, 3].map(i => <div key={i} style={{ height: 50, borderRadius: 12, background: 'rgba(255,255,255,0.03)', animation: 'pulse 1.5s infinite' }} />)}
          </div>
        ) : listado.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-sec)', fontSize: '0.95rem' }}>
            No se han registrado envíos masivos. ¡Comienza haciendo clic en "Redactar Comunicado"!
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  {['Fecha', 'Asunto', 'Destinatarios', 'Estado', 'Adjuntos', ''].map(h => (
                    <th key={h} style={{ padding: '12px', fontSize: '0.75rem', color: 'var(--text-sec)', textTransform: 'uppercase', fontWeight: 800 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {listado.map(camp => (
                  <tr key={camp.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ padding: '12px', fontSize: '0.82rem', fontWeight: 600 }}>
                      {new Date(camp.created_at).toLocaleDateString('es-EC')}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>{camp.titulo}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-sec)', marginTop: 2 }}>{camp.asunto}</div>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span style={{ background: 'var(--input-bg)', color: 'var(--text-main)', padding: '4px 8px', borderRadius: 8, fontSize: '0.7rem', fontWeight: 800 }}>
                        {camp.destinatarios === 'clientes' && '👥 Clientes'}
                        {camp.destinatarios === 'proveedores' && '👥 Proveedores'}
                        {camp.destinatarios === 'manual' && '✏️ Manual'}
                        {camp.destinatarios === 'prueba' && '🧪 Prueba'}
                      </span>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span style={{
                        background: camp.estado === 'Enviado' ? 'rgba(16, 185, 129, 0.15)' : (camp.estado === 'Programado' ? 'rgba(59, 130, 246, 0.15)' : (camp.estado === 'Borrador' ? 'rgba(148, 163, 184, 0.15)' : 'rgba(239, 68, 68, 0.15)')),
                        color: camp.estado === 'Enviado' ? 'var(--success)' : (camp.estado === 'Programado' ? '#3b82f6' : (camp.estado === 'Borrador' ? '#94a3b8' : 'var(--error)')),
                        padding: '4px 10px',
                        borderRadius: 20,
                        fontSize: '0.7rem',
                        fontWeight: 800
                      }}>
                        {camp.estado === 'Enviado' && '✓ Enviado'}
                        {camp.estado === 'Programado' && '⏰ Programado'}
                        {camp.estado === 'Borrador' && '✏ Borrador'}
                        {camp.estado === 'Error' && '✗ Error'}
                      </span>
                    </td>
                    <td style={{ padding: '12px', fontSize: '0.8rem', color: 'var(--text-sec)', fontWeight: 600 }}>
                      {camp.adjuntos?.length > 0 ? `📎 ${camp.adjuntos.length} archivo(s)` : 'Ninguno'}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 8 }}>
                        {camp.estado === 'Borrador' && (
                          <button onClick={() => loadDraft(camp)} className="btn" title="Editar Borrador" style={{ ...btnStyle, padding: 6, borderRadius: 8 }}>
                            <Layers size={14} />
                          </button>
                        )}
                        {camp.estado === 'Programado' && (
                          <>
                            <button onClick={() => handleEditScheduled(camp)} className="btn" title="Editar Programación (se cancelará el envío actual)" style={{ ...btnStyle, padding: 6, borderRadius: 8 }}>
                              <Layers size={14} />
                            </button>
                            <button onClick={() => handleCancelScheduled(camp)} className="btn hover:text-warning" title="Cancelar Envío Programado" style={{ ...btnStyle, padding: 6, borderRadius: 8, color: '#F59E0B' }}>
                              <Clock size={14} />
                            </button>
                          </>
                        )}
                        <button onClick={() => setSelectedCampanaRecipients(camp)} className="btn" title="Ver Destinatarios" style={{ ...btnStyle, padding: 6, borderRadius: 8 }}>
                          <Eye size={14} />
                        </button>
                        <button onClick={() => deleteRecord(camp)} className="btn hover:text-error" title="Eliminar Registro" style={{ ...btnStyle, padding: 6, borderRadius: 8, color: 'var(--error)' }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
};
