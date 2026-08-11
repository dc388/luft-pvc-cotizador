import { CustomerQuoteDocument, type QuoteDocumentItem } from "@/components/reports/CustomerQuoteDocument";
import type { QuoteSnapshot } from "@/types/quote";
import { WindowPreview } from "./WindowPreview";

// El documento definitivo del cotizador público. Se arma desde el snapshot congelado
// (lib/quoteDocument.ts) y es el ÚNICO lugar donde el cliente ve un importe.
//
// Antes recibía los renglones y el precio como props desde el navegador, que era lo que obligaba
// al cotizador a conocer los importes durante toda la configuración. Ahora recibe una estructura
// que solo existe después de registrar la cotización, y que el servidor le entrega ya resuelta.

function documentDate(issuedAt: string): string {
  const date = new Date(issuedAt);
  if (Number.isNaN(date.getTime())) return "";
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
}

export function PublicQuoteDocument({ snapshot }: { snapshot: QuoteSnapshot }) {
  const { folio, customer, project, items, totals } = snapshot;
  const documentItems: QuoteDocumentItem[] = items.map((item) => {
    const extrasText = item.extras.instalacion ? "Instalación incluida" : "Sin instalación";
    const areaM2 = (item.widthMm * item.heightMm) / 1_000_000;

    return {
      id: item.id,
      code: item.id,
      title: `${item.productName} · ${item.styleName}`,
      location: customer.address || customer.city,
      specs: [
        ["Producto", `${item.productName} · ${item.styleName}`],
        ["Dimensiones preliminares", `${item.widthMm.toLocaleString("es-MX")} × ${item.heightMm.toLocaleString("es-MX")} mm`],
        ["Perfilería", item.brandName],
        ["Marco / color", item.colorName],
        ["Vidrio", item.glassName],
        ["Extras", extrasText],
        ["Cantidad", `${item.quantity} ${item.quantity === 1 ? "pieza" : "piezas"}`],
      ],
      diagram: <WindowPreview wings={item.wings} widthMm={item.widthMm} heightMm={item.heightMm} frameHex={item.frameHex} glassName={item.glassName} label={`Vista previa de ${item.styleName}`} />,
      widthMm: item.widthMm,
      heightMm: item.heightMm,
      areaM2,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
    };
  });
  const totalPieces = items.reduce((sum, item) => sum + item.quantity, 0);
  const brands = [...new Set(items.map((item) => item.brandName.toUpperCase()).filter(Boolean))].join(" · ");
  const contactLine = [customer.phone, customer.email].filter(Boolean).join(" · ");

  return (
    <CustomerQuoteDocument
      quoteNumber={folio}
      client={[customer.name, customer.company].filter(Boolean).join(" · ")}
      clientAddress={[customer.address, customer.city, customer.postalCode].filter(Boolean).join(", ")}
      clientContact={contactLine}
      project={project.name || `${items.length} ${items.length === 1 ? "configuración" : "configuraciones"} · ${totalPieces} ${totalPieces === 1 ? "pieza" : "piezas"}`}
      quoteDate={documentDate(snapshot.issuedAt)}
      vendorLabel={brands}
      intro="Gracias por cotizar con LUFT PVC. Esta propuesta reúne las configuraciones de tu proyecto y será revisada por un asesor antes de continuar."
      notes={project.notes}
      items={documentItems}
      totals={{
        subtotal: totals.subtotal,
        total: totals.total,
        depositPercentage: totals.depositPercentage,
        depositAmount: totals.deposit,
        remainingBalance: totals.remaining,
      }}
      preliminary
      estimated={totals.estimated}
      paymentTerms={`El depósito de ${totals.depositPercentage}% se solicita únicamente después de validar medidas y confirmar el precio final.`}
    />
  );
}
