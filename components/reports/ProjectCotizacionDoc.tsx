import type { CompanySettings } from "@/lib/companySettings";
import type { ComponentRecord } from "@/types/project";
import { colorFor, glassFor, calcForComponent, sysFor } from "@/lib/projectReports";
import { walkLeaves, wingName } from "@/lib/tree";
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
  components: ComponentRecord[];
  projectName: string;
  client: string;
  clientAddress: string;
  deliveryDate: string;
  company: CompanySettings;
};

export function ProjectCotizacionDoc({ components, projectName, client, clientAddress, deliveryDate, company }: Props) {
  const items: QuoteDocumentItem[] = components.map((component) => {
    const calc = calcForComponent(component);
    const system = sysFor(component);
    const color = colorFor(component);
    const glass = glassFor(component);
    const openings = Array.from(new Set(walkLeaves(component.data.tree).map((leaf) => wingName(leaf.wing)))).join(" + ");

    return {
      id: component.id,
      code: component.code,
      title: component.designation,
      location: component.location,
      specs: [
        ["Ubicación", component.location || "—"],
        ["Dimensiones", `${component.widthMm.toLocaleString("es-MX")} × ${component.heightMm.toLocaleString("es-MX")} mm`],
        ["Perfil del sistema", `${component.brand} · ${system.name}`],
        ["Marco / color", color.name],
        ["Configuración", openings],
        ["Fittings", `Herrajes ${component.brand} · instalación incluida`],
        ["Vidrio", glass.name],
      ],
      diagram: <WindowDiagram tree={component.data.tree} width={component.widthMm} height={component.heightMm} color={color} system={system} />,
      widthMm: component.widthMm,
      heightMm: component.heightMm,
      areaM2: calc.area,
      quantity: component.qty,
      unitPrice: calc.sale,
      lineTotal: calc.total,
    };
  });
  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const tax = subtotal * 0.16;
  const total = subtotal + tax;
  const depositAmount = total * company.depositPercentage / 100;
  const first = components[0];
  const quoteNumber = first?.code ? `${first.code}${components.length > 1 ? ` +${components.length - 1}` : ""}` : projectName;
  const vendorLabel = Array.from(new Set(components.map((component) => component.brand))).join(" · ").toUpperCase();

  return (
    <CustomerQuoteDocument
      quoteNumber={quoteNumber}
      client={client || first?.data.client || ""}
      clientAddress={clientAddress || first?.data.clientAddress || ""}
      project={projectName}
      quoteDate={todayStr()}
      deliveryDate={fmtDate(deliveryDate || first?.data.deliveryDate || "")}
      vendorLabel={vendorLabel}
      intro={first?.data.termsHeader || "Estimado/a, presentamos la oferta integral de los componentes solicitados para este proyecto."}
      items={items}
      totals={{
        subtotal,
        tax,
        total,
        depositPercentage: company.depositPercentage,
        depositAmount,
        remainingBalance: total - depositAmount,
      }}
      paymentTerms={first?.data.paymentTerms}
      company={company}
      showBankDetails
    />
  );
}
