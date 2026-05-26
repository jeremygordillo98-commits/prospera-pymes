import { supabase } from './supabase';
import { CATALOGO_RETENCIONES_RENTA } from '../utils/sriCatalog';

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
  onProgress: (progress: number) => void
): Promise<void> => {
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
    const finalNum = await getNextNumeroComprobante(empresaId);

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
      const retencionSel = CATALOGO_RETENCIONES_RENTA.find(r => r.codigo === item.retencionCodigo) || CATALOGO_RETENCIONES_RENTA[0];
      const valorRetenidoCalc = parseFloat(((parsed.baseImponible * retencionSel.porcentaje) / 100).toFixed(2));
      const subtotalMonto = parseFloat((totalComprobante - ivaMonto).toFixed(2));
      const netoAPagar = parseFloat((totalComprobante - valorRetenidoCalc).toFixed(2));

      batchMovimientos = [
        { id_transaccion: transaccion.id, id_cuenta: item.idCuentaDebe, debe: subtotalMonto, haber: 0, id_empresa: empresaId },
        ...(ivaMonto > 0 ? [{ id_transaccion: transaccion.id, id_cuenta: item.idCuentaIva, debe: ivaMonto, haber: 0, id_empresa: empresaId }] : []),
        ...(valorRetenidoCalc > 0 ? [{ id_transaccion: transaccion.id, id_cuenta: item.idCuentaRetencion, debe: 0, haber: valorRetenidoCalc, id_empresa: empresaId }] : []),
        { id_transaccion: transaccion.id, id_cuenta: item.idCuentaHaber, debe: 0, haber: netoAPagar, id_empresa: empresaId }
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
    const { data: empData2 } = await supabase.from('empresas_gestionadas').select('ruc_empresa').eq('id', empresaId).single();
    const rucEmpresa2 = empData2?.ruc_empresa || '';
    
    let esCompra = false;
    if (isFact || isNC) {
      esCompra = parsed.rucEmisor !== rucEmpresa2;
    } else if (isRet) {
      // Si el emisor del comprobante de retención somos nosotros, corresponde a una compra
      // (nosotros retenemos a un proveedor). Si el emisor es otro, corresponde a una venta
      // (un cliente nos retiene a nosotros).
      esCompra = parsed.rucEmisor === rucEmpresa2;
    }

    let payloadSRI: any = {
      id_transaccion: transaccion.id,
      clave_acceso_xml: parsed.claveAcceso,
      id_empresa: empresaId
    };

    if (isFact) {
      const retencionSel = CATALOGO_RETENCIONES_RENTA.find(r => r.codigo === item.retencionCodigo) || CATALOGO_RETENCIONES_RENTA[0];
      const valorRetenidoCalc = parseFloat(((parsed.baseImponible * retencionSel.porcentaje) / 100).toFixed(2));

      payloadSRI.base_12 = parsed.base12;
      payloadSRI.base_0 = parsed.base0;
      payloadSRI.base_no_objeto = parsed.baseNoObjeto;
      payloadSRI.monto_iva = parsed.iva;
      payloadSRI.forma_pago = parsed.formaPago;
      payloadSRI.es_compra = esCompra;
      payloadSRI.retenciones_aplicadas = valorRetenidoCalc > 0 ? [{
        codigo: retencionSel.codigo,
        porcentaje: retencionSel.porcentaje,
        base: parsed.base12,
        valor: valorRetenidoCalc,
        tipo: 'RENTA'
      }] : [];
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
      payloadSRI.base_12 = parsed.base12;
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
      const retencionSel = CATALOGO_RETENCIONES_RENTA.find(r => r.codigo === item.retencionCodigo) || CATALOGO_RETENCIONES_RENTA[0];
      const valorRetenidoCalc = parseFloat(((parsed.baseImponible * retencionSel.porcentaje) / 100).toFixed(2));
      const netoAPagar = parseFloat((totalComprobante - valorRetenidoCalc).toFixed(2));

      await supabase.from('tesoreria_documentos').insert({
        id_empresa: empresaId,
        id_entidad: item.entidadId,
        tipo_documento: tipoTesoreria,
        fecha_emision: new Date(parsed.fechaEmision.split('/').reverse().join('-')).toISOString().slice(0, 10),
        fecha_vencimiento: new Date(parsed.fechaEmision.split('/').reverse().join('-')).toISOString().slice(0, 10),
        concepto: `[Automático] Factura #${parsed.numeroComprobante}`,
        referencia: parsed.numeroComprobante,
        total: totalComprobante,
        saldo_pendiente: netoAPagar,
        estado: netoAPagar > 0 ? 'Pendiente' : 'Liquidado',
        origen: 'SRI XML'
      });
    }

    onProgress(Math.round(((i + 1) / readyItems.length) * 100));
  }
};
