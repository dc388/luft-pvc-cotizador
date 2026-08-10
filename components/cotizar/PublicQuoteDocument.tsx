import { CustomerQuoteDocument, type QuoteDocumentItem } from "@/components/reports/CustomerQuoteDocument";
import { WindowPreview } from "./WindowPreview";

type Props = {
  folio: string;
  client: { name: string; city: string };
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
    depositPercentage: number;
    deposit: number;
    remaining: number;
    hasQuoteOnRequestItems: boolean;
  };
};

function todayStr() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export function PublicQuoteDocument({
  folio,
  client,
  productName,
  styleName,
  brandName,
  panels,
  widthMm,
  heightMm,
  quantity,
  colorName,
  frameHex,
  glassName,
  extras,
  price,
}: Props) {
  const extrasText = [
    extras.instalacion ? "Instalación incluida" : "Sin instalación",
    extras.persianaExterior ? "Persiana exterior" : "",
    extras.mosquitero ? "Mosquitero por cotizar" : "",
  ].filter(Boolean).join(" · ");
  const areaM2 = widthMm * heightMm / 1_000_000;
  const item: QuoteDocumentItem = {
    id: folio,
    code: folio,
    title: `${productName} · ${styleName}`,
    location: client.city,
    specs: [
      ["Producto", `${productName} · ${styleName}`],
      ["Dimensiones preliminares", `${widthMm.toLocaleString("es-MX")} × ${heightMm.toLocaleString("es-MX")} mm`],
      ["Perfil del sistema", brandName],
      ["Marco / color", colorName],
      ["Vidrio", glassName],
      ["Extras", extrasText],
      ["Cantidad", `${quantity} ${quantity === 1 ? "pieza" : "piezas"}`],
    ],
    diagram: <WindowPreview panels={panels} widthMm={widthMm} heightMm={heightMm} frameHex={frameHex} />,
    widthMm,
    heightMm,
    areaM2,
    quantity,
    unitPrice: price.unit,
    lineTotal: price.total,
  };

  return (
    <CustomerQuoteDocument
      quoteNumber={folio}
      client={client.name}
      clientAddress={client.city}
      project={`${productName} · ${styleName}`}
      quoteDate={todayStr()}
      vendorLabel={brandName.toUpperCase()}
      intro="Gracias por cotizar con LUFT PVC. Esta propuesta resume la configuración que realizaste y será revisada por un asesor antes de continuar."
      items={[item]}
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
