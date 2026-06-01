import { supabase } from './supabase';

export interface BatchSaveItem {
  parsed: any;
  entidadId: string;
  idCuentaDebe: string;
  idCuentaHaber: string;
  idCuentaIva: string;
  idCuentaRetencion: string;
  retencionCodigo: string;
}

// Helper para calcular el siguiente secuencial contable
export const getNextNumeroComprobante = async (empresaId: string): Promise<string> => {
  if (!empresaId || empresaId === 'undefined') return '1';
  try {
    const { data, error } = await supabase
      .from('transacciones')
      .select('numero_comprobante')
      .eq('id_empresa', empresaId);
      
    if (error || !data || data.length === 0) return '1';
    
    let maxNum = 0;
    data.forEach(tx => {
      if (tx.numero_comprobante) {
        const num = parseInt(tx.numero_comprobante.trim(), 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    });
    
    return (maxNum + 1).toString();
  } catch {
    return '1';
  }
};

// Servicio principal para guardar asientos y documentos SRI masivamente
export const saveXMLBatchToSupabase = async (
  empresaId: string,
  readyItems: BatchSaveItem[],
  userId: string,
  tipo: 'Compras' | 'Ventas',
  onProgress: (progress: number) => void
): Promise<void> => {
  const startNumStr = await getNextNumeroComprobante(empresaId);
  let currentNum = parseInt(startNumStr, 10) || 1;

  for (let i = 0; i < readyItems.length; i++) {
    const item = readyItems[i];
    const parsed = item.parsed;
    if (!parsed) continue;

    const isFact = parsed.tipoDocumento === 'FACTURA';
    const isRet = parsed.tipoDocumento === 'COM_RETENCION';
    const isNC = parsed.tipoDocumento === 'NOTA_CREDITO';

    let totalComprobante = 0;
    let concepto = '';

    if (isFact) {
      totalComprobante = parsed.total;
      concepto = `Factura: ${parsed.razonSocialEmisor} - ${parsed.numeroComprobante}`;
    } else if (isRet) {
      totalComprobante = parsed.totalRetenido;
      concepto = `Retención: ${parsed.razonSocialEmisor} - ${parsed.numeroComprobante}`;
    } else if (isNC) {
      totalComprobante = parsed.valorModificacion;
      concepto = `NC: ${parsed.razonSocialEmisor} - Mod: ${parsed.numDocModificado}`;
    }

    // 1. Crear transacción contable
    const finalNum = currentNum.toString();
    currentNum++;

    const { data: transaccion, error: tError } = await supabase
      .from('transacciones')
      .insert({
        fecha: new Date(parsed.fechaEmision.split('/').reverse().join('-')),
        concepto,
        tipo_comprobante: isFact ? 'Factura' : isRet ? 'Comprobante de Retención' : 'Nota de Crédito',
        numero_comprobante: finalNum,
        id_entidad: item.entidadId,
        xml_referencia: parsed.claveAcceso,
        id_empresa: empresaId,
        id_usuario: userId
      })
      .select()
      .single();

    if (tError) throw tError;

    // 2. Insertar Movimientos de Partida Doble
    let batchMovimientos: any[] = [];
    const ivaMonto = (isFact || isNC) ? (parsed.iva || 0) : 0;

    if (isFact) {
      const subtotalMonto = parseFloat((totalComprobante - ivaMonto).toFixed(2));

      batchMovimientos = [
        { id_transaccion: transaccion.id, id_cuenta: item.idCuentaDebe, debe: subtotalMonto, haber: 0, id_empresa: empresaId },
        ...(ivaMonto > 0 ? [{ id_transaccion: transaccion.id, id_cuenta: item.idCuentaIva, debe: ivaMonto, haber: 0, id_empresa: empresaId }] : []),
        { id_transaccion: transaccion.id, id_cuenta: item.idCuentaHaber, debe: 0, haber: totalComprobante, id_empresa: empresaId }
      ];
    } else if (isNC) {
      const subtotalMonto = parseFloat((totalComprobante - ivaMonto).toFixed(2));
      batchMovimientos = [
        { id_transaccion: transaccion.id, id_cuenta: item.idCuentaDebe, debe: subtotalMonto, haber: 0, id_empresa: empresaId },
        ...(ivaMonto > 0 ? [{ id_transaccion: transaccion.id, id_cuenta: item.idCuentaIva, debe: ivaMonto, haber: 0, id_empresa: empresaId }] : []),
        { id_transaccion: transaccion.id, id_cuenta: item.idCuentaHaber, debe: 0, haber: totalComprobante, id_empresa: empresaId }
      ];
    } else {
      batchMovimientos = [
        { id_transaccion: transaccion.id, id_cuenta: item.idCuentaDebe, debe: totalComprobante, haber: 0, id_empresa: empresaId },
        { id_transaccion: transaccion.id, id_cuenta: item.idCuentaHaber, debe: 0, haber: totalComprobante, id_empresa: empresaId }
      ];
    }

    const { error: mError } = await supabase.from('movimientos').insert(batchMovimientos);
    if (mError) throw mError;

    // 3. Crear documento SRI para ATS
    const esCompra = tipo === 'Compras';

    let payloadSRI: any = {
      id_transaccion: transaccion.id,
      clave_acceso_xml: parsed.claveAcceso,
      id_empresa: empresaId
    };

    if (isFact) {
      payloadSRI.base_12 = (parsed.base12 || 0) + (parsed.base15 || 0) + (parsed.base5 || 0);
      payloadSRI.base_0 = parsed.base0;
      payloadSRI.base_no_objeto = parsed.baseNoObjeto;
      payloadSRI.monto_iva = parsed.iva;
      payloadSRI.forma_pago = parsed.formaPago;
      payloadSRI.es_compra = esCompra;
      payloadSRI.retenciones_aplicadas = [];
    } else if (isRet) {
      payloadSRI.base_12 = 0;
      payloadSRI.base_0 = 0;
      payloadSRI.base_no_objeto = 0;
      payloadSRI.monto_iva = parsed.totalRetenidoIVA;
      payloadSRI.es_compra = esCompra;
      payloadSRI.retenciones_aplicadas = parsed.documentosSustento.flatMap((doc: any) =>
        doc.retenciones.map((ret: any) => ({
          codigo: ret.codigoRetencion,
          porcentaje: ret.porcentajeRetener,
          base: ret.baseImponible,
          valor: ret.valorRetenido,
          tipo: ret.tipo,
          desc_doc: doc.numDocSustento,
          cod_doc_sustento: doc.codDocSustento
        }))
      );
    } else if (isNC) {
      payloadSRI.base_12 = (parsed.base12 || 0) + (parsed.base15 || 0) + (parsed.base5 || 0);
      payloadSRI.base_0 = parsed.base0;
      payloadSRI.base_no_objeto = parsed.baseNoObjeto;
      payloadSRI.monto_iva = parsed.iva;
      payloadSRI.es_compra = esCompra;
      payloadSRI.retenciones_aplicadas = [];
    }

    const { error: sriError } = await supabase.from('documentos_sri').insert(payloadSRI);
    if (sriError) {
      console.error('Error inserting into documentos_sri:', sriError);
      throw new Error(`Error al guardar en documentos_sri: ${sriError.message} (${sriError.code})`);
    }

    // 4. Registrar en Tesorería
    if (isFact) {
      const { data: empData } = await supabase.from('empresas_gestionadas').select('ruc_empresa').eq('id', empresaId).single();
      const rucEmpresa = empData?.ruc_empresa || '';

      const esVenta = rucEmpresa === parsed.rucEmisor;
      const tipoTesoreria = esVenta ? 'Cuenta por cobrar' : 'Cuenta por pagar';

      await supabase.from('tesoreria_documentos').insert({
        id_empresa: empresaId,
        id_entidad: item.entidadId,
        tipo_documento: tipoTesoreria,
        fecha_emision: new Date(parsed.fechaEmision.split('/').reverse().join('-')).toISOString().slice(0, 10),
        fecha_vencimiento: new Date(parsed.fechaEmision.split('/').reverse().join('-')).toISOString().slice(0, 10),
        concepto: `[Automático] Factura #${parsed.numeroComprobante}`,
        referencia: parsed.numeroComprobante,
        total: totalComprobante,
        saldo_pendiente: totalComprobante,
        estado: totalComprobante > 0 ? 'Pendiente' : 'Liquidado',
        origen: 'SRI XML'
      });
    }

    onProgress(Math.round(((i + 1) / readyItems.length) * 100));
  }
};
