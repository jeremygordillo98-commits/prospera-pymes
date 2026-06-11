import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../services/supabase';

export interface DocSRI {
  id: string;
  clave_acceso_xml: string;
  base_12: number;
  base_0: number;
  base_no_objeto: number;
  monto_iva: number;
  retenciones_aplicadas: Array<{ 
    base: number; 
    valor: number; 
    tipo: string; 
    codigo?: string | number; 
    porcentaje?: number; 
    numero_retencion?: string; 
    fecha_retencion?: string; 
  }> | null;
  created_at: string;
  transacciones: {
    id: string;
    fecha: string;
    concepto: string;
    tipo_comprobante: string;
    numero_comprobante: string;
    entidades?: { nombre: string; ruc_cedula: string } | null;
  } | null;
}

interface UseSRIAutomationProps {
  tipo: 'Compras' | 'Ventas';
  empresaId: string;
}

export const useSRIAutomation = ({ tipo, empresaId }: UseSRIAutomationProps) => {
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [documentos, setDocumentos] = useState<DocSRI[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTipo, setFilterTipo] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const prevUploadOpen = useRef(false);

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

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedDocForWithholding, setSelectedDocForWithholding] = useState<DocSRI | null>(null);
  const [viewingDoc, setViewingDoc] = useState<DocSRI | null>(null);
  const [editingDoc, setEditingDoc] = useState<DocSRI | null>(null);

  const showAlert = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    const title = type === 'success' ? 'Éxito' : type === 'error' ? 'Error' : type === 'warning' ? 'Advertencia' : 'Información';
    setAlertModal({ isOpen: true, title, message, type });
  };

  const showConfirm = (message: string, onConfirm: () => void, title: string = 'Confirmar') => {
    setConfirmModal({ isOpen: true, title, message, onConfirm });
  };

  const fetchAccounts = async () => {
    if (!empresaId) return;
    const { data } = await supabase
      .from('plan_cuentas')
      .select('id, codigo_cuenta, nombre, tipo')
      .eq('id_empresa', empresaId)
      .eq('acepta_movimientos', true)
      .order('codigo_cuenta');
    if (data) {
      setAccounts(data);
    }
  };

  const fetchDocumentos = useCallback(async () => {
    if (!empresaId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('documentos_sri')
        .select(`
          id, clave_acceso_xml, base_12, base_0, base_no_objeto, monto_iva, retenciones_aplicadas, created_at,
          transacciones (
            id, fecha, concepto, tipo_comprobante, numero_comprobante,
            entidades ( nombre, ruc_cedula )
          )
        `)
        .eq('id_empresa', empresaId)
        .eq('es_compra', tipo === 'Compras')
        .order('created_at', { ascending: false });

      if (!error && data) {
        setDocumentos(data as any);

        data.forEach(async (doc: any) => {
          const isFactNC = doc.transacciones?.tipo_comprobante === 'Factura' || doc.transacciones?.tipo_comprobante === 'Nota de Crédito';
          const docBase12 = parseFloat(doc.base_12) || 0;
          const docMontoIva = parseFloat(doc.monto_iva) || 0;
          
          if (isFactNC && docBase12 === 0 && docMontoIva > 0 && doc.transacciones?.id) {
            try {
              const { data: movs } = await supabase
                .from('movimientos')
                .select('debe, haber')
                .eq('id_transaccion', doc.transacciones.id);
              
              if (movs && movs.length > 0) {
                const ivaMov = movs.find(m => parseFloat(m.debe) === docMontoIva);
                const expenseMovs = movs.filter(m => parseFloat(m.debe) > 0 && m !== ivaMov);
                const actualBase = expenseMovs.reduce((sum, m) => sum + (parseFloat(m.debe) || 0), 0);

                if (actualBase > 0) {
                  await supabase
                    .from('documentos_sri')
                    .update({ base_12: actualBase })
                    .eq('id', doc.id);
                  
                  setDocumentos(prev => prev.map(d => d.id === doc.id ? { ...d, base_12: actualBase } : d));
                }
              }
            } catch (e) {
              console.error("Self-healing failed for doc:", doc.id, e);
            }
          }
        });
      }
    } catch (err) {
      console.error('Error fetching documentos SRI:', err);
    } finally {
      setLoading(false);
    }
  }, [empresaId, tipo]);

  // Carga inicial
  useEffect(() => {
    fetchDocumentos();
    fetchAccounts();
  }, [fetchDocumentos, empresaId]);

  // Refetch cuando se cierra el panel de carga masiva
  useEffect(() => {
    if (prevUploadOpen.current && !isUploadOpen) {
      fetchDocumentos();
    }
    prevUploadOpen.current = isUploadOpen;
  }, [isUploadOpen, fetchDocumentos]);

  // Refetch cuando el usuario vuelve a la pestaña del navegador
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && !isUploadOpen) {
        fetchDocumentos();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [fetchDocumentos, isUploadOpen]);

  // Supabase Realtime
  useEffect(() => {
    if (!empresaId) return;
    const channel = supabase
      .channel(`documentos_sri_${empresaId}_${tipo}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'documentos_sri',
          filter: `id_empresa=eq.${empresaId}`
        },
        () => {
          fetchDocumentos();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [empresaId, tipo, fetchDocumentos]);

  const handleAnular = (doc: DocSRI) => {
    setAnnulModal({
      isOpen: true,
      step: 'confirm',
      confirmText: `¿Estás seguro de anular el comprobante ${doc.transacciones?.numero_comprobante || ''}? Se conservará el registro con valores en cero para el reporte del SRI (ATS), se anularán sus movimientos contables en el Libro Diario y se eliminará/anulará su saldo en Tesorería.`,
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

        setDeletingId(doc.id);
        try {
          const idTransaccion = doc.transacciones?.id;
          
          if (idTransaccion) {
            const oldConcepto = doc.transacciones?.concepto || '';
            const cleanConcept = oldConcepto.startsWith('[ANULADO]') ? oldConcepto.replace(/^\[ANULADO\]\s*/, '') : oldConcepto;
            const newConcepto = `[ANULADO] Motivo: ${reason} | Fecha: ${ahora} | ${cleanConcept}`;
            
            const valoresOriginales = JSON.stringify({
              base_12: doc.base_12 || 0,
              base_0: doc.base_0 || 0,
              base_no_objeto: doc.base_no_objeto || 0,
              monto_iva: doc.monto_iva || 0,
              retenciones_aplicadas: doc.retenciones_aplicadas || []
            });
            
            const conceptoConValores = `${newConcepto} | ValoresOriginales: ${valoresOriginales}`;
        
            await supabase
              .from('transacciones')
              .update({ 
                concepto: conceptoConValores,
                tipo_comprobante: 'Anulado'
              })
              .eq('id', idTransaccion);
            
            await supabase
              .from('movimientos')
              .delete()
              .eq('id_transaccion', idTransaccion);
          }

          await supabase
            .from('documentos_sri')
            .update({ 
              base_12: 0,
              base_0: 0,
              base_no_objeto: 0,
              monto_iva: 0,
              retenciones_aplicadas: []
            })
            .eq('id', doc.id);

          if (doc.transacciones?.numero_comprobante) {
            await supabase
              .from('tesoreria_documentos')
              .delete()
              .eq('id_empresa', empresaId)
              .eq('referencia', doc.transacciones.numero_comprobante);
          }

          setAlertModal({
            isOpen: true,
            title: 'Éxito',
            message: 'Comprobante anulado exitosamente contable y tributariamente.',
            type: 'success'
          });
          fetchDocumentos();
        } catch (err) {
          console.error('Error voiding doc:', err);
          setAlertModal({
            isOpen: true,
            title: 'Error',
            message: 'Error al anular el documento.',
            type: 'error'
          });
        } finally {
          setDeletingId(null);
        }
      }
    });
  };

  // Filtrado
  const filtered = documentos.filter(doc => {
    const concepto = doc.transacciones?.concepto?.toLowerCase() || '';
    const numero = doc.transacciones?.numero_comprobante?.toLowerCase() || '';
    const entidad = doc.transacciones?.entidades?.nombre?.toLowerCase() || '';
    const matchSearch = !search || concepto.includes(search.toLowerCase()) || numero.includes(search.toLowerCase()) || entidad.includes(search.toLowerCase());
    const matchTipo = !filterTipo || doc.transacciones?.tipo_comprobante === filterTipo;
    const notAnulado = doc.transacciones?.tipo_comprobante !== 'Anulado';
    return matchSearch && matchTipo && notAnulado;
  });

  return {
    isUploadOpen,
    setIsUploadOpen,
    documentos,
    loading,
    search,
    setSearchTerm: setSearch,
    filterTipo,
    setFilterTipo,
    currentPage,
    setCurrentPage,
    deletingId,
    annulModal,
    setAnnulModal,
    annulReasonInput,
    setAnnulReasonInput,
    alertModal,
    setAlertModal,
    confirmModal,
    setConfirmModal,
    accounts,
    selectedDocForWithholding,
    setSelectedDocForWithholding,
    viewingDoc,
    setViewingDoc,
    editingDoc,
    setEditingDoc,
    showAlert,
    showConfirm,
    fetchDocumentos,
    handleAnular,
    filtered
  };
};
