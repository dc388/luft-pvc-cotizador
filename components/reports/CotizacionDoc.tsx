import type { Brand, ColorItem, FrameNode, GlassItem, System } from "@/types/domain";
import type { QuoteCalc } from "@/lib/calc";
import type { CompanySettings } from "@/lib/companySettings";
import { WindowDiagram } from "@/components/editor/WindowDiagram";
import { CustomerQuoteDocument, type QuoteDocumentItem } from "./CustomerQuoteDocument";

function fmtDate(iso: string) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function todayStr() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

type Props = {
  calc: QuoteCalc;
  sys: System;
  glass: GlassItem;
  color: ColorItem;
  brand: Brand;
  tree: FrameNode;
  width: number;
  height: number;
  qty: number;
  code: string;
  designation: string;
  location: string;
  client: string;
  clientAddress: string;
  deliveryDate: string;
  configSummary: string;
  termsHeader?: string;
  paymentTerms?: string;
  company: CompanySettings;
};

const DEFAULT_TERMS_HEADER = "Estimado/a, según sus indicaciones presentamos la oferta de los productos solicitados. A continuación encontrará el desglose de cada elemento.";
const DEFAULT_PAYMENT_TERMS = "70% al momento de aprobación y firma del presupuesto. 30% al aviso de embarque de cancelería o vidrio.";

export function CotizacionDoc({
  calc,
  sys,
  glass,
  color,
  brand,
  tree,
  width,
  height,
  qty,
  code,
  designation,
  location,
  client,
  clientAddress,
  deliveryDate,
  configSummary,
  termsHeader,
  paymentTerms,
  company,
}: Props) {
  const tax = calc.total * 0.16;
  const total = calc.total + tax;
  const depositAmount = total * company.depositPercentage / 100;
  const item: QuoteDocumentItem = {
    id: code,
    code,
    title: designation,
    location,
    specs: [
      ["Dimensiones", `${width.toLocaleString("es-MX")} × ${height.toLocaleString("es-MX")} mm`],
      ["Perfil del sistema", `${brand} · ${sys.name}`],
      ["Marco / color", color.name],
      ["Configuración", configSummary],
      ["Fittings", `Herrajes ${brand} · instalación incluida`],
      ["Vidrio", glass.name],
      ["Tipo de apertura", configSummary],
    ],
    diagram: <WindowDiagram tree={tree} width={width} height={height} color={color} system={sys} />,
    widthMm: width,
    heightMm: height,
    areaM2: calc.area,
    quantity: qty,
    unitPrice: calc.sale,
    lineTotal: calc.total,
  };

  return (
    <CustomerQuoteDocument
      quoteNumber={code}
      client={client}
      clientAddress={clientAddress}
      project={[designation, location].filter(Boolean).join(" · ")}
      quoteDate={todayStr()}
      deliveryDate={fmtDate(deliveryDate)}
      vendorLabel={brand.toUpperCase()}
      intro={termsHeader || DEFAULT_TERMS_HEADER}
      items={[item]}
      totals={{
        subtotal: calc.total,
        tax,
        total,
        depositPercentage: company.depositPercentage,
        depositAmount,
        remainingBalance: total - depositAmount,
      }}
      paymentTerms={paymentTerms || DEFAULT_PAYMENT_TERMS}
      company={company}
      showBankDetails
    />
  );
}
