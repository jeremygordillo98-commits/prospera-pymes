// ============================================================
// CATÁLOGOS SRI VIGENTES — Prospera Pymes
// Fuente: Resoluciones SRI 2024-2025
// ============================================================

export interface ISRIRetencion {
  codigo: string;
  descripcion: string;
  porcentaje: number;
}

// ─── RETENCIONES EN LA FUENTE DE RENTA ──────────────────────
export const CATALOGO_RETENCIONES_RENTA: ISRIRetencion[] = [
  // --- Sin Retención (default) ---
  { codigo: '000', descripcion: 'No aplica retención en la fuente', porcentaje: 0 },
  // --- Servicios ---
  { codigo: '303', descripcion: 'Honorarios profesionales y demás pagos por servicios relacionados con el título profesional', porcentaje: 10 },
  { codigo: '304', descripcion: 'Servicios de docencia dictados de forma independiente (sin relación de dependencia)', porcentaje: 8 },
  { codigo: '308', descripcion: 'Servicios prestados por deportistas, entrenadores, árbitros y miembros del cuerpo técnico', porcentaje: 8 },
  { codigo: '310', descripcion: 'Arrendamiento de bienes inmuebles', porcentaje: 8 },
  { codigo: '312', descripcion: 'Servicios prestados por personas naturales sin título profesional habilitante', porcentaje: 2 },
  { codigo: '312A', descripcion: 'Servicios prestados por sociedades', porcentaje: 2.75 },
  { codigo: '320', descripcion: 'Honorarios y comisiones a intermediarios y auxiliares de seguros', porcentaje: 8 },
  { codigo: '322', descripcion: 'Servicios de transporte privado de pasajeros y carga', porcentaje: 1 },
  { codigo: '323A', descripcion: 'Pagos a notarios y registradores de la propiedad y mercantil por sus actividades notariales', porcentaje: 8 },
  { codigo: '325', descripcion: 'Seguros y reaseguros (primas y cesiones)', porcentaje: 1 },
  { codigo: '327', descripcion: 'Préstamos de socios / accionistas a la sociedad', porcentaje: 0 },
  { codigo: '328', descripcion: 'Servicios de publicidad y comunicación', porcentaje: 2.75 },
  { codigo: '331', descripcion: 'Servicios de telecomunicaciones (TV cable, internet, telefonía)', porcentaje: 2.75 },
  { codigo: '332', descripcion: 'Otras retenciones no especificadas en el 1% (Naturales)', porcentaje: 2 },
  { codigo: '332A', descripcion: 'Otras retenciones no especificadas en el 1% (Sociedades)', porcentaje: 2.75 },
  // --- Bienes ---
  { codigo: '314', descripcion: 'Compra de bienes muebles de naturaleza corporal (Personas Naturales)', porcentaje: 1 },
  { codigo: '314A', descripcion: 'Compra de bienes muebles de naturaleza corporal (Sociedades)', porcentaje: 1.75 },
  { codigo: '319', descripcion: 'Compra de bienes de origen agrícola, avícola, pecuario, apícola, cunícula, bioacuático y forestal (Naturales)', porcentaje: 1 },
  { codigo: '319A', descripcion: 'Compra de bienes de origen agrícola, avícola, pecuario, apícola, cunícula, bioacuático y forestal (Sociedades)', porcentaje: 1.75 },
  // --- RIMPE / Negocios Populares ---
  { codigo: '332G', descripcion: 'Compra local a contribuyentes RIMPE - Emprendedores (bienes y servicios)', porcentaje: 1 },
  { codigo: '332H', descripcion: 'Compra local a contribuyentes RIMPE - Negocios Populares', porcentaje: 1 },
];

// ─── RETENCIONES DE IVA ─────────────────────────────────────
export interface ISRIRetencionIVA {
  codigo: string;
  descripcion: string;
  porcentaje: number; // Porcentaje del IVA a retener (30, 50, 70, 100)
}

export const CATALOGO_RETENCIONES_IVA: ISRIRetencionIVA[] = [
  { codigo: '721', descripcion: 'Bienes gravados con tarifa diferente de 0% de IVA — 30% del IVA causado', porcentaje: 30 },
  { codigo: '723', descripcion: 'Servicios gravados con tarifa diferente de 0% de IVA — 50% del IVA causado', porcentaje: 50 },
  { codigo: '725', descripcion: 'Servicios profesionales — 70% del IVA causado', porcentaje: 70 },
  { codigo: '727', descripcion: 'Retención 100% del IVA causado (contratos con el Estado, sector público, etc.)', porcentaje: 100 },
  { codigo: '729', descripcion: 'No aplica retención de IVA', porcentaje: 0 },
];

// ─── TIPOS DE IDENTIFICACIÓN ─────────────────────────────────
export interface ISRITipoIdentificacion {
  codigo: string;
  descripcion: string;
}

