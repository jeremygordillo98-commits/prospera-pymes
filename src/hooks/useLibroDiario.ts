import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../services/supabase';
import { generatePDFReport, generateLibroDiarioPDF } from '../utils/pdfGenerator';

export interface Movement {
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

export interface Transaction {
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

export const getDocDetails = (tx: Transaction) => {
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

interface UseLibroDiarioProps {
  empresaId: string;
  activeView?: string;
}

export const useLibroDiario = ({ empresaId, activeView }: UseLibroDiarioProps) => {
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

  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => !filterDate || tx.fecha.startsWith(filterDate));
  }, [transactions, filterDate]);

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

      const sanitizedData = (data || []).map((item: any) => ({
        ...item,
        entidades: Array.isArray(item.entidades) ? item.entidades[0] : item.entidades,
        movimientos: (item.movimientos || []).map((m: any) => ({
          ...m,
          plan_cuentas: Array.isArray(m.plan_cuentas) ? m.plan_cuentas[0] : m.plan_cuentas
        }))
      }));

      const sortedData = sanitizedData.sort((a: any, b: any) => {
        const numA = parseInt(a.numero_comprobante?.trim() || '0', 10) || 0;
        const numB = parseInt(b.numero_comprobante?.trim() || '0', 10) || 0;
        if (numA !== numB) {
          return numB - numA;
        }
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

    if (!activeView || activeView === 'libro-diario') {
      fetchTransactions();
    }

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
    e.stopPropagation();
    
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
          
          const { error: txError } = await supabase
            .from('transacciones')
            .update({ 
              concepto: newConcepto,
              tipo_comprobante: 'Anulado'
            })
            .eq('id', tx.id);

          if (txError) throw txError;

          await supabase
            .from('movimientos')
            .delete()
            .eq('id_transaccion', tx.id);

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

          // Eliminar en Tesorería: la referencia es el número SRI (ej. 001-001-000001234),
          // no el número secuencial interno de la transacción.
          const conceptoForTeso = tx.concepto || '';
          const matchSriNum = conceptoForTeso.match(/(\d{3}-\d{3}-\d{9})/);
          const sriRefNum = matchSriNum ? matchSriNum[1] : null;

          if (sriRefNum) {
            await supabase
              .from('tesoreria_documentos')
              .delete()
              .eq('id_empresa', empresaId)
              .eq('referencia', sriRefNum);
          } else if (tx.numero_comprobante) {
            // Fallback: intentar con el número interno
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

              // Eliminar en Tesorería: la referencia es el número SRI (ej. 001-001-000001234),
              // no el número secuencial interno.
              const matchSriNumBulk = (tx.concepto || '').match(/(\d{3}-\d{3}-\d{9})/);
              const sriRefNumBulk = matchSriNumBulk ? matchSriNumBulk[1] : null;

              if (sriRefNumBulk) {
                await supabase
                  .from('tesoreria_documentos')
                  .delete()
                  .eq('id_empresa', empresaId)
                  .eq('referencia', sriRefNumBulk);
              } else if (tx.numero_comprobante) {
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

  const exportLibroDiarioPDF = async () => {
    let subtitle = 'Movimientos Contables Registrados';
    if (filterDate) {
      subtitle += ` | Período: ${filterDate}`;
    } else {
      subtitle += ' | Histórico Completo';
    }
    await generateLibroDiarioPDF(empresaId, 'Libro Diario General', subtitle, filteredTransactions);
  };

  return {
    loading,
    expandedTxs,
    filterDate,
    setFilterDate,
    selectedTxs,
    annulModal,
    setAnnulModal,
    annulReasonInput,
    setAnnulReasonInput,
    alertModal,
    setAlertModal,
    filteredTransactions,
    toggleExpand,
    handleAnular,
    toggleSelect,
    handleSelectAll,
    handleBulkAnular,
    exportToExcel,
    handleExportTxPDF,
    exportLibroDiarioPDF,
    showAlert
  };
};
