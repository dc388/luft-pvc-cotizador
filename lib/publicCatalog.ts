import { catalog } from "@/data/catalog";
import { colors } from "@/data/colors";
import { glassCatalog } from "@/data/glass";
import { typologyDefs } from "@/data/typologies";
import { createLeaf, walkLeaves } from "@/lib/tree";
import type { Brand, FrameNode, WingType } from "@/types/domain";

// Catálogo de cara al cliente para app/cotizar.
//
// IMPORTANTE: este módulo importa data/catalog.ts, data/colors.ts y data/glass.ts, que
// contienen tarifas reales (€/m, factores de color, precio/m² de vidrio). Por eso SOLO puede
// importarse desde código de servidor (route handlers y el server component de /cotizar).
// El navegador recibe únicamente el resultado de buildPublicCatalog(), que es nombre, muestra
// de color, beneficio y límites de medida -- ningún precio. Un componente cliente solo puede
// hacer `import type` de este archivo (los tipos se borran en compilación).

function splitCol(children: FrameNode[]): FrameNode {
  return { kind: "split", id: crypto.randomUUID(), axis: "col", ratios: Array(children.length).fill(1 / children.length), children };
}

function buildExistingTypology(id: string): FrameNode {
  const typology = typologyDefs.find((entry) => entry.id === id);
  if (!typology) throw new Error(`Tipología pública sin respaldo en data/typologies.ts: ${id}`);
  return typology.build();
}

// La categoría Puerta del catálogo interno identifica los perfiles abatibles reales. Resolver
// el índice desde esos datos evita convertir "puerta" en sinónimo codificado de corredera y
// mantiene data/catalog.ts como fuente de verdad si el orden del catálogo cambia.
const ALUPLAST_HINGED_DOOR_SYSTEM_INDEX = catalog.Aluplast.findIndex(
  (system) => system.category === "Puerta" && system.rails.every((rail) => rail === 0),
);
if (ALUPLAST_HINGED_DOOR_SYSTEM_INDEX < 0) {
  throw new Error("No se encontró el sistema Aluplast de puerta abatible en data/catalog.ts");
}

type StyleDef = {
  id: string;
  brand: Brand;
  productId: string;
  name: string;
  blurb: string;
  /** Índice dentro de catalog[brand]. */
  systemIndex: number;
  /** Rieles a cotizar; 0 para sistemas sin corredera. */
  rail: number;
  /** Cuántas hojas produce build(); el wizard lo usa para dibujar el preview. */
  panels: number;
  /** Medida inicial de presentación; el cliente puede modificarla antes de cotizar. */
  defaultW?: number;
  defaultH?: number;
  build: () => FrameNode;
};

