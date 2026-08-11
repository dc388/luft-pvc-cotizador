// Eventos del embudo del cotizador público.
//
// Deja preparada la medición sin instalar ninguna herramienta: se empuja al `dataLayer` estándar
// si la página lo tiene, y si no, no pasa nada. Cuando el negocio decida qué analítica usar, se
// conecta ahí sin volver a tocar el cotizador.
//
// NO SE MANDA NADA PERSONAL. Ni nombre, ni teléfono, ni correo, ni ciudad, ni el folio (que
// identifica a una persona en nuestra base). Solo la etapa y datos agregados de configuración:
// qué producto, qué estilo, cuántos diseños. Tampoco importes -- el navegador ya no los conoce.

export type PublicFunnelEvent =
  | "quotation_started"
  | "product_selected"
  | "dimensions_completed"
  | "configuration_completed"
  | "customer_data_completed"
  | "quotation_generated"
  | "pdf_opened";

type FunnelPayload = {
  productId?: string;
  styleId?: string;
  glassId?: string;
  colorId?: string;
  designCount?: number;
  installation?: boolean;
};

type DataLayerWindow = Window & { dataLayer?: Array<Record<string, unknown>> };

export function trackPublicFunnel(event: PublicFunnelEvent, payload: FunnelPayload = {}): void {
  if (typeof window === "undefined") return;
  try {
    const target = window as DataLayerWindow;
    if (!Array.isArray(target.dataLayer)) return;
    target.dataLayer.push({ event, ...payload });
  } catch {
    // La medición nunca puede romper una cotización.
  }
}
