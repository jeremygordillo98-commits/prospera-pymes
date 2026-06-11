export interface TemplatePreset {
  id: string;
  name: string;
  subject: string;
  title: string;
  defaultText: string;
}

export const TEMPLATE_PRESETS: TemplatePreset[] = [
  {
    id: 'sri_alert',
    name: '🔴 Alerta de Obligaciones SRI',
    subject: 'Aviso Importante: Vencimiento de Obligaciones Tributarias SRI',
    title: 'Aviso de Obligaciones Tributarias',
    defaultText: 'Estimado cliente,\n\nLe escribimos para recordarle que el calendario de vencimientos del SRI para la presentación de sus declaraciones mensuales se encuentra próximo. \n\nPor favor, asegúrese de remitirnos toda su documentación (facturas físicas, comprobantes de retención manuales y reportes de caja) a la brevedad posible para procesar y presentar su declaración dentro del plazo legal y evitar multas.\n\nQuedamos a su entera disposición.'
  },
  {
    id: 'balance_delivery',
    name: '📄 Envío de Balance y Reportes',
    subject: 'Estados Financieros y Reporte de Caja Mensual',
    title: 'Reportes Financieros del Mes',
    defaultText: 'Estimado cliente,\n\nAdjunto a este correo compartimos con usted el Balance General, Estado de Resultados y Reporte de Caja correspondiente al último mes.\n\nHemos consolidado la información contable y los números muestran un desempeño óptimo en el flujo de caja del negocio. Le sugerimos revisar en detalle los reportes adjuntos.\n\nCualquier duda o comentario que tenga, con gusto la revisaremos juntos.'
  },
  {
    id: 'payment_reminder',
    name: '💰 Notificación de Cobro Pendiente',
    subject: 'Recordatorio Amistoso: Saldo Pendiente de Pago',
    title: 'Notificación de Saldo Pendiente',
    defaultText: 'Estimado cliente,\n\nLe escribimos para enviararle un saludo cordial y, al mismo tiempo, recordarle de forma amistosa que tiene un saldo pendiente de pago correspondiente a sus servicios contables contratados.\n\nLe agradecemos realizar la transferencia bancaria a las cuentas autorizadas a la brevedad para poder mantener el despacho normal de sus reportes y la gestión contable de su negocio.\n\nMuchas gracias por su confianza y colaboración.'
  },
  {
    id: 'general_notice',
    name: '✉️ Comunicado General',
    subject: 'Comunicado Importante de su Asesor Contable',
    title: 'Comunicado General',
    defaultText: 'Estimado cliente,\n\nPor medio del presente comunicado, queremos compartir con usted información relevante acerca de los nuevos lineamientos de control interno y entrega de documentación contable.\n\nA partir de este mes, estaremos aplicando mejoras en el flujo de recepción para automatizar las cargas del SRI de forma más ágil.\n\nAgradecemos de antemano su colaboración y seguimos trabajando para brindarle el mejor servicio.'
  }
];
