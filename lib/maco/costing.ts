// Costeo de herrajes con precios verificados de proveedor.
//
// Este módulo existe para NO usarse todavía, y eso es deliberado.
//
// La lista de precios MACO trae artículos y precios; NO trae una lista de materiales por ventana.
// Saber que una manilla cuesta 11.38 EUR no dice cuántas manillas lleva una corredera de 60mm de
// dos hojas, ni si lleva esa manilla o otra. Deducirlo de las palabras de la descripción sería
// inventar la lista de materiales, y el resultado sería una cotización falsa con apariencia de
// exacta -- peor que la estimación actual, que al menos se sabe estimación.
//
// Por eso `resolveHardwareCost` devuelve `null` mientras no se cumplan TODAS las condiciones de
// abajo, y `calcQuote` conserva intacto su cálculo actual (sys.hardware + tarifa por hoja +
// tarifa de riel) cada vez que recibe `null`. Hoy devuelve `null` siempre en producción, porque
// supplier_hardware_mappings está vacía: no hay manual MACO que pruebe ninguna relación.
//
// La revisión ABR_22 tampoco se activa por ser la única disponible. `revision` tiene que venir
// elegida explícitamente y la fuente tiene que estar marcada como vigente por una persona.

import { multiplyExact } from "./decimal";

/** Un renglón de la lista de materiales, ya cruzado con su precio de la revisión elegida. */
export type VerifiedHardwareLine = {
  sku: string;
  description: string;
  /** Piezas que lleva la configuración. Tiene que venir de un documento, no de una suposición. */
  qty: number;
  /** Precio unitario como entero exacto. Ver lib/maco/decimal.ts. */
  unitPriceMinor: number;
  priceScale: number;
  /** Moneda del precio. Tiene que coincidir con la del tipo de cambio: hoy, EUR. */
  currency: string;
  /** Documento que prueba la relación configuración -> SKU. Vacío invalida el renglón. */
  sourceRef: string;
  /** Página o ubicación exacta dentro de ese documento. Vacío invalida el renglón. */
  sourceLocation: string;
  /** Solo "verified" puede costear. */
  verification: "verified" | "tentativo";
};

export type VerifiedHardwareCosting = {
  /** Revisión de precios elegida explícitamente. Vacío invalida el costeo. */
  revision: string;
  /** Tipo de cambio EUR->MXN explícito para esta cotización. Sin él no hay costeo. */
  eurMxn: number;
  /** Interruptor explícito: "esta cotización usa costos verificados". Nunca por omisión. */
  useVerifiedCosts: boolean;
  lines: VerifiedHardwareLine[];
};

export type HardwareCostBreakdown = {
  /** Importe total de herrajes en MXN. */
  totalMxn: number;
  lines: { sku: string; description: string; qty: number; totalMxn: number }[];
  revision: string;
  eurMxn: number;
};

/** Moneda de la lista MACO. El tipo de cambio que se exige es justamente EUR->MXN. */
const EXPECTED_CURRENCY = "EUR";

/**
 * Devuelve el costo verificado de herrajes, o `null` si falta cualquiera de los requisitos.
 *
 * Las seis condiciones, todas obligatorias:
 *   1. un mapeo explícito de la configuración a SKU (`lines` no vacía),
 *   2. cantidades verificadas (`qty` > 0 y `verification === "verified"`),
 *   3. fuente documental por renglón (`sourceRef` y `sourceLocation`),
 *   4. una revisión de precios elegida (`revision`),
 *   5. un tipo de cambio EUR/MXN explícito (`eurMxn` > 0),
 *   6. la indicación explícita de usar costos verificados (`useVerifiedCosts`).
 *
 * `null` NO es un error: es la respuesta correcta cuando no hay evidencia suficiente, y el motor
 * de cotización sigue con su estimación.
 */
export function resolveHardwareCost(input: VerifiedHardwareCosting | undefined): HardwareCostBreakdown | null {
  if (!input) return null;
  // 6. Indicación explícita.
  if (!input.useVerifiedCosts) return null;
  // 4. Revisión elegida.
  if (input.revision.trim() === "") return null;
  // 5. Tipo de cambio explícito.
  if (!Number.isFinite(input.eurMxn) || input.eurMxn <= 0) return null;
  // 1. Mapeo explícito.
  if (input.lines.length === 0) return null;

  const lines: HardwareCostBreakdown["lines"] = [];
  let totalMxn = 0;

  for (const line of input.lines) {
    // 2. Cantidad verificada.
    if (line.verification !== "verified") return null;
    if (!Number.isFinite(line.qty) || line.qty <= 0) return null;
    // 3. Fuente documental.
    if (line.sourceRef.trim() === "" || line.sourceLocation.trim() === "") return null;
    // Un precio en otra moneda con un tipo de cambio EUR/MXN daría un número sin significado.
    if (line.currency !== EXPECTED_CURRENCY) return null;
    if (!Number.isSafeInteger(line.unitPriceMinor) || line.unitPriceMinor < 0) return null;

    const lineTotal = multiplyExact(line.unitPriceMinor, line.priceScale, line.qty, input.eurMxn);
    lines.push({ sku: line.sku, description: line.description, qty: line.qty, totalMxn: lineTotal });
    totalMxn += lineTotal;
  }

  return { totalMxn, lines, revision: input.revision, eurMxn: input.eurMxn };
}
