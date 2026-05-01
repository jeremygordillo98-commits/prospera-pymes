import { XMLParser } from 'fast-xml-parser';

export type SRIDocumentType = 'FACTURA' | 'COM_RETENCION' | 'NOTA_CREDITO';

export interface SRIDocumentoBase {
  tipoDocumento: SRIDocumentType;
  rucEmisor: string;
  razonSocialEmisor: string;
  claveAcceso: string;
  fechaEmision: string;
  numeroComprobante: string;
}

// ─── FACTURA ────────────────────────────────────────────────
export interface SRIFacturaData extends SRIDocumentoBase {
  tipoDocumento: 'FACTURA';
  rucReceptor: string;
  tipoIdentificacionReceptor: string; // 04=RUC, 05=Cedula, 06=Pasaporte, 07=CF
  // Bases imponibles separadas por tarifa
  base12: number;        // Tarifa 12% o 15% (cod=2, tarifa=2/4)
  base0: number;         // Tarifa 0% (cod=2, tarifa=0)
  baseNoObjeto: number;  // No objeto IVA (cod=6)
  baseExenta: number;    // Exenta (cod=7)
  iva: number;
  total: number;
  formaPago: string;     // Código SRI forma de pago (01, 15..21)
  // alias retrocompat
  baseImponible: number;
}

// ─── RETENCIÓN ───────────────────────────────────────────────
export interface SRIRetencionDetalle {
  codigo: string | number;       // 1=Renta, 2=IVA (código impuesto)
  codigoRetencion: string;       // Código de retención (303, 312A, 721, etc.)
  baseImponible: number;
  porcentajeRetener: number;
  valorRetenido: number;
  tipo: 'RENTA' | 'IVA';        // Derivado del campo 'codigo'
}

export interface SRIRetencionDocSustento {
  numDocSustento: string;
  codDocSustento: string;        // Tipo de documento sustento (01=Factura, etc.)
  fechaEmisionDocSustento: string;
  retenciones: SRIRetencionDetalle[];
}

export interface SRIRetencionData extends SRIDocumentoBase {
  tipoDocumento: 'COM_RETENCION';
  rucReceptor: string;
  periodoFiscal: string;
  documentosSustento: SRIRetencionDocSustento[];
  totalRetenido: number;
  totalRetenidoRenta: number;
  totalRetenidoIVA: number;
}

// ─── NOTA DE CRÉDITO ─────────────────────────────────────────
export interface SRINotaCreditoData extends SRIDocumentoBase {
  tipoDocumento: 'NOTA_CREDITO';
  rucReceptor: string;
  tipoIdentificacionReceptor: string;
  numDocModificado: string;
  motivo: string;
  valorModificacion: number;
  base12: number;
  base0: number;
  baseNoObjeto: number;
  iva: number;
  // alias retrocompat
  baseImponible: number;
}

export type SRIParsedData = SRIFacturaData | SRIRetencionData | SRINotaCreditoData;

// Mantener alias antiguo por retrocompatibilidad temporal
export type SRIInvoiceData = SRIFacturaData;

// ─── HELPERS ─────────────────────────────────────────────────

/** Extrae bases imponibles separadas por tarifa del nodo totalConImpuestos */
const extractBases = (totalConImpuestos: any) => {
  let base12 = 0, base0 = 0, baseNoObjeto = 0, baseExenta = 0, iva = 0;
  if (!totalConImpuestos?.totalImpuesto) return { base12, base0, baseNoObjeto, baseExenta, iva };

  const impuestos = Array.isArray(totalConImpuestos.totalImpuesto)
    ? totalConImpuestos.totalImpuesto
    : [totalConImpuestos.totalImpuesto];

  impuestos.forEach((imp: any) => {
    const cod = String(imp.codigo || '');
    const tarifa = Number(imp.tarifa ?? imp.codigoPorcentaje ?? 0);
    const base = parseFloat(imp.baseImponible || 0);
    const valor = parseFloat(imp.valor || 0);

    if (cod === '2') {
      // IVA: tarifa 0 = base0, tarifa > 0 = base12 (incluyendo 15%)
      if (tarifa === 0) {
        base0 += base;
      } else {
        base12 += base;
        iva += valor;
      }
    } else if (cod === '6') {
      // No objeto IVA
      baseNoObjeto += base;
    } else if (cod === '7') {
      // Exento
      baseExenta += base;
    }
  });

  return { base12, base0, baseNoObjeto, baseExenta, iva };
};

