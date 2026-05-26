import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { parseSRIXML } from '../utils/sriParser';
import { CATALOGO_RETENCIONES_RENTA } from '../utils/sriCatalog';
import { saveXMLBatchToSupabase } from '../services/xmlSaveService';

export interface Account {
  id: string;
  codigo_cuenta: string;
  nombre: string;
  tipo: string;
}

export interface BatchItem {
  file?: File;
  fileName: string;
  fileSize: number;
  parsed: any | null;
  entidadId: string | null;
  status: 'ready' | 'missing_entity' | 'error';
  idCuentaDebe: string;
  idCuentaHaber: string;
  idCuentaIva: string;
  idCuentaRetencion: string;
  retencionCodigo: string;
  errorMsg?: string;
}

export const useXMLUpload = (
  empresaId: string,
  isOpen: boolean,
  onClose: () => void,
  onSuccess: () => void
) => {
  const [parsing, setParsing] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const [batchSaving, setBatchSaving] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);

  // Cargar cuentas contables
  const fetchAccounts = async () => {
    if (!empresaId || empresaId === 'undefined') return;
    try {
      const { data } = await supabase
        .from('plan_cuentas')
        .select('id, codigo_cuenta, nombre, tipo')
        .eq('id_empresa', empresaId)
        .eq('acepta_movimientos', true)
        .order('codigo_cuenta');

      if (data) {
        setAccounts(data);
      }
    } catch (err) {
      console.error("Error fetching accounts:", err);
    }
  };

  useEffect(() => {
    if (isOpen && empresaId) {
      fetchAccounts();
    }
  }, [isOpen, empresaId]);

  // Limpiar lote borrador
  const clearDraft = () => {
    if (empresaId && empresaId !== 'undefined') {
      localStorage.removeItem(`pymes_xml_upload_draft_${empresaId}`);
    }
    setBatchItems([]);
  };

  // Guardar borrador en localStorage cuando cambian los datos
  useEffect(() => {
    if (!isOpen || !empresaId || empresaId === 'undefined') return;
    
    const draft = {
      batchItems: batchItems.map(item => ({
        parsed: item.parsed,
        entidadId: item.entidadId,
        status: item.status,
        idCuentaDebe: item.idCuentaDebe,
        idCuentaHaber: item.idCuentaHaber,
        idCuentaIva: item.idCuentaIva,
        idCuentaRetencion: item.idCuentaRetencion,
        retencionCodigo: item.retencionCodigo,
        errorMsg: item.errorMsg,
        fileName: item.fileName,
        fileSize: item.fileSize
      }))
    };
    
    localStorage.setItem(`pymes_xml_upload_draft_${empresaId}`, JSON.stringify(draft));
  }, [isOpen, empresaId, batchItems]);

  // Restaurar borrador de XML desde localStorage
  useEffect(() => {
    if (isOpen && empresaId && empresaId !== 'undefined') {
      const saved = localStorage.getItem(`pymes_xml_upload_draft_${empresaId}`);
      if (saved) {
        try {
          const draft = JSON.parse(saved);
          if (draft.batchItems && draft.batchItems.length > 0) {
            const restoredBatch = draft.batchItems.map((item: any) => ({
              parsed: item.parsed,
              entidadId: item.entidadId,
              status: item.status,
              idCuentaDebe: item.idCuentaDebe,
              idCuentaHaber: item.idCuentaHaber,
              idCuentaIva: item.idCuentaIva,
              idCuentaRetencion: item.idCuentaRetencion,
              retencionCodigo: item.retencionCodigo,
              errorMsg: item.errorMsg,
              fileName: item.fileName,
              fileSize: item.fileSize,
              file: undefined
            }));
            setBatchItems(restoredBatch);
          } else {
            setBatchItems([]);
          }
        } catch (err) {
          console.error("Error restoring XML upload draft:", err);
        }
      }
    }
  }, [isOpen, empresaId]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files || []);
    if (droppedFiles.length === 0) return;
    
    const xmlFiles = droppedFiles.filter(f => f.name.toLowerCase().endsWith('.xml'));
    if (xmlFiles.length === 0) {
      alert("Por favor arrastra únicamente archivos XML.");
      return;
    }
    
    const mockEvent = {
      target: {
        files: xmlFiles as any
      }
    } as any;
    
    await handleFileChange(mockEvent);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    setParsing(true);

    // Cargar defaults contables
    const defaultGasto = accounts.find(a => a.codigo_cuenta.startsWith('5')) || accounts[0];
    const defaultPago = accounts.find(a => a.codigo_cuenta.startsWith('2.1.3')) || accounts[0];
    const defaultRetencion = accounts.find(a => a.codigo_cuenta.startsWith('2.1.4') || a.nombre.toLowerCase().includes('retencion')) || accounts[0];
    const defaultIva = accounts.find(a => a.codigo_cuenta.startsWith('1.1.09') || a.nombre.toLowerCase().includes('iva pagado') || a.nombre.toLowerCase().includes('crédito tributario')) || accounts[0];

    const newItems: BatchItem[] = [];

    for (const f of selectedFiles) {
      try {
        const text = await f.text();
        const parsed = await parseSRIXML(text);
        if (parsed) {
          const { data: entidadData } = await supabase
            .from('entidades')
            .select('id')
            .eq('ruc_cedula', parsed.rucEmisor)
            .eq('id_empresa', empresaId)
            .maybeSingle();

          newItems.push({
            file: f,
            fileName: f.name,
            fileSize: f.size,
            parsed,
            entidadId: entidadData?.id || null,
            status: entidadData?.id ? 'ready' : 'missing_entity',
            idCuentaDebe: parsed.tipoDocumento === 'COM_RETENCION' 
              ? (accounts.find(a => a.codigo_cuenta.startsWith('1.1.3') || a.nombre.toLowerCase().includes('anticipo'))?.id || defaultGasto?.id || '') 
              : (parsed.tipoDocumento === 'NOTA_CREDITO' ? (accounts.find(a => a.codigo_cuenta.startsWith('4'))?.id || defaultGasto?.id || '') : defaultGasto?.id || ''),
            idCuentaHaber: parsed.tipoDocumento === 'COM_RETENCION' || parsed.tipoDocumento === 'NOTA_CREDITO'
              ? (accounts.find(a => a.codigo_cuenta.startsWith('1.1.2') || a.nombre.toLowerCase().includes('cliente'))?.id || defaultPago?.id || '')
              : defaultPago?.id || '',
            idCuentaIva: defaultIva?.id || '',
            idCuentaRetencion: defaultRetencion?.id || '',
            retencionCodigo: CATALOGO_RETENCIONES_RENTA[0].codigo,
          });
        } else {
          newItems.push({
            fileName: f.name,
            fileSize: f.size,
            parsed: null,
            entidadId: null,
            status: 'error',
            errorMsg: 'XML no posee estructura SRI válida.',
            idCuentaDebe: '',
            idCuentaHaber: '',
            idCuentaIva: '',
            idCuentaRetencion: '',
            retencionCodigo: ''
          });
        }
      } catch (err: any) {
        newItems.push({
          fileName: f.name,
          fileSize: f.size,
          parsed: null,
          entidadId: null,
          status: 'error',
          errorMsg: err.message || 'Error al leer archivo.',
          idCuentaDebe: '',
          idCuentaHaber: '',
          idCuentaIva: '',
          idCuentaRetencion: '',
          retencionCodigo: ''
        });
      }
    }

    setBatchItems(prev => [...prev, ...newItems]);
    setParsing(false);
    e.target.value = '';
  };

  const autoCreateAllEntities = async () => {
    let updated = [...batchItems];
    for (let i = 0; i < updated.length; i++) {
      const item = updated[i];
      if (item.status === 'missing_entity' && item.parsed) {
        try {
          const { data, error } = await supabase
            .from('entidades')
            .insert({
              ruc_cedula: item.parsed.rucEmisor,
              razon_social: item.parsed.razonSocialEmisor,
              nombre: item.parsed.razonSocialEmisor,
              tipo_entidad: 'Proveedor',
              persona_tipo: item.parsed.rucEmisor.length === 10 ? 'Natural' : 'Jurídica',
              id_empresa: empresaId
            })
            .select()
            .single();
          if (data && !error) {
            updated[i] = {
              ...item,
              entidadId: data.id,
              status: 'ready'
            };
          }
        } catch (err) {
          console.error("Error auto-creating entity", err);
        }
      }
    }
    setBatchItems(updated);
  };

  const handleSaveBatch = async () => {
    const readyItems = batchItems.filter(item => item.parsed && item.status === 'ready');
    if (readyItems.length === 0) {
      alert("No hay documentos listos para guardar. Asegúrate de registrar todas las entidades.");
      return;
    }

    // Validar cuentas
    for (const item of readyItems) {
      const parsedAny = item.parsed as any;
      const isFact = parsedAny.tipoDocumento === 'FACTURA';
      const isNC = parsedAny.tipoDocumento === 'NOTA_CREDITO';
      const ivaMonto = (isFact || isNC) ? (parsedAny.iva || 0) : 0;
      
      if (!item.idCuentaDebe || !item.idCuentaHaber) {
        alert(`Por favor selecciona las cuentas de Debe y Haber para el comprobante ${parsedAny.numeroComprobante}`);
        return;
      }
      if (ivaMonto > 0 && !item.idCuentaIva) {
        alert(`Por favor selecciona la cuenta de IVA para la factura ${parsedAny.numeroComprobante}`);
        return;
      }
      
      const retSel = CATALOGO_RETENCIONES_RENTA.find(r => r.codigo === item.retencionCodigo) || CATALOGO_RETENCIONES_RENTA[0];
      const valRetCalculado = isFact ? parseFloat(((parsedAny.baseImponible * retSel.porcentaje) / 100).toFixed(2)) : 0;
      if (isFact && valRetCalculado > 0 && !item.idCuentaRetencion) {
        alert(`Por favor selecciona la cuenta contable de Retención para la factura ${parsedAny.numeroComprobante}`);
        return;
      }
    }
    
    setBatchSaving(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sesión no válida");

      await saveXMLBatchToSupabase(
        empresaId,
        readyItems.map(item => ({
          parsed: item.parsed,
          entidadId: item.entidadId!,
          idCuentaDebe: item.idCuentaDebe,
          idCuentaHaber: item.idCuentaHaber,
          idCuentaIva: item.idCuentaIva,
          idCuentaRetencion: item.idCuentaRetencion,
          retencionCodigo: item.retencionCodigo
        })),
        user.id,
        (progress) => setBatchProgress(progress)
      );

      setTimeout(() => {
        onSuccess();
        onClose();
        clearDraft();
        setBatchSaving(false);
      }, 500);

    } catch (err: any) {
      alert(`Error al guardar documentos: ${err.message}`);
      setBatchSaving(false);
    }
  };

  const handleUpdateItem = (idx: number, updatedItem: BatchItem) => {
    setBatchItems(prev => prev.map((item, i) => i === idx ? updatedItem : item));
  };

  const handleDeleteItem = (idx: number) => {
    setBatchItems(prev => prev.filter((_, i) => i !== idx));
  };

  return {
    parsing,
    accounts,
    batchItems,
    batchSaving,
    batchProgress,
    isDragOver,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleFileChange,
    autoCreateAllEntities,
    handleSaveBatch,
    handleUpdateItem,
    handleDeleteItem,
    clearDraft
  };
};
