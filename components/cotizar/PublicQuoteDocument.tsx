import { CustomerQuoteDocument, type QuoteDocumentItem } from "@/components/reports/CustomerQuoteDocument";
import { WindowPreview } from "./WindowPreview";

export type PublicQuotePrintableItem = {
  id: string;
  productName: string;
  styleName: string;
  brandName: string;
  panels: number;
  widthMm: number;
  heightMm: number;
  quantity: number;
  colorName: string;
  frameHex: string;
  glassName: string;
  extras: { instalacion: boolean; persianaExterior: boolean; mosquitero: boolean };
  price: {
    unit: number;
    total: number;
    estimated: boolean;
    hasQuoteOnRequestItems: boolean;
  };
};

type Props = {
  folio: string;
  client: { name: string; city: string };
  items: PublicQuotePrintableItem[];
  price: {
    total: number;
    estimated: boolean;
    depositPercentage: number;
    deposit: number;
    remaining: number;
  };
};

function todayStr() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export function PublicQuoteDocument({ folio, client, items, price }: Props) {
  const documentItems: QuoteDocumentItem[] = items.map((item, index) => {
    const extrasText = [
      item.extras.instalacion ? "Instalación incluida" : "Sin instalación",
      item.extras.persianaExterior ? "Persiana exterior" : "",
      item.extras.mosquitero ? "Mosquitero por cotizar" : "",
    ].filter(Boolean).join(" · ");
    const areaM2 = item.widthMm * item.heightMm / 1_000_000;

    return {
      id: item.id,
      code: `${folio}-${String(index + 1).padStart(2, "0")}`,
      title: `${item.productName} · ${item.styleName}`,
      location: client.city,
      specs: [
        ["Producto", `${item.productName} · ${item.styleName}`],
        ["Dimensiones preliminares", `${item.widthMm.toLocaleString("es-MX")} × ${item.heightMm.toLocaleString("es-MX")} mm`],
        ["Perfil del sistema", item.brandName],
        ["Marco / color", item.colorName],
        ["Vidrio", item.glassName],
        ["Extras", extrasText],
        ["Cantidad", `${item.quantity} ${item.quantity === 1 ? "pieza" : "piezas"}`],
      ],
      diagram: <WindowPreview panels={item.panels} widthMm={item.widthMm} heightMm={item.heightMm} frameHex={item.frameHex} />,
      widthMm: item.widthMm,
      heightMm: item.heightMm,
      areaM2,
      quantity: item.quantity,
      unitPrice: item.price.unit,
      lineTotal: item.price.total,
    };
  });
  const totalPieces = items.reduce((sum, item) => sum + item.quantity, 0);
  const brands = [...new Set(items.map((item) => item.brandName.toUpperCase()))].join(" · ");

  return (
    <CustomerQuoteDocument
      quoteNumber={folio}
      client={client.name}
      clientAddress={client.city}
      project={`${items.length} ${items.length === 1 ? "configuración" : "configuraciones"} · ${totalPieces} ${totalPieces === 1 ? "pieza" : "piezas"}`}
      quoteDate={todayStr()}
      vendorLabel={brands}
      intro="Gracias por cotizar con LUFT PVC. Esta propuesta reúne las configuraciones de tu proyecto y será revisada por un asesor antes de continuar."
      items={documentItems}
      totals={{
        subtotal: price.total,
        total: price.total,
        depositPercentage: price.depositPercentage,
        depositAmount: price.deposit,
        remainingBalance: price.remaining,
      }}
      preliminary
      estimated={price.estimated}
      paymentTerms={`El depósito estimado de ${price.depositPercentage}% se solicita únicamente después de validar medidas y confirmar el precio final.`}
    />
  );
}
