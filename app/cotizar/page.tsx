import type { Metadata } from "next";
import { AutoUpdate } from "@/components/AutoUpdate";
import { buildPublicCatalog } from "@/lib/publicCatalog";
import { QuoteWizard } from "@/components/cotizar/QuoteWizard";

export const metadata: Metadata = {
  title: "Cotiza tu ventana de PVC · LUFT PVC",
  // Sin promesa de precio inmediato: el cliente configura y recibe su cotización formal. La
  // descripción es lo primero que se lee en Google y en WhatsApp, así que tiene que prometer
  // exactamente lo que el flujo entrega.
  description: "Arma tu ventana o puerta de PVC con perfil alemán Aluplast y recibe tu cotización formal.",
};

// Server component: el catálogo público se arma en el servidor a partir de data/*.ts (que
// contiene tarifas) y solo su vista pública -- nombres, colores, beneficios y límites de
// medida -- viaja al navegador como props. Ninguna lista de precios llega al cliente.
export default function CotizarPage() {
  return (
    <>
      <QuoteWizard catalog={buildPublicCatalog()} />
      <AutoUpdate />
    </>
  );
}