export const CATALOGO_TIPOS_IDENTIFICACION: ISRITipoIdentificacion[] = [
  { codigo: '04', descripcion: 'RUC' },
  { codigo: '05', descripcion: 'Cédula de identidad' },
  { codigo: '06', descripcion: 'Pasaporte' },
  { codigo: '07', descripcion: 'Consumidor Final' },
  { codigo: '08', descripcion: 'Identificación del Exterior' },
  { codigo: '09', descripcion: 'Placa' },
];

// ─── SUSTENTO TRIBUTARIO (para ATS) ─────────────────────────
export interface ISRISustentoTributario {
  codigo: string;
  descripcion: string;
}

export const CATALOGO_SUSTENTO_TRIBUTARIO: ISRISustentoTributario[] = [
  { codigo: '01', descripcion: 'Crédito Tributario para declaración de IVA (servicios y bienes distintos de inventarios)' },
  { codigo: '02', descripcion: 'Costo o Gasto para declaración de IR (bienes no inventariables)' },
  { codigo: '03', descripcion: 'Activo Fijo — Depreciable' },
  { codigo: '04', descripcion: 'Inventario' },
  { codigo: '05', descripcion: 'Activo Fijo — No Depreciable' },
  { codigo: '06', descripcion: 'Inventario de Construcción en Proceso' },
  { codigo: '07', descripcion: 'Crédito Tributario para declaración de IVA (bienes de inventario)' },
  { codigo: '08', descripcion: 'Crédito Tributario para declaración de IR' },
  { codigo: '09', descripcion: 'Pagos al Exterior (importaciones de servicios)' },
  { codigo: '10', descripcion: 'Anticipo de dividendos' },
  { codigo: '11', descripcion: 'Anticipo de utilidades' },
  { codigo: '12', descripcion: 'Anticipo de capital' },
  { codigo: '13', descripcion: 'Anticipo de regalías' },
  { codigo: '14', descripcion: 'Regalías' },
  { codigo: '15', descripcion: 'Dividendos' },
];

// ─── FORMAS DE PAGO (para ATS) ──────────────────────────────
export interface ISRIFormaPago {
  codigo: string;
  descripcion: string;
}

export const CATALOGO_FORMAS_PAGO: ISRIFormaPago[] = [
  { codigo: '01', descripcion: 'Sin utilización del sistema financiero' },
  { codigo: '15', descripcion: 'Compensación de deudas' },
  { codigo: '16', descripcion: 'Tarjeta de débito' },
  { codigo: '17', descripcion: 'Dinero electrónico' },
  { codigo: '18', descripcion: 'Tarjeta prepago' },
  { codigo: '19', descripcion: 'Tarjeta de crédito' },
  { codigo: '20', descripcion: 'Otros con utilización del sistema financiero' },
  { codigo: '21', descripcion: 'Endoso de títulos' },
];

// ─── TIPOS DE DOCUMENTO SRI ──────────────────────────────────
export interface ISRITipoDocumento {
  codigo: string;
  descripcion: string;
}

export const CATALOGO_TIPOS_DOCUMENTO: ISRITipoDocumento[] = [
  { codigo: '01', descripcion: 'Factura' },
  { codigo: '03', descripcion: 'Liquidación de compra de bienes y prestación de servicios' },
  { codigo: '04', descripcion: 'Nota de crédito' },
  { codigo: '05', descripcion: 'Nota de débito' },
  { codigo: '06', descripcion: 'Guía de remisión' },
  { codigo: '07', descripcion: 'Comprobante de retención' },
  { codigo: '41', descripcion: 'Reembolso de gastos' },
];

/**
 * Infiere el código de Sustento Tributario del SRI basándose en el tipo,
 * código de cuenta y nombre de la cuenta contable asociada al Debe.
 */
export const inferSustentoTributario = (account?: { tipo?: string; codigo_cuenta?: string; nombre?: string } | null): string => {
  if (!account) return '01';
  
  const tipo = (account.tipo || '').toLowerCase();
  const codigo = (account.codigo_cuenta || '');
  const nombre = (account.nombre || '').toLowerCase();

  // 1. Costo o Gasto (código 02): Si la cuenta es de tipo 'Gasto' o su código inicia con '5'
  if (tipo === 'gasto' || codigo.startsWith('5')) {
    return '02';
  }

  // 2. Activo Fijo Depreciable (código 03): Si el código empieza con '1.2'
  // o el nombre contiene palabras clave de activos fijos
  if (
    codigo.startsWith('1.2') || 
    nombre.includes('activo fijo') || 
    nombre.includes('maquinaria') || 
    nombre.includes('vehiculo') || 
    nombre.includes('muebles') || 
    nombre.includes('equipo de comput') ||
    nombre.includes('propiedad, planta') ||
    nombre.includes('terreno') ||
    nombre.includes('edificio')
  ) {
    return '03';
  }

  // 3. Inventario (código 04): Si el código empieza con '1.1.03' o contiene 'inventario' o 'mercaderia'
  if (
    codigo.startsWith('1.1.03') || 
    nombre.includes('inventario') || 
    nombre.includes('mercaderia')
  ) {
    return '04';
  }

  // 4. Crédito Tributario General (código 01): Default
  return '01';
};
