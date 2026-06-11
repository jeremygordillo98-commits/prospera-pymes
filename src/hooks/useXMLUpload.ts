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
  tipo: 'Compras' | 'Ventas',
  isOpen: boolean,
  onClose: () => void,
  onSuccess: () => void
) => {
  const [parsing, setParsing] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const [rucEmpresa, setRucEmpresa] = useState<string>('');
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
        const rawAccounts = data || [];
        const allCodes = rawAccounts.map(a => a.codigo_cuenta);
        const leafAccounts = rawAccounts.filter(acc => {
          const code = acc.codigo_cuenta;
          const hasChildren = allCodes.some(c => c.startsWith(code + '.'));
          return !hasChildren;
        });
        setAccounts(leafAccounts);
      }
    } catch (err) {
      console.error("Error fetching accounts:", err);
    }
  };

  useEffect(() => {
    if (isOpen && empresaId) {
      fetchAccounts();
      // Cargar RUC de la empresa
      supabase
        .from('empresas_gestionadas')
        .select('ruc_empresa')
        .eq('id', empresaId)
        .single()
        .then(({ data }) => {
          if (data?.ruc_empresa) {
            setRucEmpresa(data.ruc_empresa);
          }
        });
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

    let currentRuc = rucEmpresa;
    if (!currentRuc && empresaId) {
      try {
        const { data } = await supabase
          .from('empresas_gestionadas')
          .select('ruc_empresa')
          .eq('id', empresaId)
          .single();
        if (data?.ruc_empresa) {
          currentRuc = data.ruc_empresa;
          setRucEmpresa(currentRuc);
        }
      } catch (e) {
        console.error("Error fetching company RUC:", e);
      }
    }

    for (const f of selectedFiles) {
      try {
        const text = await f.text();
        const parsed = await parseSRIXML(text);
        if (parsed) {
          // Validar el tipo de documento contra la sección (RUC Check)
          if (tipo === 'Ventas' && currentRuc && parsed.rucEmisor !== currentRuc) {
            newItems.push({
              fileName: f.name,
              fileSize: f.size,
              parsed: null,
              entidadId: null,
              status: 'error',
              errorMsg: `Este documento fue emitido por ${parsed.razonSocialEmisor} (RUC ${parsed.rucEmisor}). No corresponde a una venta de tu empresa. Por favor súbelo en XML Compras.`,
              idCuentaDebe: '',
              idCuentaHaber: '',
              idCuentaIva: '',
              idCuentaRetencion: '',
              retencionCodigo: ''
            });
            continue;
          }

          if (tipo === 'Compras' && currentRuc && parsed.rucReceptor !== currentRuc) {
            newItems.push({
              fileName: f.name,
              fileSize: f.size,
              parsed: null,
              entidadId: null,
              status: 'error',
              errorMsg: `Este documento no fue emitido a tu RUC. Fue emitido a RUC ${parsed.rucReceptor}. Por favor súbelo en la empresa correspondiente.`,
              idCuentaDebe: '',
              idCuentaHaber: '',
              idCuentaIva: '',
              idCuentaRetencion: '',
              retencionCodigo: ''
            });
            continue;
          }

          const targetRuc = tipo === 'Ventas' ? parsed.rucReceptor : parsed.rucEmisor;

          const { data: entidadData } = await supabase
            .from('entidades')
            .select('id')
            .eq('ruc_cedula', targetRuc)
            .eq('id_empresa', empresaId)
            .maybeSingle();

          // Defaults contables según tipo
          const isFact = parsed.tipoDocumento === 'FACTURA';
          const isNC = parsed.tipoDocumento === 'NOTA_CREDITO';
          const isRet = parsed.tipoDocumento === 'COM_RETENCION';

          let debeAccount = '';
          let haberAccount = '';
          let ivaAccount = '';

          if (tipo === 'Ventas') {
            // Ventas:
            // Para Factura: Debe = Clientes (1.1.2), Haber = Ingresos (4)
            // Para NC: Debe = Devoluciones/Ventas (4), Haber = Clientes (1.1.2)
            // Para Retención: Debe = Anticipos (1.1.3), Haber = Clientes (1.1.2)
            const clientAcc = accounts.find(a => a.codigo_cuenta.startsWith('1.1.2') || a.nombre.toLowerCase().includes('cliente'))?.id || defaultPago?.id || '';
            const revenueAcc = accounts.find(a => a.codigo_cuenta.startsWith('4'))?.id || defaultGasto?.id || '';
            const anticipoAcc = accounts.find(a => a.codigo_cuenta.startsWith('1.1.3') || a.nombre.toLowerCase().includes('anticipo'))?.id || defaultGasto?.id || '';

            if (isFact) {
              debeAccount = clientAcc;
              haberAccount = revenueAcc;
            } else if (isNC) {
              debeAccount = revenueAcc;
              haberAccount = clientAcc;
            } else if (isRet) {
              debeAccount = anticipoAcc;
              haberAccount = clientAcc;
            }

            ivaAccount = accounts.find(a => a.codigo_cuenta.startsWith('2') && (a.nombre.toLowerCase().includes('cobrado') || a.nombre.toLowerCase().includes('ventas') || a.nombre.toLowerCase().includes('por pagar')))?.id || defaultIva?.id || '';
          } else {
            // Compras:
            // Para Factura: Debe = Gastos (5), Haber = Proveedores (2.1.3)
            // Para NC: Debe = Proveedores (2.1.3), Haber = Gastos (5)
            // Para Retención: Debe = Proveedores (2.1.3), Haber = Retenciones por Pagar (2.1.4)
            if (isFact) {
              debeAccount = defaultGasto?.id || '';
              haberAccount = defaultPago?.id || '';
            } else if (isNC) {
              debeAccount = defaultPago?.id || '';
              haberAccount = accounts.find(a => a.codigo_cuenta.startsWith('1.1.2') || a.nombre.toLowerCase().includes('cliente'))?.id || defaultPago?.id || '';
            } else if (isRet) {
              debeAccount = accounts.find(a => a.codigo_cuenta.startsWith('1.1.3') || a.nombre.toLowerCase().includes('anticipo'))?.id || defaultGasto?.id || '';
              haberAccount = defaultPago?.id || '';
            }

            ivaAccount = defaultIva?.id || '';
          }

          newItems.push({
            file: f,
            fileName: f.name,
            fileSize: f.size,
            parsed,
            entidadId: entidadData?.id || null,
            status: entidadData?.id ? 'ready' : 'missing_entity',
            idCuentaDebe: debeAccount,
            idCuentaHaber: haberAccount,
            idCuentaIva: ivaAccount,
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
          const targetRuc = tipo === 'Ventas' ? item.parsed.rucReceptor : item.parsed.rucEmisor;
          const targetName = tipo === 'Ventas' ? (item.parsed.razonSocialReceptor || 'Cliente Desconocido') : item.parsed.razonSocialEmisor;
          const targetTipo = tipo === 'Ventas' ? 'Cliente' : 'Proveedor';

          const { data, error } = await supabase
            .from('entidades')
            .insert({
              ruc_cedula: targetRuc,
              razon_social: targetName,
              nombre: targetName,
              tipo_entidad: targetTipo,
              persona_tipo: targetRuc.length === 10 ? 'Natural' : 'Jurídica',
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
        tipo,
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
