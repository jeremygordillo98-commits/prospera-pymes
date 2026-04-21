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

export interface SRIFacturaData extends SRIDocumentoBase {
  tipoDocumento: 'FACTURA';
  rucReceptor: string;
  baseImponible: number;
  iva: number;
  total: number;
}

export interface SRIRetencionDetalle {
  codigo: string | number;
  codigoRetencion: string;
  baseImponible: number;
  porcentajeRetener: number;
  valorRetenido: number;
}

export interface SRIRetencionData extends SRIDocumentoBase {
  tipoDocumento: 'COM_RETENCION';
  rucReceptor: string; // Sujeto retenido
  periodoFiscal: string;
  documentosSustento: {
    numDocSustento: string;
    fechaEmisionDocSustento: string;
    retenciones: SRIRetencionDetalle[];
  }[];
  totalRetenido: number;
}

export interface SRINotaCreditoData extends SRIDocumentoBase {
  tipoDocumento: 'NOTA_CREDITO';
  rucReceptor: string; // Comprador original
  numDocModificado: string; // Factura a la que afecta
  motivo: string;
  valorModificacion: number;
  baseImponible: number;
  iva: number;
}

export type SRIParsedData = SRIFacturaData | SRIRetencionData | SRINotaCreditoData;

// Mantener alias antiguo por retrocompatibilidad temporal
export type SRIInvoiceData = SRIFacturaData;

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
      claveAcceso: infoT.claveAcceso?.toString() || '',
      numeroComprobante: `${infoT.estab}-${infoT.ptoEmi}-${infoT.secuencial}`
    };

    if (tipo === 'FACTURA') {
      const infoF = comprobante.infoFactura;
      let base12 = 0;
      let iva = 0;

      if (infoF.totalConImpuestos?.totalImpuesto) {
        const impuestos = Array.isArray(infoF.totalConImpuestos.totalImpuesto)
          ? infoF.totalConImpuestos.totalImpuesto
          : [infoF.totalConImpuestos.totalImpuesto];

        const ivaImpuesto = impuestos.find((imp: any) => imp.codigo === '2' || imp.codigo === 2);
        if (ivaImpuesto) {
          base12 = parseFloat(ivaImpuesto.baseImponible || 0);
          iva = parseFloat(ivaImpuesto.valor || 0);
        }
      }
      return {
        ...basePayload,
        tipoDocumento: 'FACTURA',
        fechaEmision: infoF.fechaEmision || '',
        rucReceptor: infoF.identificacionComprador?.toString() || '',
        baseImponible: base12 || parseFloat(infoF.totalSinImpuestos || 0),
        iva,
        total: parseFloat(infoF.importeTotal || 0)
      };
    }

    if (tipo === 'COM_RETENCION') {
      const infoCompR = comprobante.infoCompRetencion;
      let docsSustentoArray = [];
      if (comprobante.docsSustento && comprobante.docsSustento.docSustento) {
        docsSustentoArray = Array.isArray(comprobante.docsSustento.docSustento)
          ? comprobante.docsSustento.docSustento
          : [comprobante.docsSustento.docSustento];
      }

      let totalRetenido = 0;
      const docsSustentoFinal = docsSustentoArray.map((doc: any) => {
        let retencionesArray = [];
        if (doc.retenciones && doc.retenciones.retencion) {
          retencionesArray = Array.isArray(doc.retenciones.retencion)
            ? doc.retenciones.retencion
            : [doc.retenciones.retencion];
        }

        const retencionesFinal: SRIRetencionDetalle[] = retencionesArray.map((r: any) => {
          const val = parseFloat(r.valorRetenido || 0);
          totalRetenido += val;
          return {
            codigo: r.codigo?.toString() || '',
            codigoRetencion: r.codigoRetencion?.toString() || '',
            baseImponible: parseFloat(r.baseImponible || 0),
            porcentajeRetener: parseFloat(r.porcentajeRetener || 0),
            valorRetenido: val
          };
        });

        return {
          numDocSustento: doc.numDocSustento?.toString() || '',
          fechaEmisionDocSustento: doc.fechaEmisionDocSustento || '',
          retenciones: retencionesFinal
        };
      });

      return {
        ...basePayload,
        tipoDocumento: 'COM_RETENCION',
        fechaEmision: infoCompR.fechaEmision || '',
        rucReceptor: infoCompR.identificacionSujetoRetenido?.toString() || '',
        periodoFiscal: infoCompR.periodoFiscal || '',
        documentosSustento: docsSustentoFinal,
        totalRetenido: parseFloat(totalRetenido.toFixed(2))
      };
    }

    if (tipo === 'NOTA_CREDITO') {
      const infoNC = comprobante.infoNotaCredito;

      let base12 = 0;
      let iva = 0;
      if (infoNC.totalConImpuestos?.totalImpuesto) {
        const impuestos = Array.isArray(infoNC.totalConImpuestos.totalImpuesto)
          ? infoNC.totalConImpuestos.totalImpuesto
          : [infoNC.totalConImpuestos.totalImpuesto];

        const ivaImpuesto = impuestos.find((imp: any) => imp.codigo === '2' || imp.codigo === 2);
        if (ivaImpuesto) {
          base12 = parseFloat(ivaImpuesto.baseImponible || 0);
          iva = parseFloat(ivaImpuesto.valor || 0);
        }
      }

      return {
        ...basePayload,
        tipoDocumento: 'NOTA_CREDITO',
        fechaEmision: infoNC.fechaEmision || '',
        rucReceptor: infoNC.identificacionComprador?.toString() || '',
        numDocModificado: infoNC.numDocModificado?.toString() || '',
        motivo: infoNC.motivo || '',
        valorModificacion: parseFloat(infoNC.valorModificacion || 0),
        baseImponible: base12 || parseFloat(infoNC.totalSinImpuestos || 0),
        iva
      };
    }

    return null;
  } catch (error) {
    console.error("Error parsing SRI XML:", error);
    return null;
  }
};
