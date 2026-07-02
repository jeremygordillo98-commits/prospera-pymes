import { useState, useEffect } from 'react';
import type { CSSProperties } from 'react';
import { supabase } from '../services/supabase';
import { 
  Plus, 
  Search, 
  Loader2,
  Trash2,
  Edit2,
  Lock,
  X,
  ChevronRight,
  ChevronDown,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { exportPlanCuentasExcel, exportPlanCuentasPDF } from '../utils/planCuentasExport';

export const PlanCuentas = ({ empresaId }: { empresaId: string }) => {
  const [cuentas, setCuentas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedCodes, setExpandedCodes] = useState<Set<string>>(new Set());

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    codigo_cuenta: '',
    nombre: '',
    tipo: 'Activo',
    acepta_movimientos: true
  });
  const [saving, setSaving] = useState(false);

  // Helper algorithms for hierarchy
  const getParentCode = (code: string) => {
    const parts = code.split('.');
    if (parts.length <= 1) return null;
    return parts.slice(0, -1).join('.');
  };

  const parentCodesWithChildren = new Set<string>();
  cuentas.forEach(c => {
    const pCode = getParentCode(c.codigo_cuenta);
    if (pCode) parentCodesWithChildren.add(pCode);
  });

  const fetchCuentas = async () => {
    if (!empresaId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('plan_cuentas')
      .select('*')
      .eq('id_empresa', empresaId)
      .order('codigo_cuenta', { ascending: true });
    
    if (!error && data) {
      setCuentas(data);
      // Auto-expand levels 1 and 2 by default
      const initialExpanded = new Set<string>();
      data.forEach((c: any) => {
        const level = c.codigo_cuenta.split('.').length;
        if (level <= 2) {
          initialExpanded.add(c.codigo_cuenta);
        }
      });
      setExpandedCodes(initialExpanded);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCuentas();
  }, [empresaId]);

  // Expand / collapse single node
  const toggleExpand = (code: string) => {
    setExpandedCodes(prev => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  };

  // Expand all parent nodes
  const expandAll = () => {
    const allParents = new Set<string>();
    cuentas.forEach(c => {
      const pCode = getParentCode(c.codigo_cuenta);
      if (pCode) allParents.add(pCode);
    });
    setExpandedCodes(allParents);
  };

  // Collapse all nodes (show only level 1)
  const collapseAll = () => {
    setExpandedCodes(new Set());
  };

  // Smart Search logic
  const isSearchActive = search.trim() !== "";
  const searchLower = search.toLowerCase();

  // Find exact search matches
  const exactMatches = cuentas.filter(c =>
    c.nombre.toLowerCase().includes(searchLower) ||
    c.codigo_cuenta.includes(searchLower)
  );

  // Set of codes that should be visible during search (exact matches + all their ancestors)
  const visibleCodesInSearch = new Set<string>();
  const searchExpandedCodes = new Set<string>();

  if (isSearchActive) {
    exactMatches.forEach(c => {
      visibleCodesInSearch.add(c.codigo_cuenta);
      let parentCode = getParentCode(c.codigo_cuenta);
      while (parentCode !== null) {
        visibleCodesInSearch.add(parentCode);
        searchExpandedCodes.add(parentCode);
        parentCode = getParentCode(parentCode);
      }
    });
  }

  // Set of all codes present in the database to prevent orphaned nodes
  const existingCodes = new Set(cuentas.map(c => c.codigo_cuenta));

  // Determine if ancestors of a node are expanded
  const areAncestorsExpanded = (code: string, expandedSet: Set<string>, existingSet: Set<string>): boolean => {
    let parentCode = getParentCode(code);
    while (parentCode !== null) {
      if (existingSet.has(parentCode) && !expandedSet.has(parentCode)) {
        return false;
      }
      parentCode = getParentCode(parentCode);
    }
    return true;
  };

  // Filter accounts list to display
  const visibleCuentas = cuentas.filter(c => {
    if (isSearchActive) {
      return visibleCodesInSearch.has(c.codigo_cuenta);
    } else {
      return areAncestorsExpanded(c.codigo_cuenta, expandedCodes, existingCodes);
    }
  });

  const handleOpenModal = (cuenta?: any) => {
    if (cuenta) {
      setFormData({
        codigo_cuenta: cuenta.codigo_cuenta,
        nombre: cuenta.nombre,
        tipo: cuenta.tipo,
        acepta_movimientos: cuenta.acepta_movimientos
      });
      setEditingId(cuenta.id);
    } else {
      setFormData({ codigo_cuenta: '', nombre: '', tipo: 'Activo', acepta_movimientos: true });
      setEditingId(null);
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setFormData({ codigo_cuenta: '', nombre: '', tipo: 'Activo', acepta_movimientos: true });
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingId) {
        const { error } = await supabase.from('plan_cuentas').update(formData).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('plan_cuentas').insert([{ ...formData, id_empresa: empresaId }]);
        if (error) throw error;
      }
      await fetchCuentas();
      handleCloseModal();
    } catch (error) {
      console.error("Error saving account:", error);
      alert("Error al guardar la cuenta. Verifica que el código no exista ya.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, nombre: string) => {
    if (window.confirm(`¿Estás seguro de eliminar la cuenta ${nombre}?`)) {
      const { error } = await supabase.from('plan_cuentas').delete().eq('id', id);
      if (error) {
        console.error("Error deleting:", error);
        alert("Error al eliminar. Podría tener movimientos asociados.");
      } else {
        fetchCuentas();
      }
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <header className="flex-between">
        <div>
          <h2 className="h1">Plan de Cuentas</h2>
          <p className="text-sec">Estructura contable organizada.</p>
        </div>
        <div className="flex gap-8" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button 
            className="btn" 
            onClick={() => exportPlanCuentasPDF(empresaId, cuentas)} 
            disabled={loading || cuentas.length === 0}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 14px', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 800 }}
          >
            <Download size={18} /><span className="hide-mobile">Exportar a PDF</span>
          </button>
          <button 
            className="btn" 
            onClick={() => exportPlanCuentasExcel(cuentas)} 
            disabled={loading || cuentas.length === 0}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 14px', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 800 }}
          >
            <Download size={18} /><span className="hide-mobile">Exportar a Excel</span>
          </button>
          <button className="btn btn-primary" onClick={() => handleOpenModal()} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Plus size={18} /> Nueva Cuenta
          </button>
        </div>
      </header>

      <div className="glass-card" style={{ padding: '0' }}>
        <div style={{ 
          padding: '20px', 
          borderBottom: '1px solid var(--border-color)', 
          display: 'flex', 
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: '12px', 
          alignItems: 'center' 
        }}>
          <div style={{ position: 'relative', flex: '1 1 300px' }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-sec)', opacity: 0.6 }} />
            <input 
              type="text" 
              placeholder="Buscar por código o nombre..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button 
              onClick={expandAll}
              className="btn"
              style={{
                padding: '8px 16px',
                fontSize: '0.85rem',
                border: '1px solid var(--border-color)',
                background: 'rgba(255,255,255,0.02)',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: 600,
                color: 'var(--text-main)',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
            >
              Expandir
            </button>
            <button 
              onClick={collapseAll}
              className="btn"
              style={{
                padding: '8px 16px',
                fontSize: '0.85rem',
                border: '1px solid var(--border-color)',
                background: 'rgba(255,255,255,0.02)',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: 600,
                color: 'var(--text-main)',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
            >
              Contraer
            </button>
          </div>
        </div>

        <div className="table-container">
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center' }}>
              <Loader2 className="animate-spin" size={24} style={{ margin: '0 auto', color: 'var(--primary)' }} />
            </div>
          ) : (
            <>
              {/* Tabla para Desktop */}
              <table className="data-table desktop-table">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Nombre de Cuenta</th>
                    <th>Tipo</th>
                    <th>Movimientos</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleCuentas.map(c => {
                    const level = c.codigo_cuenta.split('.').length;
                    const isParent = parentCodesWithChildren.has(c.codigo_cuenta);
                    const isExpanded = isSearchActive 
                      ? searchExpandedCodes.has(c.codigo_cuenta) || expandedCodes.has(c.codigo_cuenta) 
                      : expandedCodes.has(c.codigo_cuenta);
                    const isGroup = !c.acepta_movimientos;
                    const indent = (level - 1) * 24;
                    const isExactMatch = isSearchActive && (
                      c.nombre.toLowerCase().includes(searchLower) ||
                      c.codigo_cuenta.includes(searchLower)
                    );

                    return (
                      <tr 
                        key={c.id} 
                        className="hover:bg-white/5 transition-colors"
                        style={{
                          background: isExactMatch ? 'var(--primary-light)' : undefined,
                          borderLeft: isExactMatch ? '3px solid var(--primary)' : '3px solid transparent'
                        }}
                      >
                        <td style={tdStyle}>
                          <span style={{ 
                            fontWeight: isGroup ? 800 : 600, 
                            color: isGroup ? 'var(--primary)' : 'var(--text-sec)', 
                            opacity: isGroup ? 1 : 0.8,
                            letterSpacing: '0.05em' 
                          }}>
                            {c.codigo_cuenta}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, paddingLeft: `${indent + 16}px` }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {isParent ? (
                              <button 
                                onClick={() => toggleExpand(c.codigo_cuenta)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: 'var(--text-sec)',
                                  cursor: 'pointer',
                                  padding: '2px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  borderRadius: '4px',
                                  transition: 'background-color 0.2s',
                                }}
                                className="hover:bg-white/10"
                              >
                                {isExpanded ? <ChevronDown size={16} className="text-primary" /> : <ChevronRight size={16} />}
                              </button>
                            ) : (
                              <span style={{ width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.3 }}>
                                •
                              </span>
                            )}
                            <span style={{ 
                              fontWeight: isGroup ? 700 : 400,
                              color: isGroup ? 'var(--text-main)' : 'var(--text-sec)',
                              fontSize: isGroup ? '0.95rem' : '0.9rem'
                            }}>
                              {c.nombre}
                            </span>
                            {isGroup && (
                              <span style={{ 
                                fontSize: '0.65rem', 
                                background: 'rgba(255,255,255,0.05)', 
                                border: '1px solid var(--border-color)', 
                                color: 'var(--text-sec)', 
                                padding: '1px 6px', 
                                borderRadius: '4px',
                                marginLeft: '8px',
                                fontWeight: 500
                              }}>
                                Grupo
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={tdStyle}>
                          <span style={{ fontSize: '0.75rem', opacity: 0.8, background: 'var(--primary-light)', color: 'var(--primary)', padding: '2px 8px', borderRadius: '4px' }}>
                            {c.tipo}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {c.acepta_movimientos ? 
                              <span style={{ color: 'var(--success)', fontSize: '0.75rem' }}>Si</span> : 
                              <span style={{ opacity: 0.4, display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem' }}><Lock size={12} /> No</span>
                            }
                          </div>
                        </td>
                        <td style={tdStyle}>
                          <div style={{ display: 'flex', gap: '12px' }}>
                            <button style={btnActionStyle} onClick={() => handleOpenModal(c)}><Edit2 size={16} /></button>
                            <button style={{ ...btnActionStyle, color: 'var(--error)' }} onClick={() => handleDelete(c.id, c.nombre)}><Trash2 size={16} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {visibleCuentas.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-sec)' }}>
                        No se encontraron cuentas.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Lista para Móvil */}
              <div className="mobile-card-list">
                {visibleCuentas.map(c => {
                  const level = c.codigo_cuenta.split('.').length;
                  const isParent = parentCodesWithChildren.has(c.codigo_cuenta);
                  const isExpanded = isSearchActive 
                    ? searchExpandedCodes.has(c.codigo_cuenta) || expandedCodes.has(c.codigo_cuenta) 
                    : expandedCodes.has(c.codigo_cuenta);
                  const isGroup = !c.acepta_movimientos;
                  const indent = (level - 1) * 12;
                  const isExactMatch = isSearchActive && (
                    c.nombre.toLowerCase().includes(searchLower) ||
                    c.codigo_cuenta.includes(searchLower)
                  );

                  return (
                    <div 
                      key={c.id} 
                      className="entity-card"
                      style={{
                        marginLeft: `${indent}px`,
                        borderLeft: isExactMatch 
                          ? '3px solid var(--primary)' 
                          : isGroup 
                            ? '3px solid rgba(255,255,255,0.15)' 
                            : '3px solid transparent',
                        background: isExactMatch ? 'var(--primary-light)' : undefined,
                        transition: 'all 0.2s ease',
                        padding: '16px'
                      }}
                    >
                      <div className="flex-between" style={{ marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {isParent && (
                            <button 
                              onClick={() => toggleExpand(c.codigo_cuenta)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-sec)',
                                cursor: 'pointer',
                                padding: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: '4px'
                              }}
                            >
                              {isExpanded ? <ChevronDown size={16} className="text-primary" /> : <ChevronRight size={16} />}
                            </button>
                          )}
                          <span style={{ 
                            fontWeight: isGroup ? 800 : 600, 
                            color: isGroup ? 'var(--primary)' : 'var(--text-sec)', 
                            fontSize: '0.85rem',
                            letterSpacing: '0.05em' 
                          }}>
                            {c.codigo_cuenta}
                          </span>
                        </div>
                        <span style={{ 
                          fontSize: '0.65rem', 
                          background: 'var(--primary-light)', 
                          color: 'var(--primary)', 
                          padding: '2px 8px', 
                          borderRadius: '6px',
                          fontWeight: 700,
                          textTransform: 'uppercase'
                        }}>
                          {c.tipo}
                        </span>
                      </div>
                      
                      <div 
                        onClick={() => isParent && toggleExpand(c.codigo_cuenta)}
                        style={{ 
                          fontWeight: isGroup ? 700 : 500, 
                          fontSize: '0.95rem', 
                          marginBottom: '12px', 
                          color: isGroup ? 'var(--text-main)' : 'var(--text-sec)',
                          cursor: isParent ? 'pointer' : 'default',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <span>{c.nombre}</span>
                        {isGroup && (
                          <span style={{ 
                            fontSize: '0.6rem', 
                            background: 'rgba(255,255,255,0.05)', 
                            border: '1px solid var(--border-color)', 
                            color: 'var(--text-sec)', 
                            padding: '1px 4px', 
                            borderRadius: '4px',
                            fontWeight: 500
                          }}>
                            Grupo
                          </span>
                        )}
                      </div>

                      <div className="flex-between" style={{ alignItems: 'center' }}>
                        <div style={{ fontSize: '0.75rem' }}>
                          {c.acepta_movimientos ? 
                            <span style={{ color: 'var(--success)', fontWeight: 600 }}>● Acepta Mov.</span> : 
                            <span style={{ opacity: 0.5, display: 'flex', alignItems: 'center', gap: '4px' }}><Lock size={12} /> Solo Grupo</span>
                          }
                        </div>
                        <div style={{ display: 'flex', gap: '16px' }}>
                          <button style={btnActionStyle} onClick={() => handleOpenModal(c)}><Edit2 size={18} /></button>
                          <button style={{ ...btnActionStyle, color: 'var(--error)' }} onClick={() => handleDelete(c.id, c.nombre)}><Trash2 size={18} /></button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {visibleCuentas.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-sec)' }}>
                    No se encontraron cuentas.
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal para Crear / Editar Cuenta */}
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
                  {editingId ? 'Editar Cuenta' : 'Nueva Cuenta'}
                </h3>
                <button onClick={handleCloseModal} style={btnActionStyle}><X size={20} /></button>
              </div>

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-sec)' }}>Código de Cuenta*</label>
                    <input required placeholder="Ej. 1.1.01" value={formData.codigo_cuenta} onChange={e => setFormData({...formData, codigo_cuenta: e.target.value})} style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-sec)' }}>Tipo de Cuenta*</label>
                    <select required value={formData.tipo} onChange={e => setFormData({...formData, tipo: e.target.value})} style={inputStyle}>
                        <option value="Activo">Activo</option>
                        <option value="Pasivo">Pasivo</option>
                        <option value="Patrimonio">Patrimonio</option>
                        <option value="Ingreso">Ingreso</option>
                        <option value="Gasto">Gasto</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-sec)' }}>Nombre de Cuenta*</label>
                  <input required placeholder="Ej. Caja General" value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} style={inputStyle} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'var(--primary-light)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                  <input 
                    type="checkbox" 
                    id="acepta_movimientos"
                    checked={formData.acepta_movimientos} 
                    onChange={e => setFormData({...formData, acepta_movimientos: e.target.checked})}
                    style={{ width: '20px', height: '20px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                  />
                  <label htmlFor="acepta_movimientos" style={{ fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer' }}>Acepta Movimientos (Subcuenta)</label>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                  <button type="button" onClick={handleCloseModal} className="btn glass-card" style={{ padding: '10px 20px', border: '1px solid var(--border-color)' }}>Cancelar</button>
                  <button type="submit" disabled={saving} className="btn btn-primary" style={{ padding: '10px 24px' }}>
                    {saving ? <Loader2 className="animate-spin" size={18} /> : 'Guardar Cuenta'}
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
const inputStyle: CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  background: 'var(--input-bg)',
  border: '1px solid var(--border-color)',
  borderRadius: '8px',
  color: 'var(--text-main)',
  outline: 'none',
  fontSize: '0.9rem',
  fontFamily: 'inherit'
};
