/**
 * Helpers para Calendario Tributario y Declaraciones SRI Ecuador
 * Calcula el noveno dígito del RUC, la fecha límite oficial y el tiempo restante.
 */

// Tabla oficial SRI: 9º dígito del RUC -> Día límite de declaración mensual (Formulario 104 / 103)
export const SRI_DEADLINE_MAP: Record<number, number> = {
  1: 10,
  2: 12,
  3: 14,
  4: 16,
  5: 18,
  6: 20,
  7: 22,
  8: 24,
  9: 26,
  0: 28,
};

export interface SriDeadlineInfo {
  digito: number | null;
  diaVencimiento: number | null;
  fechaVencimientoActual: Date | null;
  diasRestantes: number | null;
  esVencido: boolean;
  esUrgente: boolean; // Menos de 4 días
}

/**
 * Obtiene el noveno dígito de un RUC ecuatoriano (13 dígitos)
 */
export const getNinthDigit = (ruc?: string | null): number | null => {
  if (!ruc) return null;
  const cleanRuc = ruc.replace(/\D/g, '');
  if (cleanRuc.length < 9) return null;
  const digitoChar = cleanRuc.charAt(8); // Posición 8 (índice 0-based) es el 9º dígito
  const digit = parseInt(digitoChar, 10);
  return isNaN(digit) ? null : digit;
};

/**
 * Calcula la información de vencimiento tributario del SRI para una empresa según su RUC
 */
export const calculateSriDeadline = (ruc?: string | null): SriDeadlineInfo => {
  const digito = getNinthDigit(ruc);
  if (digito === null || !(digito in SRI_DEADLINE_MAP)) {
    return {
      digito: null,
      diaVencimiento: null,
      fechaVencimientoActual: null,
      diasRestantes: null,
      esVencido: false,
      esUrgente: false,
    };
  }

  const diaVencimiento = SRI_DEADLINE_MAP[digito];
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed

  // Fecha de vencimiento para este mes
  let deadlineDate = new Date(year, month, diaVencimiento, 23, 59, 59);

  // Si ya pasó el vencimiento de este mes, calcular para el siguiente mes
  const diffTime = deadlineDate.getTime() - now.getTime();
  const diasRestantes = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const esVencido = diasRestantes < 0;
  const esUrgente = diasRestantes >= 0 && diasRestantes <= 3;

  return {
    digito,
    diaVencimiento,
    fechaVencimientoActual: deadlineDate,
    diasRestantes,
    esVencido,
    esUrgente,
  };
};
