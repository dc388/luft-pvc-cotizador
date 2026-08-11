import { buildPublicCatalog } from "@/lib/publicCatalog";
import { priceProjectConfigs, type PublicQuoteConfig } from "@/lib/publicQuote";
import type { QuoteSnapshot, QuoteSnapshotItem } from "@/types/quote";
import type { WingType } from "@/types/domain";

// Congela una cotización en el documento que se le entrega al cliente.
//
// SOLO SERVIDOR: es el único lugar donde el precio se resuelve para mostrarse. El cotizador
// nunca llama a esto; lo llama /api/public-quote/submit al registrar, y la página del documento
// solo lee lo que quedó guardado.

export type QuoteCustomerInput = {
  name: string;
  phone: string;
  email: string;
  company: string;
  city: string;
  postalCode: string;
  address: string;
};

export function buildQuoteSnapshot(
  configs: PublicQuoteConfig[],
  customer: QuoteCustomerInput,
  project: { name: string; notes: string },
  folio: string,
  issuedAt: string
): QuoteSnapshot {
  const catalog = buildPublicCatalog();
  const { price, itemPrices } = priceProjectConfigs(configs);

  const items: QuoteSnapshotItem[] = configs.map((config, index) => {
    const style = catalog.styles.find((entry) => entry.id === config.styleId);
    const product = catalog.products.find((entry) => entry.id === style?.productId);
    const brand = catalog.brands.find((entry) => entry.id === style?.brandId);
    const color = catalog.colors.find((entry) => entry.id === config.colorId && entry.brandId === style?.brandId);
    const glass = catalog.glass.find((entry) => entry.id === config.glassId);
    return {
      id: `${folio}-${String(index + 1).padStart(2, "0")}`,
      productName: product?.name ?? "Ventana",
      styleName: style?.name ?? "Configuración",
      brandName: brand?.name ?? "",
      panels: style?.panels ?? 1,
      wings: (style?.wings ?? ["fixed"]) as WingType[],
      widthMm: config.widthMm,
      heightMm: config.heightMm,
      quantity: config.qty,
      colorName: color?.name ?? "",
      frameHex: color?.hex ?? "#f3f3ef",
      glassName: glass?.name ?? "",
      extras: { instalacion: config.extras.instalacion },
      unitPrice: itemPrices[index].unit,
      lineTotal: itemPrices[index].total,
    };
  });

  return {
    version: 1,
    folio,
    issuedAt,
    customer,
    project,
    items,
    totals: {
      // El IVA no se desglosa: las tarifas del catálogo son las que usa la app interna y no
      // llevan impuesto separado. Cuando el negocio decida facturar con IVA visible, se agrega
      // aquí y el documento ya tiene su renglón (ver CustomerQuoteDocument).
      subtotal: price.total,
      total: price.total,
      estimated: price.estimated,
      depositPercentage: price.depositPercentage,
      deposit: price.deposit,
      remaining: price.remaining,
    },
  };
}

function str(value: unknown, max = 200): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/** Lee un snapshot guardado. Es JSON que escribimos nosotros, pero se valida campo por campo:
 *  una fila corrupta o de una versión anterior debe dar un documento incompleto y visible, no una
 *  excepción al renderizar la página del cliente. */
export function parseQuoteSnapshot(raw: string): QuoteSnapshot | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  const data = (value ?? {}) as Record<string, unknown>;
  if (!Array.isArray(data.items)) return null;
  const customer = (data.customer ?? {}) as Record<string, unknown>;
  const project = (data.project ?? {}) as Record<string, unknown>;
  const totals = (data.totals ?? {}) as Record<string, unknown>;

  return {
    version: 1,
    folio: str(data.folio, 40),
    issuedAt: str(data.issuedAt, 40),
    customer: {
      name: str(customer.name, 120),
      phone: str(customer.phone, 40),
      email: str(customer.email, 160),
      company: str(customer.company, 160),
      city: str(customer.city, 120),
      postalCode: str(customer.postalCode, 12),
      address: str(customer.address, 240),
    },
    project: { name: str(project.name, 160), notes: str(project.notes, 1000) },
    items: data.items.slice(0, 200).map((entry, index) => {
      const item = (entry ?? {}) as Record<string, unknown>;
      const extras = (item.extras ?? {}) as Record<string, unknown>;
      return {
        id: str(item.id, 60) || `item-${index}`,
        productName: str(item.productName, 80),
        styleName: str(item.styleName, 120),
        brandName: str(item.brandName, 80),
        panels: num(item.panels) || 1,
        wings: (Array.isArray(item.wings) ? item.wings.filter((wing) => typeof wing === "string") : ["fixed"]) as WingType[],
        widthMm: num(item.widthMm),
        heightMm: num(item.heightMm),
        quantity: num(item.quantity) || 1,
        colorName: str(item.colorName, 80),
        frameHex: str(item.frameHex, 20) || "#f3f3ef",
        glassName: str(item.glassName, 120),
        extras: { instalacion: extras.instalacion === true },
        unitPrice: num(item.unitPrice),
        lineTotal: num(item.lineTotal),
      };
    }),
    totals: {
      subtotal: num(totals.subtotal),
      total: num(totals.total),
      estimated: totals.estimated === true,
      depositPercentage: num(totals.depositPercentage),
      deposit: num(totals.deposit),
      remaining: num(totals.remaining),
    },
  };
}