// El allowlist de estilos ES la frontera de lo cotizable en público: findStyle() solo resuelve
// lo que esté aquí, así que ninguna combinación de sistema y apertura fuera de esta lista puede
// llegar al motor de cálculo, venga lo que venga en el payload.
const STYLE_DEFS: StyleDef[] = [
  // ---------- Aluplast (sistemas con precio real de lista, `sourced: true`) ----------
  {
    id: "alu-fija",
    brand: "Aluplast",
    productId: "ventana",
    name: "Fija",
    blurb: "No abre. Máxima entrada de luz al menor costo.",
    systemIndex: 3,
    rail: 0,
    panels: 1,
    build: () => createLeaf("fixed"),
  },
  {
    id: "alu-corrediza-2",
    brand: "Aluplast",
    productId: "ventana",
    name: "Corrediza de 2 hojas",
    blurb: "Las dos hojas se deslizan hacia el centro. La más común.",
    systemIndex: 0,
    rail: 2,
    panels: 2,
    build: () => splitCol([createLeaf("sliding", { direction: "Derecha" }), createLeaf("sliding", { direction: "Izquierda" })]),
  },
  {
    id: "alu-corrediza-fija-movil",
    brand: "Aluplast",
    productId: "ventana",
    name: "Corrediza fija + móvil",
    blurb: "Un panel fijo y uno que se desliza. Ideal para vanos anchos.",
    systemIndex: 0,
    rail: 2,
    panels: 2,
    build: () => splitCol([createLeaf("sliding-fixed"), createLeaf("sliding", { direction: "Izquierda" })]),
  },
  {
    id: "alu-corrediza-3",
    brand: "Aluplast",
    productId: "ventana",
    name: "Corrediza de 3 hojas",
    blurb: "Fija · móvil · fija. Para ventanales amplios.",
    systemIndex: 0,
    rail: 2,
    panels: 3,
    build: () => splitCol([createLeaf("sliding-fixed"), createLeaf("sliding"), createLeaf("sliding-fixed")]),
  },
  {
    id: "alu-abatible",
    brand: "Aluplast",
    productId: "ventana",
    name: "Abatible",
    blurb: "Abre hacia afuera como una puerta. Cierre muy hermético.",
    systemIndex: 3,
    rail: 0,
    panels: 1,
    build: () => createLeaf("casement-out"),
  },
  {
    id: "alu-oscilobatiente",
    brand: "Aluplast",
    productId: "ventana",
    name: "Oscilobatiente",
    blurb: "Abre de lado o se inclina desde arriba para ventilar sin abrir del todo.",
    systemIndex: 3,
    rail: 0,
    panels: 1,
    build: () => createLeaf("tilt-turn"),
  },
  {
    id: "alu-proyectante",
    brand: "Aluplast",
    productId: "ventana",
    name: "Proyectante",
    blurb: "Bascula desde arriba hacia afuera. Ventila incluso con lluvia.",
    systemIndex: 3,
    rail: 0,
    panels: 1,
    build: () => createLeaf("project"),
  },
  {
    id: "alu-puerta-abatible-1",
    brand: "Aluplast",
    productId: "puerta",
    name: "Puerta abatible de 1 hoja",
    blurb: "Apertura tradicional con bisagras y manija. Ideal para accesos principales o de servicio.",
    systemIndex: ALUPLAST_HINGED_DOOR_SYSTEM_INDEX,
    rail: 0,
    panels: 1,
    defaultW: 1000,
    defaultH: 2200,
    build: () => buildExistingTypology("puerta-1"),
  },
  {
    id: "alu-puerta-abatible-2",
    brand: "Aluplast",
    productId: "puerta",
    name: "Puerta abatible de 2 hojas",
    blurb: "Dos hojas con bisagras para conseguir una entrada más amplia.",
    systemIndex: ALUPLAST_HINGED_DOOR_SYSTEM_INDEX,
    rail: 0,
    panels: 2,
    defaultW: 1800,
    defaultH: 2200,
    build: () => buildExistingTypology("puerta-2"),
  },
  {
    id: "alu-puerta-corrediza-2",
    brand: "Aluplast",
    productId: "puerta",
    name: "Corrediza de 2 hojas",
    blurb: "Dos hojas que se deslizan hacia el centro.",
    systemIndex: 2,
    rail: 2,
    panels: 2,
    build: () => splitCol([createLeaf("sliding", { direction: "Derecha" }), createLeaf("sliding", { direction: "Izquierda" })]),
  },
  {
    id: "alu-puerta-corrediza-fija-movil",
    brand: "Aluplast",
    productId: "puerta",
    name: "Corrediza fija + móvil",
    blurb: "Un paño fijo de piso a techo y una hoja que corre.",
    systemIndex: 2,
    rail: 2,
    panels: 2,
    build: () => splitCol([createLeaf("sliding-fixed"), createLeaf("sliding", { direction: "Izquierda" })]),
  },
  {
    id: "alu-puerta-elevadora",
    brand: "Aluplast",
    productId: "puerta",
    name: "Elevadora (premium)",
    blurb: "Hojas grandes que se elevan al abrir: se deslizan sin esfuerzo y sellan al cerrar.",
    systemIndex: 4,
    rail: 2,
    panels: 2,
    build: () => splitCol([createLeaf("lift-slide", { direction: "Derecha" }), createLeaf("lift-slide", { direction: "Izquierda" })]),
  },

];

// Subconjunto comercial por marca: solo colores con nombre descriptivo real en data/colors.ts.
// Los códigos Aluplast sin nombre (BR/BD/NB/...) no se le muestran a un cliente final porque no
// significan nada para él.
const PUBLIC_COLOR_CODES: Partial<Record<Brand, string[]>> = {
  Aluplast: ["bl", "ag", "negro", "mar", "sil", "ceylon"],
};

// Vidrio explicado por beneficio, no por término técnico. `name` es el nombre exacto del
// catálogo real (data/glass.ts), que es como lib/calc.ts resuelve su precio.
const PUBLIC_GLASS_DEFS = [
  { name: "Cristal recocido claro 6 mm", label: "Sencillo", benefit: "La opción más económica. Cumple para interiores y vanos chicos." },
  { name: "Cristal templado claro 6 mm", label: "Seguridad", benefit: "Resiste golpes y, si se rompe, no deja filos. Recomendado en puertas y baños." },
  { name: "DVH 20 mm · 4/12/4", label: "Doble vidrio", benefit: "Dos cristales con cámara de aire: menos calor, menos ruido, menos recibo de luz." },
  { name: "DVH 24 mm · 6/12/6", label: "Doble vidrio reforzado", benefit: "El mejor aislamiento térmico y acústico de la línea." },
  { name: "Laminado 6+6 mm", label: "Laminado antirruido", benefit: "Máxima seguridad y el mejor bloqueo de ruido de la calle." },
];

const BRAND_BLURBS: Partial<Record<Brand, string>> = {
  Aluplast: "Perfil alemán. Es la línea con precio cerrado al momento.",
};