/** Extrae forma de pago del nodo pagos.pago */
const extractFormaPago = (pagos: any): string => {
  if (!pagos?.pago) return '01';
  const pagoArr = Array.isArray(pagos.pago) ? pagos.pago : [pagos.pago];
  // Retornar el código de la primera forma de pago
  return pagoArr[0]?.formaPago?.toString() || '01';
};

// ─── PARSER PRINCIPAL ─────────────────────────────────────────
export const parseSRIXML = async (xmlContent: string): Promise<SRIParsedData | null> => {
  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      parseTagValue: true,
      trimValues: true,
    });

    let jsonObj = parser.parse(xmlContent);
    let comprobante: any;
    let tipo: SRIDocumentType | null = null;

    // El SRI devuelve la factura dentro de 'autorizacion' o directo en el nodo raíz
    if (jsonObj.autorizacion && jsonObj.autorizacion.comprobante) {
      const comprobanteXML = jsonObj.autorizacion.comprobante;
      let parsedCmp = typeof comprobanteXML === 'string' ? parser.parse(comprobanteXML) : comprobanteXML;

      if (parsedCmp.factura) { comprobante = parsedCmp.factura; tipo = 'FACTURA'; }
      else if (parsedCmp.comprobanteRetencion) { comprobante = parsedCmp.comprobanteRetencion; tipo = 'COM_RETENCION'; }
      else if (parsedCmp.notaCredito) { comprobante = parsedCmp.notaCredito; tipo = 'NOTA_CREDITO'; }
    } else {
      if (jsonObj.factura) { comprobante = jsonObj.factura; tipo = 'FACTURA'; }
      else if (jsonObj.comprobanteRetencion) { comprobante = jsonObj.comprobanteRetencion; tipo = 'COM_RETENCION'; }
      else if (jsonObj.notaCredito) { comprobante = jsonObj.notaCredito; tipo = 'NOTA_CREDITO'; }
    }

    if (!comprobante || !comprobante.infoTributaria || !tipo) {
      console.error("No se encontró un nodo tributario válido en el XML");
      return null;
    }

    const infoT = comprobante.infoTributaria;

    const basePayload = {
      rucEmisor: infoT.ruc?.toString() || '',
      razonSocialEmisor: infoT.razonSocial || '',
      claveAcceso: infoT.claveAcceso?.toString() || jsonObj.autorizacion?.numeroAutorizacion?.toString() || '',
      numeroComprobante: `${infoT.estab}-${infoT.ptoEmi}-${infoT.secuencial}`
    };

    // ─── FACTURA ─────────────────────────────────────────────
    if (tipo === 'FACTURA') {
      const infoF = comprobante.infoFactura;
      const { base12, base0, baseNoObjeto, baseExenta, iva } = extractBases(infoF.totalConImpuestos);
      const formaPago = extractFormaPago(infoF.pagos || comprobante.pagos);
      const tipoIdReceptor = infoF.tipoIdentificacionComprador?.toString() || '04';

      return {
        ...basePayload,
        tipoDocumento: 'FACTURA',
        fechaEmision: infoF.fechaEmision || '',
        rucReceptor: infoF.identificacionComprador?.toString() || '',
        tipoIdentificacionReceptor: tipoIdReceptor,
        base12,
        base0,
        baseNoObjeto,
        baseExenta,
        iva,
        total: parseFloat(infoF.importeTotal || 0),
        formaPago,
        // alias retrocompat
        baseImponible: base12,
      };
    }

    // ─── COMPROBANTE DE RETENCIÓN ─────────────────────────────
    if (tipo === 'COM_RETENCION') {
      const infoCompR = comprobante.infoCompRetencion;
      let docsSustentoArray: any[] = [];
      if (comprobante.docsSustento?.docSustento) {
        docsSustentoArray = Array.isArray(comprobante.docsSustento.docSustento)
          ? comprobante.docsSustento.docSustento
          : [comprobante.docsSustento.docSustento];
      }

      let totalRetenido = 0;
      let totalRetenidoRenta = 0;
      let totalRetenidoIVA = 0;

      const docsSustentoFinal: SRIRetencionDocSustento[] = docsSustentoArray.map((doc: any) => {
        let retencionesArray: any[] = [];
        if (doc.retenciones?.retencion) {
          retencionesArray = Array.isArray(doc.retenciones.retencion)
            ? doc.retenciones.retencion
            : [doc.retenciones.retencion];
        }

        const retencionesFinal: SRIRetencionDetalle[] = retencionesArray.map((r: any) => {
          const val = parseFloat(r.valorRetenido || 0);
          const codImpuesto = String(r.codigo || '1');
          const esIVA = codImpuesto === '4' || codImpuesto === '2';

          totalRetenido += val;
          if (esIVA) totalRetenidoIVA += val;
          else totalRetenidoRenta += val;

          return {
            codigo: codImpuesto,
            codigoRetencion: r.codigoRetencion?.toString() || '',
            baseImponible: parseFloat(r.baseImponible || 0),
            porcentajeRetener: parseFloat(r.porcentajeRetener || 0),
            valorRetenido: val,
            tipo: esIVA ? 'IVA' : 'RENTA',
          };
        });

        return {
          numDocSustento: doc.numDocSustento?.toString() || '',
          codDocSustento: doc.codDocSustento?.toString() || '01',
          fechaEmisionDocSustento: doc.fechaEmisionDocSustento || '',
          retenciones: retencionesFinal,
        };
      });

      return {
        ...basePayload,
        tipoDocumento: 'COM_RETENCION',
        fechaEmision: infoCompR.fechaEmision || '',
        rucReceptor: infoCompR.identificacionSujetoRetenido?.toString() || '',
        periodoFiscal: infoCompR.periodoFiscal || '',
        documentosSustento: docsSustentoFinal,
        totalRetenido: parseFloat(totalRetenido.toFixed(2)),
        totalRetenidoRenta: parseFloat(totalRetenidoRenta.toFixed(2)),
        totalRetenidoIVA: parseFloat(totalRetenidoIVA.toFixed(2)),
      };
    }

    // ─── NOTA DE CRÉDITO ─────────────────────────────────────
    if (tipo === 'NOTA_CREDITO') {
      const infoNC = comprobante.infoNotaCredito;
      const { base12, base0, baseNoObjeto, iva } = extractBases(infoNC.totalConImpuestos);
      const tipoIdReceptor = infoNC.tipoIdentificacionComprador?.toString() || '04';

      return {
        ...basePayload,
        tipoDocumento: 'NOTA_CREDITO',
        fechaEmision: infoNC.fechaEmision || '',
        rucReceptor: infoNC.identificacionComprador?.toString() || '',
        tipoIdentificacionReceptor: tipoIdReceptor,
        numDocModificado: infoNC.numDocModificado?.toString() || '',
        motivo: infoNC.motivo || '',
        valorModificacion: parseFloat(infoNC.valorModificacion || 0),
        base12,
        base0,
        baseNoObjeto,
        iva,
        // alias retrocompat
        baseImponible: base12,
      };
    }

    return null;
  } catch (error) {
    console.error("Error parsing SRI XML:", error);
    return null;
  }
};
