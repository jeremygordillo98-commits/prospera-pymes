export interface DocAnulado {
    id: string;
    clave_acceso_xml: string;
    base_12: number;
    base_0: number;
    base_no_objeto: number;
    monto_iva: number;
    es_compra: boolean | null;
    retenciones_aplicadas: Array<{ base: number; valor: number; tipo: string }> | null;
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

// Parsea el concepto [ANULADO] para extraer motivo, fecha, concepto original y valores originales
export const parseConceptoAnulado = (concepto: string) => {
    // Regex con ValoresOriginales opcionales al final
    const regex = /^\[ANULADO\]\s*Motivo:\s*(.*?)\s*\|\s*Fecha:\s*(.*?)\s*\|\s*(.*?)(?:\s*\|\s*ValoresOriginales:\s*(.*))?$/;
    const match = concepto.match(regex);
    if (match) {
        let valoresOriginales = null;
        if (match[4]) {
            try { valoresOriginales = JSON.parse(match[4]); } catch {}
        }
        return {
            motivo: match[1],
            fechaAnulacion: match[2],
            conceptoOriginal: match[3],
            valoresOriginales
        };
    }
    return {
        motivo: null,
        fechaAnulacion: null,
        conceptoOriginal: concepto.replace(/^\[ANULADO\]\s*/, ''),
        valoresOriginales: null
    };
};

// Extrae el número SRI del concepto, numero_comprobante o clave_acceso_xml
export const extractXmlNumero = (concepto: string, numComp: string, clave: string): string | null => {
    const sriRegex = /\d{3}-\d{3}-\d{9}/;
    const m = concepto.match(sriRegex);
    if (m) return m[0];
    if (sriRegex.test(numComp.trim())) return numComp.trim();
    if (clave.length >= 39) return `${clave.substring(24,27)}-${clave.substring(27,30)}-${clave.substring(30,39)}`;
    return null;
};

// Obtiene el tipo de documento anulado
export const getAnuladoTipo = (doc: DocAnulado): 'XML Compras' | 'XML Ventas' | 'Pago a Proveedor' | 'Cobro a Cliente' => {
    if (doc.es_compra === true) return 'XML Compras';
    if (doc.es_compra === false) return 'XML Ventas';
    const concepto = (doc.transacciones?.concepto || '').toLowerCase();
    if (concepto.includes('cobro') || concepto.includes('ingreso') || concepto.includes('cliente')) {
        return 'Cobro a Cliente';
    }
    return 'Pago a Proveedor';
};
