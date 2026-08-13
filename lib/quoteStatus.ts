/** Etapas comerciales de una cotización, en el orden real del proceso.
 *
 *  Es una lista de valores válidos, no una máquina de estados: hoy el panel interno permite
 *  moverla a cualquier etapa porque el proceso real no es lineal (una visita se reprograma, un
 *  anticipo se recibe antes de la medición). Las transiciones se restringirán cuando exista
 *  autenticación por usuario y quede claro quién puede mover qué -- ver PROCESO_POST_COTIZACION.md.
 *
 *  Los identificadores no llevan acentos ni espacios porque viajan en la base y en la URL; la
 *  etiqueta que se lee está en `QUOTE_STATUS_LABEL`.
 */
export const QUOTE_STATUSES = [
  "nueva",
  "generada",
  "pendiente-contacto",
  "contactado",
  "visita-programada",
  "medicion-realizada",
  "pendiente-anticipo",
  "anticipo-recibido",
  "en-fabricacion",
  "instalacion-programada",
  "finalizado",
  "cancelado",
] as const;

export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const QUOTE_STATUS_LABEL: Record<QuoteStatus, string> = {
  nueva: "Nueva cotización",
  generada: "Cotización generada",
  "pendiente-contacto": "Pendiente de contacto",
  contactado: "Contactado",
  "visita-programada": "Visita programada",
  "medicion-realizada": "Medición realizada",
  "pendiente-anticipo": "Pendiente de anticipo",
  "anticipo-recibido": "Anticipo recibido",
  "en-fabricacion": "En fabricación",
  "instalacion-programada": "Instalación programada",
  finalizado: "Finalizado",
  cancelado: "Cancelado",
};

/** Etapa con la que nace una cotización enviada desde /cotizar: el documento ya se generó. */
export const INITIAL_QUOTE_STATUS: QuoteStatus = "generada";

export function isQuoteStatus(value: unknown): value is QuoteStatus {
  return typeof value === "string" && (QUOTE_STATUSES as readonly string[]).includes(value);
}

export function quoteStatusLabel(value: string): string {
  return isQuoteStatus(value) ? QUOTE_STATUS_LABEL[value] : value;
}

/** Motivos por los que se cae una cotización.
 *
 *  Es una lista cerrada y no un texto libre por dos razones. Una: solo así se puede contar cuál es el
 *  motivo más frecuente, que es lo que sirve para mejorar. Y dos, la que decide: el motivo se guarda
 *  además en las estadísticas de mejora (ver lib/learning.ts), y esa tabla no puede contener datos
 *  personales. Un texto libre acabaría diciendo "el cliente Juan no contestó el teléfono"; una lista
 *  cerrada no puede. La nota libre de la bitácora sigue existiendo y sigue siendo libre -- esa vive
 *  en `quote_events`, junto al expediente del cliente, donde ese dato sí corresponde. */
export const QUOTE_REJECTION_REASONS = [
  "precio",
  "tiempo-de-entrega",
  "eligio-competencia",
  "proyecto-cancelado",
  "sin-respuesta",
  "fuera-de-alcance",
  "otro",
] as const;

export type QuoteRejectionReason = (typeof QUOTE_REJECTION_REASONS)[number];

export const QUOTE_REJECTION_REASON_LABEL: Record<QuoteRejectionReason, string> = {
  precio: "Precio",
  "tiempo-de-entrega": "Tiempo de entrega",
  "eligio-competencia": "Eligió a la competencia",
  "proyecto-cancelado": "El proyecto se canceló",
  "sin-respuesta": "El cliente no respondió",
  "fuera-de-alcance": "Fuera de nuestro alcance",
  otro: "Otro motivo",
};

export function isQuoteRejectionReason(value: unknown): value is QuoteRejectionReason {
  return typeof value === "string" && (QUOTE_REJECTION_REASONS as readonly string[]).includes(value);
}

export function quoteRejectionReasonLabel(value: string): string {
  return isQuoteRejectionReason(value) ? QUOTE_REJECTION_REASON_LABEL[value] : value;
}
