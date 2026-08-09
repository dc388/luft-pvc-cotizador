import type { Metadata } from "next";
import { buildPublicCatalog } from "@/lib/publicCatalog";
import { QuoteWizard } from "@/components/cotizar/QuoteWizard";

export const metadata: Metadata = {
  title: "Cotiza tu ventana de PVC · LUFT PVC",
  description: "Arma tu ventana o puerta de PVC y conoce el precio al momento.",
};

// Server component: el catálogo público se arma en el servidor a partir de data/*.ts (que
// contiene tarifas) y solo su vista pública -- nombres, colores, beneficios y límites de
// medida -- viaja al navegador como props. Ninguna lista de precios llega al cliente.
export default function CotizarPage() {
  return <QuoteWizard catalog={buildPublicCatalog()} />;
}
