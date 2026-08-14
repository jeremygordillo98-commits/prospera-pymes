import ReactGA from "react-ga4";

const GA_MEASUREMENT_ID = (import.meta.env.VITE_GA_MEASUREMENT_ID as string) || "G-P1XQS1WPC7";

let isInitialized = false;

/**
 * Inicializa Google Analytics 4 en Prospera Pymes
 */
export const initGA = () => {
  if (isInitialized) return;
  try {
    ReactGA.initialize(GA_MEASUREMENT_ID);
    isInitialized = true;
    console.log(`[Analytics] GA4 inicializado con ID: ${GA_MEASUREMENT_ID}`);
  } catch (error) {
    console.error("[Analytics] Error al inicializar GA4:", error);
  }
};

/**
 * Registra una vista de página en GA4
 */
export const trackPageView = (path: string, title?: string) => {
  if (!isInitialized) initGA();
  try {
    ReactGA.send({
      hitType: "pageview",
      page: path,
      title: title || document.title,
    });
  } catch (error) {
    console.error("[Analytics] Error al registrar pageview:", error);
  }
};

/**
 * Registra un evento personalizado en GA4
 */
export const trackEvent = (
  category: string,
  action: string,
  label?: string,
  value?: number
) => {
  if (!isInitialized) initGA();
  try {
    ReactGA.event({
      category,
      action,
      label,
      value,
    });
  } catch (error) {
    console.error("[Analytics] Error al registrar evento:", error);
  }
};

// --- HELPERS ESPECÍFICOS DEL DOMINIO TRIBUTARIO & CONTABLE (PYMES) ---

export const trackXmlUpload = (count: number, type: 'compras' | 'ventas') => {
  trackEvent('SRI_XML', 'upload_xml_invoices', `${type}_count_${count}`, count);
};

export const trackAtsGeneration = (periodo: string) => {
  trackEvent('SRI_ATS', 'generate_ats_sri', `periodo_${periodo}`);
};

export const trackAtsExcelExport = (periodo: string) => {
  trackEvent('SRI_ATS', 'export_ats_excel', `periodo_${periodo}`);
};

export const trackRidePdfDownload = (tipoDoc: string) => {
  trackEvent('DOCUMENTOS', 'download_ride_pdf', tipoDoc);
};

export const trackAsientoManualCreate = (lineasCount: number) => {
  trackEvent('CONTABILIDAD', 'create_asiento_manual', `lineas_${lineasCount}`, lineasCount);
};

export const trackReportExport = (reporteName: string, format: 'pdf' | 'excel') => {
  trackEvent('REPORTES', `export_${format}_report`, reporteName);
};
