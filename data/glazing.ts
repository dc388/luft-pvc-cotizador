/**
 * DESCUENTO DE VIDRIO POR SISTEMA Y POR ROL DEL PERFIL
 *
 * De aquí sale la medida con la que se compra el vidrio. Es el único lugar donde vive ese dato.
 *
 * ---------------------------------------------------------------------------------------------
 * QUÉ ES EL DESCUENTO DE VIDRIO
 * ---------------------------------------------------------------------------------------------
 * Es cuánto mide menos el vidrio que el elemento que lo sujeta, sumando los dos lados del eje:
 *
 *     vidrio (ancho) = medida de fabricación de la hoja (ancho) − descuento
 *     vidrio (alto)  = medida de fabricación de la hoja (alto)  − descuento
 *
 * El descuento agrupa tres cosas que el perfil impone: el ancho de cara del perfil (la parte que
 * tapa el vano), menos el galce que pisa el canto del vidrio por debajo del junquillo, más la
 * holgura de montaje. Los fabricantes de perfil publican el resultado ya sumado en su ficha de
 * fabricación —Aluplast lo llama descuento de vidrio— y así es como lo usa el taller, de modo que
 * se guarda como un solo número en vez de desglosarlo en tres que habría que adivinar.
 *
 * ---------------------------------------------------------------------------------------------
 * POR QUÉ HAY DOS NÚMEROS POR SISTEMA
 * ---------------------------------------------------------------------------------------------
 * Depende de CONTRA QUÉ acristala la hoja, que es cosa de su tipo de apertura:
 *
 *   - Hoja fija o inactiva  -> el vidrio se monta directo en el MARCO. Manda `marcoDeductionMm`.
 *   - Hoja operable         -> el vidrio se monta en la HOJA.         Manda `sashDeductionMm`.
 *
 * Son perfiles distintos, con caras distintas, así que el descuento es distinto. Aplicar el mismo
 * a los dos casos —que es lo que hacía la constante de 120 mm que esto reemplaza— da vidrio de
 * medida equivocada en cuanto el diseño mezcla hojas fijas y operables, que es casi siempre.
 *
 * ---------------------------------------------------------------------------------------------
 * CÓMO CALIBRAR UN SISTEMA (10 minutos con un vernier, por sistema)
 * ---------------------------------------------------------------------------------------------
 * Sobre una ventana ya fabricada de ese sistema:
 *   1. Mide el ancho exterior de la hoja (o del marco, si la hoja es fija).
 *   2. Mide el ancho del vidrio que lleva puesto.
 *   3. El descuento es la resta. Repite en el alto para confirmar que coincide.
 * O tómalo directo de la ficha de fabricación de Aluplast para ese sistema, que es la fuente
 * preferente: pon la revisión de la ficha en `source`.
 *
 * En cuanto un sistema queda calibrado, TODO lo demás se corrige solo: el pedido de vidrio, la
 * superficie que se costea y el reporte de producción salen de aquí.
 *
 * ---------------------------------------------------------------------------------------------
 * LO QUE NO SE HACE AQUÍ
 * ---------------------------------------------------------------------------------------------
 * No se inventa un número por sistema para que la tabla se vea completa. Un sistema sin ficha ni
 * medición queda con `calibrated: false`, hereda el valor heredado de 120 mm para no mover ni un
 * peso de las cotizaciones ya emitidas, y **el pedido de vidrio lo dice en la cara**. Un dato
 * provisional señalado es un problema de calibración; el mismo dato en silencio es merma.
 */

export type GlazingSpec = {
  /** Descuento total (los dos lados del eje) cuando el vidrio se monta en el marco. */
  marcoDeductionMm: number;
  /** Descuento total (los dos lados del eje) cuando el vidrio se monta en la hoja. */
  sashDeductionMm: number;
  /** `false` mientras el sistema no tenga ficha de fabricación ni medición en taller. */
  calibrated: boolean;
  /** De dónde salió el número. Obligatorio cuando `calibrated` es `true`. */
  source: string;
};

/**
 * Valor heredado de la constante única de 120 mm que existía repartida en tres archivos
 * (lib/calc.ts, VidrioDoc.tsx y ProjectVidrioDoc.tsx). Se conserva SOLO como respaldo de los
 * sistemas sin calibrar, para que este cambio no altere ninguna cotización ya emitida.
 */
export const LEGACY_GLASS_DEDUCTION_MM = 120;

const UNCALIBRATED: GlazingSpec = {
  marcoDeductionMm: LEGACY_GLASS_DEDUCTION_MM,
  sashDeductionMm: LEGACY_GLASS_DEDUCTION_MM,
  calibrated: false,
  source: "Sin calibrar: hereda la constante de 120 mm. Requiere ficha de fabricación o medición.",
};

/**
 * Sistemas calibrados, por nombre exacto de sistema (el de data/catalog.ts, que no repite nombres
 * entre marcas). Se indexa por nombre y no por marca+nombre para no tener que pasar la marca por
 * toda la cadena de cálculo, que hoy solo recibe el sistema.
 *
 * CORREDERA 60MM es el único con valor propio hoy, y no es una medición nueva: es la constante que
 * la aplicación ya venía aplicando, atribuida al sistema del que se portó. Se registra así para que
 * el número no cambie mientras se calibra el resto, y para que quede explícito de dónde viene.
 *
 * CALIBRAR: los 19 sistemas restantes. El de mayor prioridad es IDEAL 2000 · Practicable, porque
 * es el practicable más cotizado y su hoja (77 mm en el catálogo Aluplast del repositorio) es
 * visiblemente más ancha que la de una corredera de 60 mm, así que su descuento no puede ser 120.
 */
const CALIBRATED: Record<string, GlazingSpec> = {
  "CORREDERA 60MM": {
    marcoDeductionMm: 120,
    sashDeductionMm: 120,
    calibrated: true,
    source:
      "Valor histórico de la aplicación (constante de 120 mm), atribuido a este sistema por ser " +
      "el que se portó de static/cotizador.html. Confirmar contra la ficha de fabricación " +
      "Aluplast y separar marco de hoja cuando esté a la mano.",
  },
};

/** El descuento que aplica a un sistema. Nunca devuelve `undefined`: sin calibrar, respaldo. */
export function glazingFor(systemName: string): GlazingSpec {
  return CALIBRATED[systemName] ?? UNCALIBRATED;
}

/**
 * La medida con la que se compra el vidrio de una hoja.
 *
 * `glazesIntoFrame` es lo que decide cuál de los dos descuentos aplica, y sale del tipo de apertura:
 * una hoja fija o inactiva no tiene perfil de hoja, así que su vidrio se monta en el marco.
 */
export function glassSizeMm(
  fabWMm: number,
  fabHMm: number,
  systemName: string,
  glazesIntoFrame: boolean
): { wMm: number; hMm: number; calibrated: boolean } {
  const spec = glazingFor(systemName);
  const deduction = glazesIntoFrame ? spec.marcoDeductionMm : spec.sashDeductionMm;
  return {
    wMm: Math.max(0, fabWMm - deduction),
    hMm: Math.max(0, fabHMm - deduction),
    calibrated: spec.calibrated,
  };
}
