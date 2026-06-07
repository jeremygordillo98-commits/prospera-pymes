import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  FileText,
  Loader2,
  ChevronDown,
  ChevronUp,
  Download,
  Ban
} from 'lucide-react';
import { supabase } from '../services/supabase';
import { generatePDFReport } from '../utils/pdfGenerator';
import { CustomModal } from '../components/CustomModal';

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

const getDocDetails = (tx: Transaction) => {
  // Intentar extraer el secuencial formateado del concepto (ej: 001-002-000000123)
  const match = tx.concepto.match(/\d{3}-\d{3}-\d{9}/);
  const docNumber = match ? match[0] : null;

  if (docNumber) {
    let label = 'Ref';
    if (tx.tipo_comprobante === 'Factura') label = 'Factura';
    else if (tx.tipo_comprobante === 'Comprobante de Retención' || tx.tipo_comprobante?.includes('Retención') || tx.tipo_comprobante?.includes('Retencion')) label = 'Retención';
    else if (tx.tipo_comprobante === 'Nota de Crédito' || tx.tipo_comprobante?.includes('Crédito') || tx.tipo_comprobante?.includes('Credito')) label = 'Nota de Crédito';
    
    return `Comprobante #${tx.numero_comprobante} • ${label}: ${docNumber}`;
  }

  return `Comprobante #${tx.numero_comprobante}`;
};

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
  const [annulModal, setAnnulModal] = useState<{
    isOpen: boolean;
    step: 'confirm' | 'reason';
    confirmText: string;
    promptText: string;
    onSuccess: (reason: string) => void;
  }>({
    isOpen: false,
    step: 'confirm',
    confirmText: '',
    promptText: '',
    onSuccess: () => {}
  });
  const [annulReasonInput, setAnnulReasonInput] = useState('');
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info'
  });

  const showAlert = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    const title = type === 'success' ? 'Éxito' : type === 'error' ? 'Error' : type === 'warning' ? 'Advertencia' : 'Información';
    setAlertModal({ isOpen: true, title, message, type });
  };

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

      // Sort numerically by numero_comprobante in descending order (highest/latest first)
      const sortedData = sanitizedData.sort((a: any, b: any) => {
        const numA = parseInt(a.numero_comprobante?.trim() || '0', 10) || 0;
        const numB = parseInt(b.numero_comprobante?.trim() || '0', 10) || 0;
        if (numA !== numB) {
          return numB - numA;
        }
        // Fallback to date descending if numbers are equal or invalid
        return new Date(b.fecha).getTime() - new Date(a.fecha).getTime();
      });

      setTransactions(sortedData);

      if (sortedData.length > 0) {
        setExpandedTxs(new Set(sortedData.map((t: any) => t.id)));
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

  const handleAnular = (e: React.MouseEvent, tx: Transaction) => {
    e.stopPropagation(); // Evitar que expanda el acordeón
    
    setAnnulModal({
      isOpen: true,
      step: 'confirm',
      confirmText: `¿Estás seguro de anular el asiento contable #${tx.numero_comprobante}?\n\n"${tx.concepto}"\n\nSe conservará el registro con valores en cero para fines de auditoría y se eliminarán sus movimientos contables.`,
      promptText: 'Por favor, ingresa el motivo de la anulación:',
      onSuccess: async (reason) => {
        const ahora = new Date().toLocaleString('es-EC', { 
          day: '2-digit', 
          month: '2-digit', 
          year: 'numeric',
          hour: '2-digit', 
          minute: '2-digit', 
          second: '2-digit' 
        });

        try {
          const oldConcepto = tx.concepto || '';
          const cleanConcept = oldConcepto.startsWith('[ANULADO]') ? oldConcepto.replace(/^\[ANULADO\]\s*/, '') : oldConcepto;
          const newConcepto = `[ANULADO] Motivo: ${reason} | Fecha: ${ahora} | ${cleanConcept}`;
          
          // 1. Modificar la transacción
          const { error: txError } = await supabase
            .from('transacciones')
            .update({ 
              concepto: newConcepto,
              tipo_comprobante: 'Anulado'
            })
            .eq('id', tx.id);

          if (txError) throw txError;

          // 2. Eliminar movimientos
          await supabase
            .from('movimientos')
            .delete()
            .eq('id_transaccion', tx.id);

          // 3. Modificar documentos_sri si existe
          await supabase
            .from('documentos_sri')
            .update({ 
              base_12: 0,
              base_0: 0,
              base_no_objeto: 0,
              monto_iva: 0,
              retenciones_aplicadas: []
            })
            .eq('id_transaccion', tx.id);

          // 4. Eliminar de tesorería
          if (tx.numero_comprobante) {
            await supabase
              .from('tesoreria_documentos')
              .delete()
              .eq('id_empresa', empresaId)
              .eq('referencia', tx.numero_comprobante);
          }

          fetchTransactions();
          showAlert("Transacción anulada correctamente.", "success");

        } catch (err: any) {
          console.error("Error al anular la transacción:", err);
          showAlert(`Error al anular: ${err.message}`, "error");
        }
      }
    });
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

  const handleBulkAnular = () => {
    if (selectedTxs.size === 0) return;
    
    setAnnulModal({
      isOpen: true,
      step: 'confirm',
      confirmText: `¿Estás seguro de anular ${selectedTxs.size} asientos contables?\n\nSe conservarán los registros con valores en cero y se eliminarán sus movimientos contables.`,
      promptText: `Por favor, ingresa el motivo de la anulación para los ${selectedTxs.size} asientos contables:`,
      onSuccess: async (reason) => {
        const ahora = new Date().toLocaleString('es-EC', { 
          day: '2-digit', 
          month: '2-digit', 
          year: 'numeric',
          hour: '2-digit', 
          minute: '2-digit', 
          second: '2-digit' 
        });

        setLoading(true);
        try {
          const idsToAnular = Array.from(selectedTxs);
          
          const { data: txsData } = await supabase
            .from('transacciones')
            .select('id, concepto, numero_comprobante')
            .in('id', idsToAnular);

          if (txsData) {
            for (const tx of txsData) {
              const oldConcepto = tx.concepto || '';
              const cleanConcept = oldConcepto.startsWith('[ANULADO]') ? oldConcepto.replace(/^\[ANULADO\]\s*/, '') : oldConcepto;
              const newConcepto = `[ANULADO] Motivo: ${reason} | Fecha: ${ahora} | ${cleanConcept}`;
              
              await supabase
                .from('transacciones')
                .update({ 
                  concepto: newConcepto,
                  tipo_comprobante: 'Anulado'
                })
                .eq('id', tx.id);

              if (tx.numero_comprobante) {
                await supabase
                  .from('tesoreria_documentos')
                  .delete()
                  .eq('id_empresa', empresaId)
                  .eq('referencia', tx.numero_comprobante);
              }
            }
          }

          await supabase
            .from('movimientos')
            .delete()
            .in('id_transaccion', idsToAnular);

          await supabase
            .from('documentos_sri')
            .update({ 
              base_12: 0,
              base_0: 0,
              base_no_objeto: 0,
              monto_iva: 0,
              retenciones_aplicadas: []
            })
            .in('id_transaccion', idsToAnular);

          setSelectedTxs(new Set());
          fetchTransactions();
          showAlert("Asientos anulados correctamente.", "success");

        } catch (err: any) {
          console.error("Error al anular masivamente:", err);
          showAlert(`Error al anular: ${err.message}`, "error");
        } finally {
          setLoading(false);
        }
      }
    });
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
          `"${getDocDetails(tx)}"`,
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
    const subtitle = `Asiento del ${fechaFormat}\nConcepto: ${tx.concepto}\n${getDocDetails(tx)} | Tercero: ${tx.entidades?.razon_social || 'N/A'}`;

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
            <button className="btn" onClick={handleBulkAnular} style={{ background: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '10px 14px' }}>
              <Ban size={18} /> <span className="hide-mobile">Anular ({selectedTxs.size})</span>
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
          {filteredTransactions.map((tx) => {
            const isAnulado = tx.tipo_comprobante === 'Anulado';
            const match = tx.concepto.match(/^\[ANULADO\]\s*Motivo:\s*(.*?)\s*\|\s*Fecha:\s*(.*?)\s*\|\s*(.*)$/);
            const conceptoDisplay = isAnulado && match ? match[3] : (isAnulado ? tx.concepto.replace(/^\[ANULADO\]\s*/, '') : tx.concepto);
            return (
              <motion.div
                key={tx.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`glass-card ${isAnulado ? 'anulado' : ''}`}
                style={{ 
                  padding: '0', 
                  overflow: 'hidden', 
                  borderLeft: isAnulado ? '6px solid var(--error)' : 'none',
                  borderBottom: isAnulado
                    ? (expandedTxs.has(tx.id) ? '2px solid var(--error)' : '1px solid var(--error)')
                    : (expandedTxs.has(tx.id) ? '2px solid var(--primary)' : '1px solid var(--border-color)'),
                  opacity: isAnulado ? 0.8 : 1
                }}
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
                    <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {conceptoDisplay}
                      {isAnulado && (
                        <span style={{
                          fontSize: '9px',
                          color: 'var(--error)',
                          backgroundColor: 'rgba(239, 68, 68, 0.15)',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontWeight: 'bold',
                          letterSpacing: '0.5px',
                          textTransform: 'uppercase'
                        }}>
                          Anulado
                        </span>
                      )}
                    </h4>
                    <p className="text-sec" style={{ fontSize: '0.8rem', marginTop: '2px' }}>
                      {getDocDetails(tx)} • <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{tx.entidades?.razon_social || 'Entidad no def.'}</span>
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
                  {tx.tipo_comprobante !== 'Anulado' && (
                    <button
                      onClick={(e) => handleAnular(e, tx)}
                      className="p-2"
                      style={{ background: 'transparent', border: 'none', color: 'var(--warning)', cursor: 'pointer', opacity: 0.6 }}
                      title="Anular Asiento"
                      onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                      onMouseLeave={(e) => e.currentTarget.style.opacity = '0.6'}
                    >
                      <Ban size={20} />
                    </button>
                  )}
                  {expandedTxs.has(tx.id) ? <ChevronUp size={24} className="text-primary" /> : <ChevronDown size={24} className="text-sec" />}
                </div>
              </div>

              {expandedTxs.has(tx.id) && (
                <div style={{ padding: '0px 24px 24px', borderTop: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.01)' }}>
                  {isAnulado && (
                    <div style={{
                      marginTop: '16px',
                      padding: '12px 16px',
                      background: 'rgba(239, 68, 68, 0.06)',
                      border: '1px dashed var(--error)',
                      borderRadius: '10px',
                      color: 'var(--error)',
                      fontSize: '0.88rem',
                      fontWeight: 600,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Ban size={15} />
                        <span>Este asiento contable está ANULADO. Los movimientos contables fueron eliminados.</span>
                      </div>
                      {match && match[1] && (
                        <div style={{ marginLeft: '23px', fontSize: '0.82rem', color: 'var(--text-main)', marginTop: '4px' }}>
                          <strong style={{ color: 'var(--error)' }}>Motivo:</strong> {match[1]}
                          {match[2] && <span style={{ color: 'var(--text-sec)', marginLeft: '8px' }}>• Anulado el {match[2]}</span>}
                        </div>
                      )}
                    </div>
                  )}
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
                        <tr style={{ fontWeight: 900, background: isAnulado ? 'rgba(239, 68, 68, 0.05)' : 'rgba(99, 102, 241, 0.05)' }}>
                          <td colSpan={2} style={{ padding: '16px 12px', textAlign: 'right', fontSize: '0.8rem', textTransform: 'uppercase', borderRadius: '12px 0 0 12px' }}>Cuadre de Asiento</td>
                          <td style={{ padding: '16px 12px', textAlign: 'right', borderTop: isAnulado ? '2px solid var(--error)' : '2px solid var(--primary)', color: isAnulado ? 'var(--error)' : 'var(--primary)' }}>
                            ${tx.movimientos.reduce((acc, m) => acc + m.debe, 0).toFixed(2)}
                          </td>
                          <td style={{ padding: '16px 12px', textAlign: 'right', borderTop: isAnulado ? '2px solid var(--error)' : '2px solid var(--primary)', color: isAnulado ? 'var(--error)' : 'var(--primary)', borderRadius: '0 12px 12px 0' }}>
                            ${tx.movimientos.reduce((acc, m) => acc + m.haber, 0).toFixed(2)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
      )}

      {/* Reusable Modals */}
      <CustomModal
        isOpen={annulModal.isOpen && annulModal.step === 'confirm'}
        onClose={() => setAnnulModal(prev => ({ ...prev, isOpen: false }))}
        title="Confirmar Anulación"
        type="confirm"
        message={annulModal.confirmText}
        confirmLabel="Continuar"
        cancelLabel="Cancelar"
        onConfirm={() => setAnnulModal(prev => ({ ...prev, step: 'reason' }))}
      />

      <CustomModal
        isOpen={annulModal.isOpen && annulModal.step === 'reason'}
        onClose={() => {
          setAnnulModal(prev => ({ ...prev, isOpen: false }));
          setAnnulReasonInput('');
        }}
        title="Motivo de Anulación"
        type="prompt"
        message={annulModal.promptText}
        confirmLabel="Confirmar Anulación"
        cancelLabel="Cancelar"
        inputValue={annulReasonInput}
        onInputChange={setAnnulReasonInput}
        inputPlaceholder="Ej. Error de cuenta, digitación incorrecta..."
        onConfirm={() => {
          const reason = annulReasonInput.trim() || 'No especificado';
          annulModal.onSuccess(reason);
          setAnnulModal(prev => ({ ...prev, isOpen: false }));
          setAnnulReasonInput('');
        }}
      />

      <CustomModal
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal(prev => ({ ...prev, isOpen: false }))}
        title={alertModal.title}
        type={alertModal.type}
        message={alertModal.message}
        confirmLabel="Aceptar"
      />
    </div>
  );
};
