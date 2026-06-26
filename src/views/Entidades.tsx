import React, { useState } from 'react';
import type { CSSProperties } from 'react';
import { supabase } from '../services/supabase';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  Plus,
  Mail,
  Phone,
  Loader2,
  Trash2,
  Edit2,
  X,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { exportEntidadesExcel, exportEntidadesPDF } from '../utils/entidadesExport';

export const Entidades: React.FC<{ empresaId: string }> = ({ empresaId }) => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    ruc_cedula: '',
    razon_social: '',
    nombre: '',
    tipo_entidad: 'Proveedor',
    persona_tipo: 'Natural',
    tipo_identificacion: '04',
    email: '',
    telefono: '',
    direccion: ''
  });

  // Auto-detectar tipo_identificacion desde el RUC/cédula
  const detectTipoId = (ruc: string): string => {
    if (ruc === '9999999999999') return '07'; // Consumidor Final
    if (ruc.length === 13) return '04';        // RUC
    if (ruc.length === 10) return '05';        // Cédula
    if (ruc.length > 13) return '08';          // Identificación exterior
    return '04';
  };
  const [saving, setSaving] = useState(false);

  const { data: entidades = [], isLoading: loading } = useQuery({
    queryKey: ['entidades', empresaId],
    queryFn: async () => {
      if (!empresaId) return [];
      const { data, error } = await supabase
        .from('entidades')
        .select('*')
        .eq('id_empresa', empresaId)
        .order('razon_social', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes cache
  });

  const filtered = entidades.filter(e =>
    e.razon_social.toLowerCase().includes(search.toLowerCase()) ||
    (e.ruc_cedula && e.ruc_cedula.includes(search))
  );

  const handleOpenModal = (entidad?: any) => {
    if (entidad) {
      setFormData({
        ruc_cedula: entidad.ruc_cedula,
        razon_social: entidad.razon_social,
        nombre: entidad.nombre || '',
        tipo_entidad: entidad.tipo_entidad,
        persona_tipo: entidad.persona_tipo || 'Natural',
        tipo_identificacion: entidad.tipo_identificacion || detectTipoId(entidad.ruc_cedula || ''),
        email: entidad.email || '',
        telefono: entidad.telefono || '',
        direccion: entidad.direccion || ''
      });
      setEditingId(entidad.id);
    } else {
      setFormData({ ruc_cedula: '', razon_social: '', nombre: '', tipo_entidad: 'Proveedor', persona_tipo: 'Natural', tipo_identificacion: '04', email: '', telefono: '', direccion: '' });
      setEditingId(null);
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setFormData({ ruc_cedula: '', razon_social: '', nombre: '', tipo_entidad: 'Proveedor', persona_tipo: 'Natural', tipo_identificacion: '04', email: '', telefono: '', direccion: '' });
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const dataToSave = {
        ...formData,
        id_empresa: empresaId
      };

      if (editingId) {
        const { error } = await supabase.from('entidades').update(dataToSave).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('entidades').insert([dataToSave]);
        if (error) throw error;
      }
      await queryClient.invalidateQueries({ queryKey: ['entidades', empresaId] });
      handleCloseModal();
    } catch (error) {
      console.error("Error saving entity:", error);
      alert("Error al guardar la entidad. Verifica que el RUC no exista ya.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, razon_social: string) => {
    if (window.confirm(`¿Estás seguro de eliminar a ${razon_social}?`)) {
      const { error } = await supabase.from('entidades').delete().eq('id', id);
      if (error) {
        console.error("Error deleting:", error);
        alert("Error al eliminar. Podría estar en uso.");
      } else {
        await queryClient.invalidateQueries({ queryKey: ['entidades', empresaId] });
      }
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <header className="flex-between">
        <div>
          <h2 className="h1">Directorio de Terceros</h2>
          <p className="text-sec">Clientes, Proveedores y Empleados registrados.</p>
        </div>
        <div className="flex gap-8" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button 
            className="btn" 
            onClick={() => exportEntidadesPDF(empresaId, filtered)} 
            disabled={loading || filtered.length === 0}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 14px', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 800 }}
          >
            <Download size={18} /><span className="hide-mobile">Exportar a PDF</span>
          </button>
          <button 
            className="btn" 
            onClick={() => exportEntidadesExcel(filtered)} 
            disabled={loading || filtered.length === 0}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 14px', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 800 }}
          >
            <Download size={18} /><span className="hide-mobile">Exportar a Excel</span>
          </button>
          <button className="btn btn-primary" onClick={() => handleOpenModal()} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Plus size={18} /> Nueva Entidad
          </button>
        </div>
      </header>

      <div className="glass-card" style={{ padding: '0' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: '12px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-sec)', opacity: 0.6 }} />
            <input
              type="text"
              placeholder="Buscar por RUC o Razón Social..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>
        {loading ? (
          <div style={{ padding: '80px', textAlign: 'center' }}>
            <Loader2 className="animate-spin" size={32} style={{ margin: '0 auto', color: 'var(--primary)', opacity: 0.5 }} />
            <p className="text-sec" style={{ marginTop: '16px' }}>Cargando directorio...</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            {['Cliente', 'Proveedor', 'Empleado', 'Accionista'].map(tipo => {
              const entidadesGrupo = filtered.filter(e => e.tipo_entidad === tipo);
              if (entidadesGrupo.length === 0 && search === "") return null;

              const pluralLabel = tipo === 'Proveedor' ? 'Proveedores' : tipo + 's';

              return (
                <div key={tipo} className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
                  <div style={{ padding: '16px 24px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--primary)' }}>{pluralLabel}</h3>
                    <span className="text-sec" style={{ fontSize: '0.8rem', fontWeight: 600 }}>{entidadesGrupo.length} registros</span>
                  </div>

                  <div className="table-container">
                    {entidadesGrupo.length > 0 ? (
                      <>
                        <table className="data-table desktop-table">
                          <thead>
                            <tr>
                              <th>Nombre (Alias)</th>
                              <th>Razón Social</th>
                              <th>Identificación / RUC</th>
                              <th>Tipo ID SRI</th>
                              <th>Tipo Persona</th>
                              <th>Correo</th>
                              <th>Número de Celular</th>
                              <th style={{ textAlign: 'right' }}>Acciones</th>
                            </tr>
                          </thead>
                          <tbody>
                            {entidadesGrupo.map(e => {
                              const tipoIdLabel: Record<string, string> = {
                                '04': 'RUC', '05': 'Cédula', '06': 'Pasaporte',
                                '07': 'Consumidor Final', '08': 'Exterior', '09': 'Placa'
                              };
                              const tipoIdColor: Record<string, string> = {
                                '04': 'var(--primary)', '05': '#10b981', '06': '#8b5cf6',
                                '07': 'var(--text-sec)', '08': 'var(--warning)', '09': '#f43f5e'
                              };
                              const tid = e.tipo_identificacion || detectTipoId(e.ruc_cedula || '');
                              return (
                                <tr key={e.id}>
                                  <td style={tdStyle}>
                                    <div style={{ fontWeight: 700 }}>{e.nombre || '-'}</div>
                                  </td>
                                  <td style={tdStyle}>{e.razon_social}</td>
                                  <td style={tdStyle}><span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{e.ruc_cedula}</span></td>
                                  <td style={tdStyle}>
                                    <span style={{
                                      fontSize: '0.75rem', padding: '3px 10px', borderRadius: 20, fontWeight: 800,
                                      background: `${tipoIdColor[tid] || 'var(--primary)'}18`,
                                      color: tipoIdColor[tid] || 'var(--primary)'
                                    }}>
                                      {tid} — {tipoIdLabel[tid] || tid}
                                    </span>
                                  </td>
                                  <td style={tdStyle}><span style={{ fontSize: '0.8rem', opacity: 0.8 }}>{e.persona_tipo || 'Natural'}</span></td>
                                  <td style={tdStyle}>{e.email || '-'}</td>
                                  <td style={tdStyle}>{e.telefono || '-'}</td>
                                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                                      <button style={btnActionStyle} onClick={() => handleOpenModal(e)} title="Editar"><Edit2 size={16} /></button>
                                      <button style={{ ...btnActionStyle, color: 'var(--error)' }} onClick={() => handleDelete(e.id, e.razon_social)} title="Eliminar"><Trash2 size={16} /></button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>

                        <div className="mobile-card-list" style={{ borderTop: '1px solid var(--border-color)' }}>
                          {entidadesGrupo.map(e => (
                            <div key={e.id} className="entity-card">
                              <div className="flex-between" style={{ marginBottom: '4px' }}>
                                <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-main)' }}>{e.nombre || e.razon_social}</div>
                                <span style={{
                                  fontSize: '0.65rem',
                                  background: 'var(--primary-light)',
                                  color: 'var(--primary)',
                                  padding: '2px 8px',
                                  borderRadius: '6px',
                                  fontWeight: 700,
                                  textTransform: 'uppercase'
                                }}>{e.persona_tipo}</span>
                              </div>
                              <div className="text-sec" style={{ fontSize: '0.8rem', marginBottom: '12px', fontWeight: 600 }}>{e.ruc_cedula}</div>
                              <div className="flex-between" style={{ alignItems: 'center' }}>
                                <div style={{ display: 'flex', gap: '12px' }}>
                                  {e.email && <Mail size={16} className="text-sec" style={{ opacity: 0.6 }} />}
                                  {e.telefono && <Phone size={16} className="text-sec" style={{ opacity: 0.6 }} />}
                                </div>
                                <div style={{ display: 'flex', gap: '16px' }}>
                                  <button style={btnActionStyle} onClick={() => handleOpenModal(e)}><Edit2 size={18} /></button>
                                  <button style={{ ...btnActionStyle, color: 'var(--error)' }} onClick={() => handleDelete(e.id, e.razon_social)}><Trash2 size={18} /></button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-sec)', fontSize: '0.9rem' }}>
                        No se encontraron {pluralLabel.toLowerCase()}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="modal-overlay">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="modal-content glass-card"
              style={{ padding: '32px', width: '90%', maxWidth: '500px' }}
            >
              <div className="flex-between" style={{ marginBottom: '24px' }}>
                <h3 className="h1" style={{ fontSize: '1.5rem', margin: 0 }}>
                  {editingId ? 'Editar Entidad' : 'Nueva Entidad'}
                </h3>
                <button onClick={handleCloseModal} style={btnActionStyle}><X size={20} /></button>
              </div>
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                  <div>
                    <label style={labelStyle}>RUC o Cédula*</label>
                    <input required placeholder="Ej. 1790000000001" value={formData.ruc_cedula}
                      onChange={e => {
                        const val = e.target.value;
                        setFormData({ ...formData, ruc_cedula: val, tipo_identificacion: detectTipoId(val) });
                      }}
                      style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Tipo ID SRI*</label>
                    <select required value={formData.tipo_identificacion}
                      onChange={e => setFormData({ ...formData, tipo_identificacion: e.target.value })}
                      style={inputStyle}>
                      <option value="04">04 — RUC</option>
                      <option value="05">05 — Cédula de Identidad</option>
                      <option value="06">06 — Pasaporte</option>
                      <option value="07">07 — Consumidor Final</option>
                      <option value="08">08 — Identificación Exterior</option>
                      <option value="09">09 — Placa</option>
                    </select>
                    <div style={{ fontSize: '0.72rem', color: 'var(--primary)', marginTop: 4, fontWeight: 600 }}>Auto-detectado · puedes cambiarlo manualmente</div>
                  </div>
                  <div>
                    <label style={labelStyle}>Tipo de Entidad*</label>
                    <select required value={formData.tipo_entidad} onChange={e => setFormData({ ...formData, tipo_entidad: e.target.value })} style={inputStyle}>
                      <option value="Cliente">Cliente</option>
                      <option value="Proveedor">Proveedor</option>
                      <option value="Empleado">Empleado</option>
                      <option value="Accionista">Accionista</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Tipo de Persona*</label>
                    <select required value={formData.persona_tipo} onChange={e => setFormData({ ...formData, persona_tipo: e.target.value })} style={inputStyle}>
                      <option value="Natural">Natural</option>
                      <option value="Jurídica">Jurídica</option>
                      <option value="Extranjera">Extranjera</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-sec)' }}>Razón Social*</label>
                    <input required placeholder="Ej. Empresa S.A." value={formData.razon_social} onChange={e => setFormData({ ...formData, razon_social: e.target.value })} style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-sec)' }}>Nombre / Alias</label>
                    <input placeholder="Ej. Juan Pérez" value={formData.nombre} onChange={e => setFormData({ ...formData, nombre: e.target.value })} style={inputStyle} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-sec)' }}>Email</label>
                    <input type="email" placeholder="correo@ejemplo.com" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-sec)' }}>Teléfono</label>
                    <input type="tel" placeholder="099..." value={formData.telefono} onChange={e => setFormData({ ...formData, telefono: e.target.value })} style={inputStyle} />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-sec)' }}>Dirección</label>
                  <input placeholder="Ej. Av. Amazonas N32 y Coreya" value={formData.direccion} onChange={e => setFormData({ ...formData, direccion: e.target.value })} style={inputStyle} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                  <button type="button" onClick={handleCloseModal} className="btn glass-card" style={{ padding: '10px 20px', border: '1px solid var(--border-color)' }}>Cancelar</button>
                  <button type="submit" disabled={saving} className="btn btn-primary" style={{ padding: '10px 24px' }}>
                    {saving ? <Loader2 className="animate-spin" size={18} /> : (editingId ? 'Actualizar Entidad' : 'Guardar Entidad')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const tdStyle: CSSProperties = { padding: '16px' };
const btnActionStyle: CSSProperties = { background: 'none', border: 'none', color: 'var(--text-sec)', cursor: 'pointer', padding: '4px' };
const labelStyle: CSSProperties = { display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-sec)' };
const inputStyle: CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  background: 'var(--input-bg)',
  border: '1px solid var(--border-color)',
  borderRadius: '8px',
  color: 'var(--text-main)',
  outline: 'none',
  fontSize: '0.9rem'
};

