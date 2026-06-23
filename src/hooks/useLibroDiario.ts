import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../services/supabase';
import { runRepararAsientosTesoreria } from '../services/libroDiarioRepair';
import { exportToExcel, handleExportTxPDF, exportLibroDiarioPDF, getDocDetails } from '../utils/libroDiarioExport';

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

export { getDocDetails };

interface UseLibroDiarioProps {
  empresaId: string;
  activeView?: string;
}

export const useLibroDiario = ({ empresaId, activeView }: UseLibroDiarioProps) => {
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [expandedTxs, setExpandedTxs] = useState<Set<string>>(new Set());
  const [filterDate, setFilterDate] = useState<string>('');
  const [filterEntidad, setFilterEntidad] = useState<string>('');
  const [filterTipo, setFilterTipo] = useState<string>('');
  const [filterMontoMin, setFilterMontoMin] = useState<string>('');
  const [filterMontoMax, setFilterMontoMax] = useState<string>('');
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
    const minMonto = filterMontoMin !== '' ? parseFloat(filterMontoMin) : null;
    const maxMonto = filterMontoMax !== '' ? parseFloat(filterMontoMax) : null;
    return transactions.filter(tx => {
      // Filtro fecha
      if (filterDate && !tx.fecha.startsWith(filterDate)) return false;
      // Filtro entidad
      if (filterEntidad) {
        const razon = tx.entidades?.razon_social?.toLowerCase() || '';
        if (!razon.includes(filterEntidad.toLowerCase())) return false;
      }
      // Filtro tipo de comprobante
      if (filterTipo && tx.tipo_comprobante !== filterTipo) return false;
      // Filtro montos: suma total de débitos del asiento
      if (minMonto !== null || maxMonto !== null) {
        const totalDebe = (tx.movimientos || []).reduce((s, m) => s + (m.debe || 0), 0);
        if (minMonto !== null && totalDebe < minMonto) return false;
        if (maxMonto !== null && totalDebe > maxMonto) return false;
      }
      return true;
    });
  }, [transactions, filterDate, filterEntidad, filterTipo, filterMontoMin, filterMontoMax]);

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

      // Self-healing: identify any annulled transactions that still have movements
      const invalidAnnulledTxs = sanitizedData.filter((tx: any) => 
        tx.tipo_comprobante === 'Anulado' && tx.movimientos && tx.movimientos.length > 0
      );

      if (invalidAnnulledTxs.length > 0) {
        console.log("Self-healing: Deleting movements for annulled transactions:", invalidAnnulledTxs.map((t: any) => t.numero_comprobante));
        const invalidTxIds = invalidAnnulledTxs.map((tx: any) => tx.id);
        const { error: deleteError } = await supabase
          .from('movimientos')
          .delete()
          .in('id_transaccion', invalidTxIds);
        
        if (!deleteError) {
          const { data: refetchedData, error: refetchError } = await supabase
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

          if (!refetchError && refetchedData) {
            const reSanitizedData = refetchedData.map((item: any) => ({
              ...item,
              entidades: Array.isArray(item.entidades) ? item.entidades[0] : item.entidades,
              movimientos: (item.movimientos || []).map((m: any) => ({
                ...m,
                plan_cuentas: Array.isArray(m.plan_cuentas) ? m.plan_cuentas[0] : m.plan_cuentas
              }))
            }));
            const reSortedData = reSanitizedData.sort((a: any, b: any) => {
              const numA = parseInt(a.numero_comprobante?.trim() || '0', 10) || 0;
              const numB = parseInt(b.numero_comprobante?.trim() || '0', 10) || 0;
              if (numA !== numB) {
                return numB - numA;
              }
              return new Date(b.fecha).getTime() - new Date(a.fecha).getTime();
            });
            setTransactions(reSortedData);
            if (reSortedData.length > 0) {
              setExpandedTxs(new Set(reSortedData.map((t: any) => t.id)));
            }
            setLoading(false);
            return;
          }
        }
      }

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

  const handleExportExcel = () => {
    exportToExcel(filteredTransactions, filterDate);
  };

  const handleExportPDF = async (e: React.MouseEvent, tx: Transaction) => {
    e.stopPropagation();
    await handleExportTxPDF(empresaId, tx);
  };

  const handleExportLibroPDF = async () => {
    await exportLibroDiarioPDF(empresaId, filterDate, filteredTransactions);
  };

  const [reparing, setReparing] = useState(false);

  const emptyTxsCount = useMemo(() => {
    return filteredTransactions.filter(tx => 
      tx.tipo_comprobante !== 'Anulado' && 
      tx.movimientos.length === 0 && 
      (tx.concepto.includes('de Tesorería') || tx.concepto.includes('Pago CxC') || tx.tipo_comprobante === 'Egreso' || tx.tipo_comprobante === 'Ingreso')
    ).length;
  }, [filteredTransactions]);

  const incorrectTxsCount = useMemo(() => {
    return filteredTransactions.filter(tx => {
      if (tx.tipo_comprobante === 'Anulado') return false;
      if (tx.movimientos.length === 0) return false;
      const codes = tx.movimientos.map(m => m.plan_cuentas?.codigo_cuenta);
      if (tx.movimientos.length === 2 && codes.includes('1.1.1') && codes.includes('1.1.4.3')) return true;
      const esTesoreria = tx.concepto.includes('de Tesorería') || tx.concepto.includes('Pago CxC') || tx.tipo_comprobante === 'Egreso' || tx.tipo_comprobante === 'Ingreso';
      if (esTesoreria && (codes.includes('2.1.1') || codes.includes('2.1') || codes.includes('2'))) return true;
      return false;
    }).length;
  }, [filteredTransactions]);

  const repararAsientosTesoreria = async () => {
    await runRepararAsientosTesoreria(
      empresaId,
      transactions,
      showAlert,
      setReparing,
      fetchTransactions
    );
  };

  return {
    loading,
    expandedTxs,
    filterDate,
    setFilterDate,
    filterEntidad,
    setFilterEntidad,
    filterTipo,
    setFilterTipo,
    filterMontoMin,
    setFilterMontoMin,
    filterMontoMax,
    setFilterMontoMax,
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
    exportToExcel: handleExportExcel,
    handleExportTxPDF: handleExportPDF,
    exportLibroDiarioPDF: handleExportLibroPDF,
    showAlert,
    repararAsientosTesoreria,
    reparing,
    emptyTxsCount,
    incorrectTxsCount
  };
};
