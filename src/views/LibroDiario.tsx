import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  FileText,
  Loader2,
  ChevronDown,
  ChevronUp,
  Download,
  Trash2
} from 'lucide-react';
import { supabase } from '../services/supabase';
import { generatePDFReport } from '../utils/pdfGenerator';

interface Movement {
  id: string;
  id_transaccion: string;
  id_cuenta: string;
  debe: number;
  haber: number;
  plan_cuentas: {
    nombre: string;
    codigo_cuenta: string;
  };
}

interface Transaction {
  id: string;
  fecha: string;
  concepto: string;
  tipo_comprobante: string;
  numero_comprobante: string;
  id_entidad: string;
  entidades: {
    razon_social: string;
  } | null;
  movimientos: Movement[];
}

interface LibroDiarioProps {
  empresaId: string;
  activeView?: string;
}

export const LibroDiario: React.FC<LibroDiarioProps> = ({ empresaId, activeView }) => {
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [expandedTxs, setExpandedTxs] = useState<Set<string>>(new Set());
  const [filterDate, setFilterDate] = useState<string>('');
  const [selectedTxs, setSelectedTxs] = useState<Set<string>>(new Set());

  const filteredTransactions = transactions.filter(tx => !filterDate || tx.fecha.startsWith(filterDate));

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
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
          entidades (razon_social),
          movimientos (
            id,
            id_transaccion,
            id_cuenta,
            debe,
            haber,
            plan_cuentas (nombre, codigo_cuenta)
          )
        `)
        .eq('id_empresa', empresaId)
        .order('fecha', { ascending: false });

      if (error) throw error;

      // Handle potential type mismatch from Supabase many-to-one
      // We ensure it matches our Transaction interface
      const sanitizedData = (data || []).map((item: any) => ({
        ...item,
        entidades: Array.isArray(item.entidades) ? item.entidades[0] : item.entidades,
        movimientos: (item.movimientos || []).map((m: any) => ({
          ...m,
          plan_cuentas: Array.isArray(m.plan_cuentas) ? m.plan_cuentas[0] : m.plan_cuentas
        }))
      }));

      setTransactions(sanitizedData);

      if (sanitizedData.length > 0) {
        setExpandedTxs(new Set(sanitizedData.map((t: any) => t.id)));
      }
    } catch (err) {
      console.error("Error fetching transactions:", err);
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  useEffect(() => {
    if (!empresaId) return;

    // Recargar transacciones cuando el Libro Diario se enfoca
    if (!activeView || activeView === 'libro-diario') {
      fetchTransactions();
    }

    // Suscribirse a cambios en tiempo real en la tabla de transacciones de Supabase
    const channelTx = supabase
      .channel(`transacciones_diario_${empresaId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transacciones',
          filter: `id_empresa=eq.${empresaId}`
        },
        () => {
          fetchTransactions();
        }
      )
      .subscribe();

    // Suscribirse a cambios en tiempo real en la tabla de movimientos de Supabase
    const channelMov = supabase
      .channel(`movimientos_diario_${empresaId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'movimientos',
          filter: `id_empresa=eq.${empresaId}`
        },
        () => {
          fetchTransactions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channelTx);
      supabase.removeChannel(channelMov);
    };
  }, [empresaId, activeView, fetchTransactions]);

  const toggleExpand = (id: string) => {
    const next = new Set(expandedTxs);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedTxs(next);
  };

  const handleDelete = async (e: React.MouseEvent, tx: Transaction) => {
    e.stopPropagation(); // Evitar que expanda el acordeón
    if (!window.confirm(`¿Estás seguro de eliminar el asiento contable por completo?\n\n"${tx.concepto}"\n\nEsto también borrará la cuenta por pagar/cobrar de Tesorería asociada si fue generada automáticamente.`)) return;

    try {
      // 1. Intentar borrar de tesoreria_documentos usando la referencia (numero_comprobante)
      if (tx.numero_comprobante) {
        await supabase
          .from('tesoreria_documentos')
          .delete()
          .eq('id_empresa', empresaId)
          .eq('referencia', tx.numero_comprobante);
      }

      // 2. Borrar la transacción (Supabase por defecto hace Delete Cascade a movimientos y documentos_sri)
      const { error } = await supabase
        .from('transacciones')
        .delete()
        .eq('id', tx.id);

      if (error) throw error;

      // 3. Actualizar el estado local para quitarrla de la pantalla de inmediato
      setTransactions(prev => prev.filter(t => t.id !== tx.id));

    } catch (err: any) {
      console.error("Error al eliminar la transacción:", err);
      alert(`Error al eliminar: ${err.message}`);
    }
  };

  const toggleSelect = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const next = new Set(selectedTxs);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedTxs(next);
  };

  const handleSelectAll = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (selectedTxs.size === filteredTransactions.length && filteredTransactions.length > 0) {
      setSelectedTxs(new Set());
    } else {
      setSelectedTxs(new Set(filteredTransactions.map(tx => tx.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedTxs.size === 0) return;
    if (!window.confirm(`¿Estás seguro de eliminar ${selectedTxs.size} asientos contables de forma permanente?\n\nEsto también borrará las cuentas por pagar/cobrar de Tesorería asociadas si fueron generadas automáticamente.`)) return;

    try {
      const txsToDelete = filteredTransactions.filter(tx => selectedTxs.has(tx.id));
      const referencias = txsToDelete.map(tx => tx.numero_comprobante).filter(Boolean);

      if (referencias.length > 0) {
        await supabase
          .from('tesoreria_documentos')
          .delete()
          .eq('id_empresa', empresaId)
          .in('referencia', referencias);
      }

      const idsToDelete = Array.from(selectedTxs);
      const { error } = await supabase
        .from('transacciones')
        .delete()
        .in('id', idsToDelete);

      if (error) throw error;

      setTransactions(prev => prev.filter(t => !selectedTxs.has(t.id)));
      setSelectedTxs(new Set());

    } catch (err: any) {
      console.error("Error al eliminar masivamente:", err);
      alert(`Error al eliminar: ${err.message}`);
    }
  };

  const exportToExcel = () => {
    const rows = [
      ['Fecha', 'Concepto', 'Comprobante', 'Entidad', 'Codigo Cuenta', 'Nombre Cuenta', 'Debe', 'Haber']
    ];
    filteredTransactions.forEach(tx => {
      tx.movimientos.forEach(m => {
        rows.push([
          tx.fecha,
          `"${tx.concepto.replace(/"/g, '""')}"`,
          `"${tx.tipo_comprobante} #${tx.numero_comprobante}"`,
          `"${tx.entidades?.razon_social || ''}"`,
          m.plan_cuentas?.codigo_cuenta || '',
          `"${m.plan_cuentas?.nombre || ''}"`,
          m.debe.toString(),
          m.haber.toString()
        ]);
      });
    });
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Libro_Diario_${filterDate || 'Historico'}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleExportTxPDF = async (e: React.MouseEvent, tx: Transaction) => {
    e.stopPropagation();

    const columns = ['Código', 'Cuenta Contable', 'Debe', 'Haber'];
    const rows = tx.movimientos.map(m => [
      m.plan_cuentas?.codigo_cuenta || '',
      m.plan_cuentas?.nombre || '',
      m.debe > 0 ? `$${m.debe.toFixed(2)}` : '-',
      m.haber > 0 ? `$${m.haber.toFixed(2)}` : '-'
    ]);

    const totalDebe = tx.movimientos.reduce((acc, m) => acc + m.debe, 0);
    const totalHaber = tx.movimientos.reduce((acc, m) => acc + m.haber, 0);

    const foot = [[
      '', 'TOTAL ASIENTO',
      `$${totalDebe.toFixed(2)}`,
      `$${totalHaber.toFixed(2)}`
    ]];

    const fechaFormat = new Date(tx.fecha).toLocaleDateString('es-EC');
    const subtitle = `Asiento del ${fechaFormat}\nConcepto: ${tx.concepto}\n${tx.tipo_comprobante} #${tx.numero_comprobante} | Tercero: ${tx.entidades?.razon_social || 'N/A'}`;

    await generatePDFReport(empresaId, 'Detalle de Asiento Contable', subtitle, columns, rows, foot);
  };

  return (
    <div className="libro-diario-container">
      <header className="flex-between" style={{ marginBottom: '40px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', fontWeight: 800, textTransform: 'uppercase', fontSize: '0.8rem', letterSpacing: '2px', marginBottom: '8px' }}>
            <FileText size={14} /> Contabilidad Oficial
          </div>
          <h1 className="h1" style={{ fontSize: '2.5rem', fontWeight: 900 }}>Libro Diario</h1>
          <p className="text-sec" style={{ fontSize: '1.1rem' }}>Registro cronológico de todos los movimientos contables.</p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          {selectedTxs.size > 0 && (
            <button className="btn" onClick={handleBulkDelete} style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '10px 14px' }}>
              <Trash2 size={18} /> <span className="hide-mobile">Eliminar ({selectedTxs.size})</span>
            </button>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '10px 14px', background: 'var(--input-bg)', borderRadius: '12px', border: '1px solid var(--border-color)' }} onClick={handleSelectAll}>
            <input
              type="checkbox"
              readOnly
              checked={filteredTransactions.length > 0 && selectedTxs.size === filteredTransactions.length}
              style={{ width: '16px', height: '16px', accentColor: 'var(--primary)', cursor: 'pointer' }}
            />
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }} className="hide-mobile">Seleccionar Todo</span>
          </div>

          <div style={{ position: 'relative' }}>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              style={{ padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-main)', outline: 'none' }}
            />
          </div>
          {filterDate && (
            <button onClick={() => setFilterDate('')} className="btn glass-card" style={{ padding: '10px' }}>Limpiar</button>
          )}
          <button className="btn btn-primary" onClick={exportToExcel} disabled={filteredTransactions.length === 0}>
            <Download size={18} /> <span className="hide-mobile">Exportar a Excel</span>
          </button>
        </div>
      </header>

      {loading ? (
        <div className="flex-center" style={{ padding: '100px 0' }}>
          <Loader2 className="animate-spin text-primary" size={40} />
        </div>
      ) : transactions.length === 0 ? (
        <div className="glass-card text-center" style={{ padding: '80px 20px' }}>
          <div style={{ width: 64, height: 64, background: 'var(--primary-light)', color: 'var(--primary)', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
            <FileText size={32} />
          </div>
          <h2 className="h1">Sin Asientos Contables</h2>
          <p className="text-sec" style={{ maxWidth: '400px', margin: '16px auto' }}>
            Aún no has registrado transacciones para esta empresa. Comienza subiendo un XML o registrando un asiento manual.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {filteredTransactions.map((tx) => (
            <motion.div
              key={tx.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card"
              style={{ padding: '0', overflow: 'hidden', borderBottom: expandedTxs.has(tx.id) ? '2px solid var(--primary)' : '1px solid var(--border-color)' }}
            >
              <div
                className="flex-between"
                style={{ padding: '20px 24px', cursor: 'pointer', background: expandedTxs.has(tx.id) ? 'rgba(99, 102, 241, 0.03)' : 'transparent' }}
                onClick={() => toggleExpand(tx.id)}
              >
                <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                  <div onClick={(e) => toggleSelect(e, tx.id)} style={{ display: 'flex', alignItems: 'center', padding: '4px' }}>
                    <input
                      type="checkbox"
                      checked={selectedTxs.has(tx.id)}
                      readOnly
                      style={{ width: '18px', height: '18px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                    />
                  </div>
                  <div style={{ textAlign: 'center', minWidth: '60px' }}>
                    <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-sec)', fontWeight: 800 }}>{new Date(tx.fecha).toLocaleString('es-EC', { month: 'short' })}</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 900 }}>{new Date(tx.fecha).getUTCDate()}</div>
                  </div>

                  <div style={{ height: '30px', width: '1px', background: 'var(--border-color)' }}></div>

                  <div style={{ maxWidth: '300px' }}>
                    <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tx.concepto}</h4>
                    <p className="text-sec" style={{ fontSize: '0.8rem', marginTop: '2px' }}>
                      {tx.tipo_comprobante} #{tx.numero_comprobante} • <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{tx.entidades?.razon_social || 'Entidad no def.'}</span>
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-sec)', fontWeight: 800 }}>Monto Operación</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--primary)' }}>
                      ${tx.movimientos.reduce((acc, m) => acc + m.debe, 0).toFixed(2)}
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleExportTxPDF(e, tx)}
                    className="p-2"
                    style={{ background: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer', opacity: 0.6 }}
                    title="Exportar a PDF"
                    onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                    onMouseLeave={(e) => e.currentTarget.style.opacity = '0.6'}
                  >
                    <Download size={20} />
                  </button>
                  <button
                    onClick={(e) => handleDelete(e, tx)}
                    className="p-2"
                    style={{ background: 'transparent', border: 'none', color: 'var(--error)', cursor: 'pointer', opacity: 0.6 }}
                    title="Eliminar Asiento"
                    onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                    onMouseLeave={(e) => e.currentTarget.style.opacity = '0.6'}
                  >
                    <Trash2 size={20} />
                  </button>
                  {expandedTxs.has(tx.id) ? <ChevronUp size={24} className="text-primary" /> : <ChevronDown size={24} className="text-sec" />}
                </div>
              </div>

              {expandedTxs.has(tx.id) && (
                <div style={{ padding: '0px 24px 24px', borderTop: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.01)' }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '16px', minWidth: '400px' }}>
                      <thead>
                        <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>
                          <th style={{ padding: '12px 0', fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-sec)' }}>Código</th>
                          <th style={{ padding: '12px 0', fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-sec)' }}>Cuenta Contable</th>
                          <th style={{ padding: '12px 0', fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-sec)', textAlign: 'right' }}>Debe</th>
                          <th style={{ padding: '12px 0', fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-sec)', textAlign: 'right' }}>Haber</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tx.movimientos.map((m) => (
                          <tr key={m.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                            <td style={{ padding: '12px 0', fontSize: '0.85rem', color: 'var(--text-sec)', fontStyle: 'italic' }}>{m.plan_cuentas?.codigo_cuenta}</td>
                            <td style={{ padding: '12px 0', fontSize: '0.9rem', fontWeight: 600 }}>{m.plan_cuentas?.nombre}</td>
                            <td style={{ padding: '12px 0', fontSize: '0.9rem', textAlign: 'right', fontWeight: m.debe > 0 ? 900 : 400, color: m.debe > 0 ? 'var(--text-main)' : 'var(--text-sec)' }}>{m.debe > 0 ? `$${m.debe.toFixed(2)}` : '-'}</td>
                            <td style={{ padding: '12px 0', fontSize: '0.9rem', textAlign: 'right', fontWeight: m.haber > 0 ? 900 : 400, color: m.haber > 0 ? 'var(--text-main)' : 'var(--text-sec)' }}>{m.haber > 0 ? `$${m.haber.toFixed(2)}` : '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{ fontWeight: 900, background: 'rgba(99, 102, 241, 0.05)' }}>
                          <td colSpan={2} style={{ padding: '16px 12px', textAlign: 'right', fontSize: '0.8rem', textTransform: 'uppercase', borderRadius: '12px 0 0 12px' }}>Cuadre de Asiento</td>
                          <td style={{ padding: '16px 12px', textAlign: 'right', borderTop: '2px solid var(--primary)', color: 'var(--primary)' }}>
                            ${tx.movimientos.reduce((acc, m) => acc + m.debe, 0).toFixed(2)}
                          </td>
                          <td style={{ padding: '16px 12px', textAlign: 'right', borderTop: '2px solid var(--primary)', color: 'var(--primary)', borderRadius: '0 12px 12px 0' }}>
                            ${tx.movimientos.reduce((acc, m) => acc + m.haber, 0).toFixed(2)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};
