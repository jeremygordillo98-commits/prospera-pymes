import { supabase } from '../services/supabase';
import { type SRIParsedData } from './sriParser';
import { CATALOGO_RETENCIONES_RENTA } from './sriCatalog';

export interface SaveSRIParams {
  parsedData: SRIParsedData;
  empresaId: string;
  entidadId: string;
  idCuentaDebe: string;
  idCuentaHaber: string;
  idCuentaRetencion: string;
  retencionCodigo: string;
  userId: string;
  rucEmpresa: string;
}

export async function saveSRIDocument(p: SaveSRIParams): Promise<void> {
  const { parsedData, empresaId, entidadId, idCuentaDebe, idCuentaHaber,
    idCuentaRetencion, retencionCodigo, userId, rucEmpresa } = p;

  const isFactura = parsedData.tipoDocumento === 'FACTURA';
  const isRetencion = parsedData.tipoDocumento === 'COM_RETENCION';

  const retencionSel = CATALOGO_RETENCIONES_RENTA.find(r => r.codigo === retencionCodigo) || CATALOGO_RETENCIONES_RENTA[0];
  const valorRetenido = isFactura
    ? parseFloat(((parsedData.baseImponible * retencionSel.porcentaje) / 100).toFixed(2))
    : 0;

  const totalComprobante = isFactura ? parsedData.total
    : isRetencion ? parsedData.totalRetenido
      : parsedData.valorModificacion;

  const concepto = isFactura
    ? `Factura: ${parsedData.razonSocialEmisor} - ${parsedData.numeroComprobante}`
    : isRetencion
      ? `Retención: ${parsedData.razonSocialEmisor} - ${parsedData.numeroComprobante}`
      : `NC: ${parsedData.razonSocialEmisor} - Mod: ${parsedData.numDocModificado}`;

  // 1. Transacción
  const { data: tx, error: tErr } = await supabase.from('transacciones').insert({
    fecha: new Date(parsedData.fechaEmision.split('/').reverse().join('-')),
    concepto,
    tipo_comprobante: isFactura ? 'Factura' : isRetencion ? 'Comprobante de Retención' : 'Nota de Crédito',
    numero_comprobante: parsedData.numeroComprobante,
    id_entidad: entidadId,
    xml_referencia: parsedData.claveAcceso,
    id_empresa: empresaId,
    id_usuario: userId,
  }).select().single();
  if (tErr) throw tErr;

  // 2. Movimientos
  const neto = parseFloat((totalComprobante - valorRetenido).toFixed(2));
  const movimientos = isFactura
    ? [
      { id_transaccion: tx.id, id_cuenta: idCuentaDebe, debe: totalComprobante, haber: 0, id_empresa: empresaId },
      ...(valorRetenido > 0 ? [{ id_transaccion: tx.id, id_cuenta: idCuentaRetencion, debe: 0, haber: valorRetenido, id_empresa: empresaId }] : []),
      { id_transaccion: tx.id, id_cuenta: idCuentaHaber, debe: 0, haber: neto, id_empresa: empresaId },
    ]
    : [
      { id_transaccion: tx.id, id_cuenta: idCuentaDebe, debe: totalComprobante, haber: 0, id_empresa: empresaId },
      { id_transaccion: tx.id, id_cuenta: idCuentaHaber, debe: 0, haber: totalComprobante, id_empresa: empresaId },
    ];
  const { error: mErr } = await supabase.from('movimientos').insert(movimientos);
  if (mErr) throw mErr;

  // 3. es_compra
  const esCompra = isRetencion
    ? parsedData.rucEmisor === rucEmpresa
    : parsedData.rucEmisor !== rucEmpresa;

  // 4. Documento SRI
  const sri: any = { id_transaccion: tx.id, clave_acceso_xml: parsedData.claveAcceso, id_empresa: empresaId };
  if (isFactura) {
    Object.assign(sri, {
      base_12: parsedData.base12, base_0: parsedData.base0, base_no_objeto: parsedData.baseNoObjeto,
      monto_iva: parsedData.iva, es_compra: esCompra,
      retenciones_aplicadas: valorRetenido > 0
        ? [{ codigo: retencionSel.codigo, porcentaje: retencionSel.porcentaje, base: parsedData.base12, valor: valorRetenido, tipo: 'RENTA' }]
        : [],
    });
  } else if (isRetencion) {
    Object.assign(sri, {
      base_12: 0, base_0: 0, base_no_objeto: 0, monto_iva: parsedData.totalRetenidoIVA, es_compra: esCompra,
      retenciones_aplicadas: parsedData.documentosSustento?.flatMap((doc: any) =>
        doc.retenciones.map((r: any) => ({ codigo: r.codigoRetencion, porcentaje: r.porcentajeRetener, base: r.baseImponible, valor: r.valorRetenido, tipo: r.tipo, desc_doc: doc.numDocSustento, cod_doc_sustento: doc.codDocSustento }))
      ) || [],
    });
  } else {
    Object.assign(sri, {
      base_12: parsedData.base12, base_0: parsedData.base0, base_no_objeto: parsedData.baseNoObjeto,
      monto_iva: parsedData.iva, es_compra: esCompra,
      retenciones_aplicadas: [],
    });
  }
  const { error: sriErr } = await supabase.from('documentos_sri').insert(sri);
  if (sriErr) {
    console.error('Error insertando documentos_sri:', sriErr, sri);
    throw sriErr;
  }

  // 5. Tesorería (solo facturas)
  if (isFactura) {
    const esVenta = rucEmpresa === parsedData.rucEmisor;
    const fechaISO = new Date(parsedData.fechaEmision.split('/').reverse().join('-')).toISOString().slice(0, 10);
    await supabase.from('tesoreria_documentos').insert({
      id_empresa: empresaId, id_entidad: entidadId,
      tipo_documento: esVenta ? 'Cuenta por cobrar' : 'Cuenta por pagar',
      fecha_emision: fechaISO, fecha_vencimiento: fechaISO,
      concepto: `[Automático] Factura #${parsedData.numeroComprobante}`,
      referencia: parsedData.numeroComprobante, total: totalComprobante,
      saldo_pendiente: neto, estado: neto > 0 ? 'Pendiente' : 'Liquidado', origen: 'SRI XML',
    });
  }
}
