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
 * HALLAZGO DEL 2026-08-19, y es grande: la constante heredada de 120 mm NO se parece al dato del
 * fabricante. Seis tablas oficiales de "Deduction dimensions" en dos manuales de fabricación de
 * Aluplast (multi-slide y easy-slide) dan Vidrio = Hoja - 30 mm para sistemas de corredera. Ciento
 * veinte milímetros es cuatro veces eso: la aplicación venía pidiendo el vidrio unos 90 mm más
 * chico por eje de lo que especifica Aluplast.
 *
 * Por eso CORREDERA 60MM ya NO figura aquí como calibrado. Su 120 mm era el valor histórico de la
 * aplicación, no una medición; ahora hay motivo documentado para dudarlo, y afirmar que está
 * calibrado sería peor que admitir que no lo está. Vuelve al respaldo, con su aviso visible, hasta
 * confirmarlo contra la ficha CORREDERA_60N+MONORIEL (que es un plano CAD, no texto).
 *
 * CALIBRAR, por prioridad:
 *   1. CORREDERA 60MM y su Monorriel -- los más cotizados. La ficha mexicana existe pero es plano.
 *   2. IDEAL 2000 · Practicable -- el practicable más vendido. El manual español de 268 páginas que
 *      entregó dc es de procesamiento (drenaje, calzos, sellado) y no trae tabla de descuentos.
 *   3. ELEVADORA 70MM -- su manual dice, pág. 95, "descuentos de vidrio acordes a las normas del
 *      fabricante" sin dar la tabla.
 */
const CALIBRATED: Record<string, GlazingSpec> = {
  // multi-slide 96, calibrado el 2026-08-19 contra los manuales de fabricación de Aluplast que
  // entregó dc. Las tablas oficiales de "Deduction dimensions" dan, en cuatro esquemas distintos:
  //
  //   HB_Schiebefenster_multi-slide 2023-11, pág. 24   Hoja (B/2)-158     Vidrio (B/2)-188
  //   HB_Schiebefenster_multi-slide 2023-11, pág. 27   Hoja (B/4)-130.75  Vidrio (B/4)-160.75
  //   HB_Schiebefenster_multi-slide 2023-11, pág. 88   Hoja (B/2)-140     Vidrio (B/2)-170
  //   HB_Schiebefenster_multi-slide 2023-11, pág. 89   Hoja (B/4)-121.75  Vidrio (B/4)-151.75
  //
  // Vidrio menos hoja = 30 mm en los cuatro. El manual easy-slide 2023-09 (págs. 55, 56 y 57) da el
  // mismo 30 mm, y 33 mm en una variante de perfil (pág. 58), lo que confirma el orden de magnitud.
  //
  // El nombre del sistema en el catálogo se ata a este manual por la ficha mexicana
  // "MULTI SLIDE _96_MX_X.pdf", que es la del mismo producto.
  "CORREDERA 96MM": {
    marcoDeductionMm: 30,
    sashDeductionMm: 30,
    calibrated: true,
    source:
      "Aluplast HB_Schiebefenster_multi-slide_VM_Verarbeiter_en 2023-11, tablas 'Deduction " +
      "dimensions' págs. 24, 27, 88 y 89: Vidrio = Hoja - 30 mm en los cuatro esquemas. " +
      "Corroborado por easy-slide 2023-09 págs. 55-57. Falta separar marco de hoja: el manual da " +
      "un solo descuento para el acristalamiento en hoja.",
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

/**
 * DESCUENTO DE SOLDADURA
 *
 * Milímetros que se añaden a CADA EXTREMO soldado de una pieza a inglete. La máquina fresa el
 * extremo antes de soldar, así que la pieza se corta más larga que su medida terminada.
 *
 * Fuente: hoja "CALCULO DE MATERIAL SISTEMA IS v2.1" de Aluplast, celda F5 = 3 mm, aplicada como
 * `Medida con Soldadura = Medida Final + (F5 * 2)`. Confirmado por dc el 2026-08-19 como el valor
 * con el que fabrica el taller.
 *
 * Se aplica SOLO a las piezas a 45°, que son las que se sueldan: marco y hoja. En la misma hoja de
 * Aluplast, las piezas a 90° (el traslape vertical del fijo) y los junquillos usan la medida final
 * directa, sin descuento, porque no se sueldan. Ese es el criterio que sigue buildCutList.
 *
 * NO se suma al costeo del perfil. `profileCost` se calcula sobre metros netos con la merma de
 * DEFAULT_WASTE_PCT, que por definición ya absorbe el material que se consume de más; sumarlo en los
 * dos sitios sería contarlo dos veces. Aquí sirve para que la LISTA DE CORTE sea fabricable.
 */
export const WELD_ALLOWANCE_MM = 3;

/**
 * DESCUENTO DEL JUNQUILLO
 *
 * Cuánto mide menos el junquillo que la pieza de hoja o marco en la que se aloja, sumando los dos
 * lados del eje. El junquillo no se corta a la medida exterior de la hoja: se aloja dentro del galce.
 *
 * Dato del fabricante, para referencia de calibración: en la hoja de material del sistema Ideal IS,
 * el junquillo sale a `hoja - (47.3 - 2.8) * 2 = hoja - 89 mm`, y a 45°. Ese 47.3 es el ancho de
 * cara del perfil y el 2.8 el solape del galce, que es exactamente la estructura de esta constante.
 *
 * El sistema Ideal IS todavía NO está en data/catalog.ts, así que ese 89 no se puede atribuir a
 * ningún sistema del catálogo actual. Sin calibrar queda en 0 --el comportamiento anterior, que
 * corta el junquillo a la medida de la hoja-- y el reporte de corte lo advierte.
 */
export type BeadSpec = { deductionMm: number; calibrated: boolean; source: string };

const BEAD_UNCALIBRATED: BeadSpec = {
  deductionMm: 0,
  calibrated: false,
  source: "Sin calibrar: el junquillo sale a la medida de la hoja. Referencia Aluplast (sistema IS): hoja - 89 mm.",
};

const BEAD_CALIBRATED: Record<string, BeadSpec> = {};

export function beadFor(systemName: string): BeadSpec {
  return BEAD_CALIBRATED[systemName] ?? BEAD_UNCALIBRATED;
}
