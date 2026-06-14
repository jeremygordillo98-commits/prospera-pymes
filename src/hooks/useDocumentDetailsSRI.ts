import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabase';
import { parseSRIXML } from '../utils/sriParser';
import { CATALOGO_RETENCIONES_RENTA, CATALOGO_RETENCIONES_IVA, inferSustentoTributario } from '../utils/sriCatalog';

interface UseDocumentDetailsSRIProps {
  viewingDoc: any;
  accounts: any[];
  empresaId: string;
  tipo: 'Compras' | 'Ventas';
  onSuccess: () => void;
  showAlert: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  showConfirm: (message: string, onConfirm: () => void, title?: string) => void;
}

export const useDocumentDetailsSRI = ({
  viewingDoc,
  accounts,
  empresaId,
  tipo,
  onSuccess,
  showAlert,
  showConfirm
}: UseDocumentDetailsSRIProps) => {
  const [doc, setDoc] = useState<any>(viewingDoc);
  const [viewingMovements, setViewingMovements] = useState<any[]>([]);
  const [loadingViewingMovs, setLoadingViewingMovs] = useState(false);
  const [withholdingLoading, setWithholdingLoading] = useState(false);
  const [parsedWithholding, setParsedWithholding] = useState<any | null>(null);
  
  // Manual withholding states
  const [verRetRenta, setVerRetRenta] = useState('');
  const [verRetIva, setVerRetIva] = useState('');
  const [selectedWithholdingRentaAccount, setSelectedWithholdingRentaAccount] = useState<string>('');
  const [selectedWithholdingIvaAccount, setSelectedWithholdingIvaAccount] = useState<string>('');
  const [codSustento, setCodSustento] = useState('01');
  const [manualNumRet, setManualNumRet] = useState('');
  const [manualAutRet, setManualAutRet] = useState('');
  const [manualFechaRet, setManualFechaRet] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    setDoc(viewingDoc);
  }, [viewingDoc]);

  // Fetch movements for this transaction
  useEffect(() => {
    const fetchViewingMovs = async () => {
      if (!doc || !doc.transacciones?.id) {
        setViewingMovements([]);
        return;
      }
      setLoadingViewingMovs(true);
      try {
        const { data, error } = await supabase
          .from('movimientos')
          .select('*')
          .eq('id_transaccion', doc.transacciones.id);
        if (data && !error) {
          setViewingMovements(data);
        }
      } catch (err) {
        console.error("Error fetching movements for doc:", err);
      } finally {
        setLoadingViewingMovs(false);
      }
    };
    fetchViewingMovs();
  }, [doc]);

  // Pre-populate manual retention values when modal opens/doc changes
  useEffect(() => {
    if (doc) {
      let retRenta = '';
      let retIva = '';
      let sust = '01';
      let num = '';
      let aut = '';
      let date = new Date().toISOString().split('T')[0];

      if (doc.retenciones_aplicadas && doc.retenciones_aplicadas.length > 0) {
        const rR = doc.retenciones_aplicadas.find((r: any) => r.tipo === 'RENTA');
        if (rR) retRenta = rR.codigo?.toString() || '';
        const rI = doc.retenciones_aplicadas.find((r: any) => r.tipo === 'IVA');
        if (rI) retIva = rI.codigo?.toString() || '';

        const meta = doc.retenciones_aplicadas.find((r: any) => r.cod_sustento || r.numero_retencion);
        if (meta) {
          sust = meta.cod_sustento || '01';
          num = meta.numero_retencion !== 'Manual' ? meta.numero_retencion || '' : '';
          aut = meta.clave_retencion || '';
          date = meta.fecha_retencion ? meta.fecha_retencion.split('T')[0] : date;
        }
      }
      setVerRetRenta(retRenta);
      setVerRetIva(retIva);
      setCodSustento(sust);
      setManualNumRet(num);
      setManualAutRet(aut);
      setManualFechaRet(date);

      if (accounts && accounts.length > 0) {
        if (tipo === 'Compras') {
          const targetAccounts = accounts.filter(a => a.tipo === 'Pasivo');
          const defRenta = targetAccounts.find(a => a.codigo_cuenta.startsWith('2.1.4') && (a.nombre.toLowerCase().includes('renta') || a.nombre.toLowerCase().includes('ir')));
          const defIva = targetAccounts.find(a => a.codigo_cuenta.startsWith('2.1.4') && a.nombre.toLowerCase().includes('iva'));
          const defGen = targetAccounts.find(a => a.codigo_cuenta.startsWith('2.1.4') || a.nombre.toLowerCase().includes('retencion'));

          setSelectedWithholdingRentaAccount(defRenta?.id || defGen?.id || targetAccounts[0]?.id || '');
          setSelectedWithholdingIvaAccount(defIva?.id || defGen?.id || targetAccounts[0]?.id || '');
        } else {
          const targetAccounts = accounts.filter(a => a.tipo === 'Activo');
          const defRenta = targetAccounts.find(a => (a.codigo_cuenta.startsWith('1.1.07') || a.codigo_cuenta.startsWith('1.1.08')) && (a.nombre.toLowerCase().includes('renta') || a.nombre.toLowerCase().includes('ir')));
          const defIva = targetAccounts.find(a => (a.codigo_cuenta.startsWith('1.1.07') || a.codigo_cuenta.startsWith('1.1.08')) && a.nombre.toLowerCase().includes('iva'));
          const defGen = targetAccounts.find(a => a.codigo_cuenta.startsWith('1.1.07') || a.codigo_cuenta.startsWith('1.1.08') || a.nombre.toLowerCase().includes('retencion') || a.nombre.toLowerCase().includes('anticipo'));

          setSelectedWithholdingRentaAccount(defRenta?.id || defGen?.id || targetAccounts[0]?.id || '');
          setSelectedWithholdingIvaAccount(defIva?.id || defGen?.id || targetAccounts[0]?.id || '');
        }
      }
    }
  }, [doc, accounts, tipo]);

  // Sugerir dinámicamente el Sustento Tributario según la cuenta contable del Debe
  useEffect(() => {
    if (doc && tipo === 'Compras' && accounts && accounts.length > 0 && viewingMovements && viewingMovements.length > 0) {
      const hasSavedSustento = doc.retenciones_aplicadas && doc.retenciones_aplicadas.some((r: any) => r.cod_sustento);
      if (!hasSavedSustento) {
        const defaultIva = accounts.find(a => a.codigo_cuenta.startsWith('1.1.09') || a.nombre.toLowerCase().includes('iva'));
        const movIva = viewingMovements.find(m => m.id_cuenta === defaultIva?.id || m.id_cuenta.toLowerCase().includes('iva') || (parseFloat(m.debe) > 0 && parseFloat(m.debe) === doc.monto_iva));
        const idCuentaIva = movIva?.id_cuenta || '';
        
        const movDebe = viewingMovements.find(m => parseFloat(m.debe) > 0 && m.id_cuenta !== idCuentaIva);
        const idCuentaDebe = movDebe?.id_cuenta || '';
        
        if (idCuentaDebe) {
          const acc = accounts.find(a => a.id === idCuentaDebe);
          if (acc) {
            const suggestedSustento = inferSustentoTributario(acc);
            setCodSustento(suggestedSustento);
          }
        }
      }
    }
  }, [doc, tipo, accounts, viewingMovements]);

  const getAccountLabel = (idCuenta: string) => {
    const acc = accounts.find(a => a.id === idCuenta);
    return acc ? `${acc.codigo_cuenta} - ${acc.nombre}` : idCuenta;
  };

  const handleWithholdingFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setWithholdingLoading(true);
    try {
      const text = await file.text();
      const parsed = await parseSRIXML(text);
      if (parsed && parsed.tipoDocumento === 'COM_RETENCION') {
        setParsedWithholding(parsed);
      } else {
        showAlert("El archivo no es un Comprobante de Retención válido del SRI.", "warning");
        setParsedWithholding(null);
      }
    } catch (err) {
      console.error("Error reading withholding XML:", err);
      showAlert("Error al leer el archivo XML.", "error");
      setParsedWithholding(null);
    } finally {
      setWithholdingLoading(false);
    }
  };

  const saveWithholding = async (targetDoc: any, parsedData: any, rentaAccountId: string, ivaAccountId: string) => {
    const idTransaccion = targetDoc.transacciones?.id;
    if (!idTransaccion) {
      throw new Error("La factura seleccionada no posee una transacción contable asociada.");
    }

    const retencionesFinal = parsedData.documentosSustento.flatMap((docSust: any) =>
      docSust.retenciones.map((ret: any) => ({
        codigo: ret.codigoRetencion,
        porcentaje: ret.porcentajeRetener,
        base: ret.baseImponible,
        valor: ret.valorRetenido,
        tipo: ret.tipo,
        desc_doc: docSust.numDocSustento,
        cod_doc_sustento: docSust.codDocSustento,
        cod_sustento: docSust.codSustento || '01',
        clave_retencion: parsedData.claveAcceso,
        numero_retencion: parsedData.numeroComprobante,
        fecha_retencion: parsedData.fechaEmision
      }))
    );

    const totalRetenido = parsedData.totalRetenido || 0;
    const totalRetenidoRenta = parsedData.totalRetenidoRenta || 0;
    const totalRetenidoIVA = parsedData.totalRetenidoIVA || 0;

    const { error: updateError } = await supabase
      .from('documentos_sri')
      .update({ retenciones_aplicadas: retencionesFinal })
      .eq('id', targetDoc.id);

    if (updateError) throw updateError;

    const { data: movimientosExistentes, error: mErr } = await supabase
      .from('movimientos')
      .select('*')
      .eq('id_transaccion', idTransaccion);
    
    if (mErr) throw mErr;

    if (movimientosExistentes && movimientosExistentes.length > 0) {
      let idCuentaDebe = '';
      let idCuentaIva = '';
      let idCuentaHaber = '';

      const defaultIva = accounts.find(a => a.codigo_cuenta.startsWith('1.1.09') || a.codigo_cuenta.startsWith('2.1.07') || a.nombre.toLowerCase().includes('iva'));

      if (tipo === 'Compras') {
        const movIva = movimientosExistentes.find(m => m.id_cuenta === defaultIva?.id || m.id_cuenta.toLowerCase().includes('iva') || (m.debe > 0 && m.debe === targetDoc.monto_iva));
        idCuentaIva = movIva?.id_cuenta || defaultIva?.id || '';
        
        const movDebe = movimientosExistentes.find(m => m.debe > 0 && m.id_cuenta !== idCuentaIva);
        idCuentaDebe = movDebe?.id_cuenta || '';

        const movHaber = movimientosExistentes.find(m => m.haber > 0 && !m.id_cuenta.startsWith('2.1.4') && !m.id_cuenta.toLowerCase().includes('retencion'));
        idCuentaHaber = movHaber?.id_cuenta || '';
      } else {
        const movIva = movimientosExistentes.find(m => m.id_cuenta === defaultIva?.id || m.id_cuenta.toLowerCase().includes('iva') || (m.haber > 0 && m.haber === targetDoc.monto_iva));
        idCuentaIva = movIva?.id_cuenta || defaultIva?.id || '';

        const movHaber = movimientosExistentes.find(m => m.haber > 0 && m.id_cuenta !== idCuentaIva);
        idCuentaHaber = movHaber?.id_cuenta || '';

        const movDebe = movimientosExistentes.find(m => m.debe > 0);
        idCuentaDebe = movDebe?.id_cuenta || '';
      }

      const baseGravada = (targetDoc.base_12 || 0) + (targetDoc.base_0 || 0) + (targetDoc.base_no_objeto || 0);
      const ivaMonto = targetDoc.monto_iva || 0;
      const totalFactura = baseGravada + ivaMonto;
      const netoAPagar = parseFloat((totalFactura - totalRetenido).toFixed(2));

      await supabase.from('movimientos').delete().eq('id_transaccion', idTransaccion);

      let nuevosMovimientos: any[] = [];
      if (tipo === 'Compras') {
        nuevosMovimientos = [
          { id_transaccion: idTransaccion, id_cuenta: idCuentaDebe, debe: baseGravada, haber: 0, id_empresa: empresaId },
          ...(ivaMonto > 0 ? [{ id_transaccion: idTransaccion, id_cuenta: idCuentaIva, debe: ivaMonto, haber: 0, id_empresa: empresaId }] : []),
          ...(totalRetenidoRenta > 0 ? [{ id_transaccion: idTransaccion, id_cuenta: rentaAccountId, debe: 0, haber: totalRetenidoRenta, id_empresa: empresaId }] : []),
          ...(totalRetenidoIVA > 0 ? [{ id_transaccion: idTransaccion, id_cuenta: ivaAccountId, debe: 0, haber: totalRetenidoIVA, id_empresa: empresaId }] : []),
          { id_transaccion: idTransaccion, id_cuenta: idCuentaHaber, debe: 0, haber: netoAPagar, id_empresa: empresaId }
        ];
      } else {
        nuevosMovimientos = [
          { id_transaccion: idTransaccion, id_cuenta: idCuentaDebe, debe: netoAPagar, haber: 0, id_empresa: empresaId },
          ...(totalRetenidoRenta > 0 ? [{ id_transaccion: idTransaccion, id_cuenta: rentaAccountId, debe: totalRetenidoRenta, haber: 0, id_empresa: empresaId }] : []),
          ...(totalRetenidoIVA > 0 ? [{ id_transaccion: idTransaccion, id_cuenta: ivaAccountId, debe: totalRetenidoIVA, haber: 0, id_empresa: empresaId }] : []),
          { id_transaccion: idTransaccion, id_cuenta: idCuentaHaber, debe: 0, haber: baseGravada, id_empresa: empresaId },
          ...(ivaMonto > 0 ? [{ id_transaccion: idTransaccion, id_cuenta: idCuentaIva, debe: 0, haber: ivaMonto, id_empresa: empresaId }] : [])
        ];
      }

      const { error: mInsertError } = await supabase.from('movimientos').insert(nuevosMovimientos);
      if (mInsertError) throw mInsertError;

      const { data: tesoDoc } = await supabase
        .from('tesoreria_documentos')
        .select('id')
        .eq('id_empresa', empresaId)
        .eq('referencia', targetDoc.transacciones?.numero_comprobante || '')
        .maybeSingle();

      if (tesoDoc) {
        await supabase
          .from('tesoreria_documentos')
          .update({
            saldo_pendiente: netoAPagar,
            estado: netoAPagar > 0 ? 'Pendiente' : 'Liquidado'
          })
          .eq('id', tesoDoc.id);
      }
    }
    return retencionesFinal;
  };

  const applyManualWithholding = async (
    targetDoc: any,
    retRentaCod: string,
    retIvaCod: string,
    rentaAccountId: string,
    ivaAccountId: string,
    codSustentoVal: string,
    manualNumRetVal: string,
    manualAutRetVal: string,
    manualFechaRetVal: string
  ) => {
    const idTransaccion = targetDoc.transacciones?.id;
    if (!idTransaccion) {
      throw new Error("La factura seleccionada no posee una transacción contable asociada.");
    }

    const baseGravada = (targetDoc.base_12 || 0) + (targetDoc.base_0 || 0) + (targetDoc.base_no_objeto || 0);
    const ivaMonto = targetDoc.monto_iva || 0;
    const totalFactura = baseGravada + ivaMonto;

    let retencionesFinal: any[] = [];
    let totalRetenidoRenta = 0;
    let totalRetenidoIVA = 0;

    const baseImponibleForRenta = targetDoc.base_12 || baseGravada;

    if (retRentaCod && retRentaCod !== '000') {
      const retSel = CATALOGO_RETENCIONES_RENTA.find(r => r.codigo === retRentaCod);
      if (retSel) {
        const valRetCalculado = parseFloat(((baseImponibleForRenta * retSel.porcentaje) / 100).toFixed(2));
        if (valRetCalculado > 0) {
          retencionesFinal.push({
            codigo: retSel.codigo,
            porcentaje: retSel.porcentaje,
            base: baseImponibleForRenta,
            valor: valRetCalculado,
            tipo: 'RENTA',
          });
          totalRetenidoRenta = valRetCalculado;
        }
      }
    }

    if (retIvaCod && retIvaCod !== '729') {
      const retSelIva = CATALOGO_RETENCIONES_IVA.find(r => r.codigo === retIvaCod);
      if (retSelIva && retSelIva.porcentaje > 0) {
        const valRetCalculado = parseFloat(((ivaMonto * retSelIva.porcentaje) / 100).toFixed(2));
        if (valRetCalculado > 0) {
          retencionesFinal.push({
            codigo: retSelIva.codigo,
            porcentaje: retSelIva.porcentaje,
            base: ivaMonto,
            valor: valRetCalculado,
            tipo: 'IVA',
          });
          totalRetenidoIVA = valRetCalculado;
        }
      }
    }

    // Inyectar metadatos fiscales a cada retención, o crear objeto dummy si no hay retenciones
    if (retencionesFinal.length === 0) {
      retencionesFinal.push({
        codigo: '000',
        porcentaje: 0,
        base: 0,
        valor: 0,
        tipo: 'METADATA',
        cod_sustento: codSustentoVal,
        clave_retencion: '',
        numero_retencion: '',
        fecha_retencion: new Date().toISOString().split('T')[0]
      });
    } else {
      retencionesFinal = retencionesFinal.map(r => ({
        ...r,
        cod_sustento: codSustentoVal,
        clave_retencion: manualAutRetVal,
        numero_retencion: manualNumRetVal,
        fecha_retencion: manualFechaRetVal
      }));
    }

    const totalRetenido = totalRetenidoRenta + totalRetenidoIVA;

    const { error: updateError } = await supabase
      .from('documentos_sri')
      .update({ retenciones_aplicadas: retencionesFinal })
      .eq('id', targetDoc.id);

    if (updateError) throw updateError;

    const { data: movimientosExistentes, error: mErr } = await supabase
      .from('movimientos')
      .select('*')
      .eq('id_transaccion', idTransaccion);
    
    if (mErr) throw mErr;

    if (movimientosExistentes && movimientosExistentes.length > 0) {
      let idCuentaDebe = '';
      let idCuentaIva = '';
      let idCuentaHaber = '';

      const defaultIva = accounts.find(a => a.codigo_cuenta.startsWith('1.1.09') || a.codigo_cuenta.startsWith('2.1.07') || a.nombre.toLowerCase().includes('iva'));

      if (tipo === 'Compras') {
        const movIva = movimientosExistentes.find(m => m.id_cuenta === defaultIva?.id || m.id_cuenta.toLowerCase().includes('iva') || (m.debe > 0 && m.debe === targetDoc.monto_iva));
        idCuentaIva = movIva?.id_cuenta || defaultIva?.id || '';
        
        const movDebe = movimientosExistentes.find(m => m.debe > 0 && m.id_cuenta !== idCuentaIva);
        idCuentaDebe = movDebe?.id_cuenta || '';

        const movHaber = movimientosExistentes.find(m => m.haber > 0 && !m.id_cuenta.startsWith('2.1.4') && !m.id_cuenta.toLowerCase().includes('retencion'));
        idCuentaHaber = movHaber?.id_cuenta || '';
      } else {
        const movIva = movimientosExistentes.find(m => m.id_cuenta === defaultIva?.id || m.id_cuenta.toLowerCase().includes('iva') || (m.haber > 0 && m.haber === targetDoc.monto_iva));
        idCuentaIva = movIva?.id_cuenta || defaultIva?.id || '';

        const movHaber = movimientosExistentes.find(m => m.haber > 0 && m.id_cuenta !== idCuentaIva);
        idCuentaHaber = movHaber?.id_cuenta || '';

        const movDebe = movimientosExistentes.find(m => m.debe > 0);
        idCuentaDebe = movDebe?.id_cuenta || '';
      }

      const netoAPagar = parseFloat((totalFactura - totalRetenido).toFixed(2));

      await supabase.from('movimientos').delete().eq('id_transaccion', idTransaccion);

      let nuevosMovimientos: any[] = [];
      if (tipo === 'Compras') {
        nuevosMovimientos = [
          { id_transaccion: idTransaccion, id_cuenta: idCuentaDebe, debe: baseGravada, haber: 0, id_empresa: empresaId },
          ...(ivaMonto > 0 ? [{ id_transaccion: idTransaccion, id_cuenta: idCuentaIva, debe: ivaMonto, haber: 0, id_empresa: empresaId }] : []),
          ...(totalRetenidoRenta > 0 ? [{ id_transaccion: idTransaccion, id_cuenta: rentaAccountId, debe: 0, haber: totalRetenidoRenta, id_empresa: empresaId }] : []),
          ...(totalRetenidoIVA > 0 ? [{ id_transaccion: idTransaccion, id_cuenta: ivaAccountId, debe: 0, haber: totalRetenidoIVA, id_empresa: empresaId }] : []),
          { id_transaccion: idTransaccion, id_cuenta: idCuentaHaber, debe: 0, haber: netoAPagar, id_empresa: empresaId }
        ];
      } else {
        nuevosMovimientos = [
          { id_transaccion: idTransaccion, id_cuenta: idCuentaDebe, debe: netoAPagar, haber: 0, id_empresa: empresaId },
          ...(totalRetenidoRenta > 0 ? [{ id_transaccion: idTransaccion, id_cuenta: rentaAccountId, debe: totalRetenidoRenta, haber: 0, id_empresa: empresaId }] : []),
          ...(totalRetenidoIVA > 0 ? [{ id_transaccion: idTransaccion, id_cuenta: ivaAccountId, debe: totalRetenidoIVA, haber: 0, id_empresa: empresaId }] : []),
          { id_transaccion: idTransaccion, id_cuenta: idCuentaHaber, debe: 0, haber: baseGravada, id_empresa: empresaId },
          ...(ivaMonto > 0 ? [{ id_transaccion: idTransaccion, id_cuenta: idCuentaIva, debe: 0, haber: ivaMonto, id_empresa: empresaId }] : [])
        ];
      }

      const { error: mInsertError } = await supabase.from('movimientos').insert(nuevosMovimientos);
      if (mInsertError) throw mInsertError;

      const { data: tesoDoc } = await supabase
        .from('tesoreria_documentos')
        .select('id')
        .eq('id_empresa', empresaId)
        .eq('referencia', targetDoc.transacciones?.numero_comprobante || '')
        .maybeSingle();

      if (tesoDoc) {
        await supabase
          .from('tesoreria_documentos')
          .update({
            saldo_pendiente: netoAPagar,
            estado: netoAPagar > 0 ? 'Pendiente' : 'Liquidado'
          })
          .eq('id', tesoDoc.id);
      }
    }
    return retencionesFinal;
  };

  const handleSaveManualWithholding = async () => {
    if (!doc) return;
    setWithholdingLoading(true);
    try {
      const rets = await applyManualWithholding(
        doc,
        verRetRenta,
        verRetIva,
        selectedWithholdingRentaAccount,
        selectedWithholdingIvaAccount,
        codSustento,
        manualNumRet,
        manualAutRet,
        manualFechaRet
      );
      showAlert("Retención manual registrada y contabilidad sincronizada exitosamente.", "success");
      setDoc((prev: any) => prev ? { ...prev, retenciones_aplicadas: rets } : null);
      onSuccess();
    } catch (err: any) {
      console.error("Error saving manual withholding:", err);
      showAlert(`Error al registrar retención: ${err.message}`, "error");
    } finally {
      setWithholdingLoading(false);
    }
  };

  const handleRemoveWithholding = (targetDoc: any) => {
    showConfirm("¿Está seguro de eliminar la retención aplicada a esta factura?", async () => {
      setWithholdingLoading(true);
      try {
        const idTransaccion = targetDoc.transacciones?.id;
        if (!idTransaccion) throw new Error("Transacción no encontrada.");

        const { error: sriErr } = await supabase
          .from('documentos_sri')
          .update({ retenciones_aplicadas: [] })
          .eq('id', targetDoc.id);
        if (sriErr) throw sriErr;

        const { data: movimientosExistentes, error: mErr } = await supabase
          .from('movimientos')
          .select('*')
          .eq('id_transaccion', idTransaccion);
        if (mErr) throw mErr;

        if (movimientosExistentes && movimientosExistentes.length > 0) {
          const defaultIva = accounts.find(a => a.codigo_cuenta.startsWith('1.1.09') || a.codigo_cuenta.startsWith('2.1.07') || a.nombre.toLowerCase().includes('iva'));
          
          let idCuentaDebe = '';
          let idCuentaIva = '';
          let idCuentaHaber = '';

          if (tipo === 'Compras') {
            const movIva = movimientosExistentes.find(m => m.id_cuenta === defaultIva?.id || m.id_cuenta.toLowerCase().includes('iva') || (m.debe > 0 && m.debe === targetDoc.monto_iva));
            idCuentaIva = movIva?.id_cuenta || defaultIva?.id || '';
            
            const movDebe = movimientosExistentes.find(m => m.debe > 0 && m.id_cuenta !== idCuentaIva);
            idCuentaDebe = movDebe?.id_cuenta || '';

            const movHaber = movimientosExistentes.find(m => m.haber > 0 && !m.id_cuenta.startsWith('2.1.4') && !m.id_cuenta.toLowerCase().includes('retencion'));
            idCuentaHaber = movHaber?.id_cuenta || '';
          } else {
            const movIva = movimientosExistentes.find(m => m.id_cuenta === defaultIva?.id || m.id_cuenta.toLowerCase().includes('iva') || (m.haber > 0 && m.haber === targetDoc.monto_iva));
            idCuentaIva = movIva?.id_cuenta || defaultIva?.id || '';

            const movHaber = movimientosExistentes.find(m => m.haber > 0 && m.id_cuenta !== idCuentaIva);
            idCuentaHaber = movHaber?.id_cuenta || '';

            const movDebe = movimientosExistentes.find(m => m.debe > 0);
            idCuentaDebe = movDebe?.id_cuenta || '';
          }

          const baseGravada = (targetDoc.base_12 || 0) + (targetDoc.base_0 || 0) + (targetDoc.base_no_objeto || 0);
          const ivaMonto = targetDoc.monto_iva || 0;
          const totalFactura = baseGravada + ivaMonto;

          await supabase.from('movimientos').delete().eq('id_transaccion', idTransaccion);

          let nuevosMovimientos: any[] = [];
          if (tipo === 'Compras') {
            nuevosMovimientos = [
              { id_transaccion: idTransaccion, id_cuenta: idCuentaDebe, debe: baseGravada, haber: 0, id_empresa: empresaId },
              ...(ivaMonto > 0 ? [{ id_transaccion: idTransaccion, id_cuenta: idCuentaIva, debe: ivaMonto, haber: 0, id_empresa: empresaId }] : []),
              { id_transaccion: idTransaccion, id_cuenta: idCuentaHaber, debe: 0, haber: totalFactura, id_empresa: empresaId }
            ];
          } else {
            nuevosMovimientos = [
              { id_transaccion: idTransaccion, id_cuenta: idCuentaDebe, debe: totalFactura, haber: 0, id_empresa: empresaId },
              { id_transaccion: idTransaccion, id_cuenta: idCuentaHaber, debe: 0, haber: baseGravada, id_empresa: empresaId },
              ...(ivaMonto > 0 ? [{ id_transaccion: idTransaccion, id_cuenta: idCuentaIva, debe: 0, haber: ivaMonto, id_empresa: empresaId }] : [])
            ];
          }

          const { error: mInsertError } = await supabase.from('movimientos').insert(nuevosMovimientos);
          if (mInsertError) throw mInsertError;

          const { data: tesoDoc } = await supabase
            .from('tesoreria_documentos')
            .select('id')
            .eq('id_empresa', empresaId)
            .eq('referencia', targetDoc.transacciones?.numero_comprobante || '')
            .maybeSingle();

          if (tesoDoc) {
            await supabase
              .from('tesoreria_documentos')
              .update({
                saldo_pendiente: totalFactura,
                estado: totalFactura > 0 ? 'Pendiente' : 'Liquidado'
              })
              .eq('id', tesoDoc.id);
          }
        }

        showAlert("Retención eliminada exitosamente.", "success");
        setDoc((prev: any) => prev ? { ...prev, retenciones_aplicadas: [] } : null);
        onSuccess();
      } catch (err: any) {
        console.error("Error removing withholding:", err);
        showAlert(`Error al eliminar retención: ${err.message}`, "error");
      } finally {
        setWithholdingLoading(false);
      }
    });
  };

  const ivaDisplay = doc ? (doc.monto_iva || 0) : 0;

  const actualBase12 = useMemo(() => {
    if (!doc) return 0;
    if (doc.base_12) return doc.base_12;
    if (ivaDisplay > 0 && viewingMovements.length > 0) {
      const ivaMov = viewingMovements.find(m => parseFloat(m.debe) === ivaDisplay);
      const expenseMovs = viewingMovements.filter(m => parseFloat(m.debe) > 0 && m !== ivaMov);
      return expenseMovs.reduce((sum, m) => sum + (parseFloat(m.debe) || 0), 0);
    }
    return 0;
  }, [doc, ivaDisplay, viewingMovements]);

  const baseGrav = doc ? ((actualBase12 || 0) + (doc.base_0 || 0) + (doc.base_no_objeto || 0)) : 0;
  const totalVal = baseGrav + ivaDisplay;
  const calculatedBase12 = doc ? (actualBase12 || (ivaDisplay > 0 ? parseFloat((totalVal - ivaDisplay - (doc.base_0 || 0) - (doc.base_no_objeto || 0)).toFixed(2)) : 0)) : 0;

  const handleApplyWithholdingFromXML = async () => {
    if (!doc || !parsedWithholding) return;
    setWithholdingLoading(true);
    try {
      const rets = await saveWithholding(doc, parsedWithholding, selectedWithholdingRentaAccount, selectedWithholdingIvaAccount);
      showAlert("Retención registrada exitosamente.", "success");
      setDoc((prev: any) => prev ? { ...prev, retenciones_aplicadas: rets } : null);
      setParsedWithholding(null);
      onSuccess();
    } catch (err: any) {
      showAlert(`Error al procesar: ${err.message}`, "error");
    } finally {
      setWithholdingLoading(false);
    }
  };

  return {
    doc,
    setDoc,
    viewingMovements,
    loadingViewingMovs,
    withholdingLoading,
    parsedWithholding,
    setParsedWithholding,
    verRetRenta,
    setVerRetRenta,
    verRetIva,
    setVerRetIva,
    selectedWithholdingRentaAccount,
    setSelectedWithholdingRentaAccount,
    selectedWithholdingIvaAccount,
    setSelectedWithholdingIvaAccount,
    getAccountLabel,
    handleWithholdingFileChange,
    handleSaveManualWithholding,
    handleRemoveWithholding,
    ivaDisplay,
    actualBase12,
    baseGrav,
    totalVal,
    calculatedBase12,
    handleApplyWithholdingFromXML,
    codSustento,
    setCodSustento,
    manualNumRet,
    setManualNumRet,
    manualAutRet,
    setManualAutRet,
    manualFechaRet,
    setManualFechaRet
  };
};