// Un sistema está "estimado" cuando sus tarifas no vienen de una lista de precios real del
// proveedor (`sourced` en data/catalog.ts). El soporte queda en el motor para cualquier futura
// línea pública sin tarifa, aunque el catálogo público actual solo ofrezca Aluplast.
export function isEstimatedSystem(brand: Brand, systemIndex: number): boolean {
  return catalog[brand][systemIndex]?.sourced !== true;
}

// ---------- Vista pública serializable (lo único que cruza al navegador) ----------

export type PublicProduct = { id: string; name: string; blurb: string };
export type PublicBrand = { id: Brand; name: string; blurb: string; estimated: boolean };
export type PublicStyle = {
  id: string;
  brandId: Brand;
  productId: string;
  name: string;
  blurb: string;
  panels: number;
  defaultW: number;
  defaultH: number;
  /** Aperturas reales de las hojas, usadas únicamente para la representación visual. */
  wings: WingType[];
  maxW: number;
  maxH: number;
  estimated: boolean;
};
export type PublicColor = { id: string; brandId: Brand; name: string; hex: string };
export type PublicGlass = { id: string; name: string; benefit: string };
export type PublicCatalog = {
  products: PublicProduct[];
  brands: PublicBrand[];
  styles: PublicStyle[];
  colors: PublicColor[];
  glass: PublicGlass[];
  minMm: number;
  maxQty: number;
};

export const MIN_DIMENSION_MM = 300;
export const MAX_QTY = 20;

export const publicProducts: PublicProduct[] = [
  { id: "ventana", name: "Ventana", blurb: "Para iluminar y ventilar una habitación." },
  { id: "puerta", name: "Puerta", blurb: "Acceso tradicional de una o dos hojas con apertura mediante bisagras." },
];

const PUBLIC_BRANDS: Brand[] = ["Aluplast"];

export function buildPublicCatalog(): PublicCatalog {
  const styles: PublicStyle[] = STYLE_DEFS.map((s) => {
    const sys = catalog[s.brand][s.systemIndex];
    return {
      id: s.id,
      brandId: s.brand,
      productId: s.productId,
      name: s.name,
      blurb: s.blurb,
      panels: s.panels,
      defaultW: s.defaultW ?? 1500,
      defaultH: s.defaultH ?? 1200,
      wings: walkLeaves(s.build()).map((leaf) => leaf.wing),
      maxW: sys.maxW,
      maxH: sys.maxH,
      estimated: isEstimatedSystem(s.brand, s.systemIndex),
    };
  });

  return {
    products: publicProducts,
    brands: PUBLIC_BRANDS.map((brand) => ({
      id: brand,
      name: brand,
      blurb: BRAND_BLURBS[brand] ?? "Línea disponible para cotización.",
      // La marca se etiqueta completa solo cuando todas sus opciones son estimadas. En una
      // línea mixta, cada estilo muestra su propio aviso para no marcar como aproximadas las
      // ventanas que sí tienen precio de lista.
      estimated: styles.filter((s) => s.brandId === brand).every((s) => s.estimated),
    })),
    styles,
    colors: PUBLIC_BRANDS.flatMap((brand) =>
      (PUBLIC_COLOR_CODES[brand] ?? []).map((code) => {
        const c = colors[brand].find((x) => x.code === code);
        if (!c) throw new Error(`Color público sin respaldo en data/colors.ts: ${brand} ${code}`);
        return { id: c.code, brandId: brand, name: c.name, hex: c.hex ?? "#cccccc" };
      })
    ),
    glass: PUBLIC_GLASS_DEFS.map((g) => {
      if (!glassCatalog.some((x) => x.name === g.name)) throw new Error(`Vidrio público sin respaldo en data/glass.ts: ${g.name}`);
      return { id: g.name, name: g.label, benefit: g.benefit };
    }),
    minMm: MIN_DIMENSION_MM,
    maxQty: MAX_QTY,
  };
}

// ---------- Resolución a los índices reales (solo servidor) ----------

export function findStyle(styleId: string): StyleDef | null {
  return STYLE_DEFS.find((s) => s.id === styleId) ?? null;
}

// El color se valida contra el subconjunto autorizado para el cotizador público. Las marcas del
// editor profesional que no aparezcan en PUBLIC_COLOR_CODES quedan rechazadas en esta frontera.
export function colorIndexFor(brand: Brand, colorId: string): number {
  if (!PUBLIC_COLOR_CODES[brand]?.includes(colorId)) return -1;
  return colors[brand].findIndex((c) => c.code === colorId);
}

export function glassIndexFor(glassId: string): number {
  if (!PUBLIC_GLASS_DEFS.some((g) => g.name === glassId)) return -1;
  return glassCatalog.findIndex((g) => g.name === glassId);
}
