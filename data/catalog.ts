import type { Brand, System } from "@/types/domain";

// Tipo de cambio EUR->MXN con el que se convierten a pesos las listas EXWORK Veracruz de Aluplast
// (tanto la rev. ABR_22 como la de IS V1.2.2.2, que también viene en euros).
//
// DECISION DE NEGOCIO, NO UN DATO DE MERCADO. dc lo fijó el 2026-08-19: «mantén los 21 porque es el
// precio que maneja la marca para evitar pérdidas». El tipo de cambio de mercado en esa fecha rondaba
// 19.68, así que este 21.8 cotiza el perfil ~10.8% por encima de una conversión a tipo spot. Eso es
// deliberado: es un colchón contra la variación del peso entre la cotización y la compra real.
//
// NO SE ACTUALIZA a tipo spot sin decidirlo expresamente, y hay una razón concreta para tener
// cuidado: `IMPORT_FACTOR` (abajo) vale 1.0, es decir que el precio EXWORK se está cobrando como si
// fuera costo puesto en planta, sin flete ni aduana. Ese subcosteo empuja en sentido CONTRARIO al
// colchón de este tipo de cambio. Es decir que el 21.8 puede estar haciendo doble función: colchón
// de divisa Y factor de importación implícito.
//
// La consecuencia práctica: bajar este número a 19.68 dejando IMPORT_FACTOR en 1.0 quitaría el
// colchón sin poner nada en su lugar, y cada ventana con perfil `sourced` se vendería por debajo de
// su costo real de importación. Si algún día se calibra IMPORT_FACTOR con un pedimento real, hay que
// revisar los dos números A LA VEZ, no uno solo.
//
// tests/glazing.test.ts fija este valor a propósito: cambiarlo rompe una prueba, para que no se
// pueda mover por descuido.
export const EUR_MXN = 21.8;

// Landed-cost multiplier applied on top of the EXWORK Veracruz profile prices. The source
// list is EXWORK: it stops at the seller's dock and excludes ocean/inland freight, customs
// duty, broker fees, and handling into the plant. Charging EXWORK as if it were the landed
// cost is a direct margin leak on every window.
//
// CALIBRAR: set this from a real recent import — (total landed cost) / (EXWORK invoice).
// 1.0 reproduces the previous behaviour exactly (EXWORK charged as landed).
//
// Confirmado el 2026-08-19: la lista nueva del sistema IS vuelve a decir «PRECIOS EX WORK
// ALUPLASTMEX-VERACRUZ», así que el subcosteo es real y sigue vigente. Léase junto al comentario de
// EUR_MXN: hoy el colchón del tipo de cambio está compensando, en parte y sin medirlo, lo que este
// factor debería recoger. No se toca ninguno de los dos por separado.
export const IMPORT_FACTOR = 1.0;

// The 5 systems marked sourced:true use real base (white) EUR/m frame+sash prices from the
// extracted "Familias_Precio" sheet (280 normalized families, 1279 SKUs), converted to MXN
// at EUR_MXN — see data/families.ts for the full underlying catalog. The rest are estimates
// kept for broader system coverage, not backed by the price list.
// frameSeatMm / centerOverlapMm: fabrication geometry for sliding (corredera) leaves, see
// System's doc-comments in types/domain.ts. frameSeatMm=8 across the board is dc's field
// number (2026-08-07), applied uniformly pending per-system confirmation. centerOverlapMm
// is a PLACEHOLDER estimate (not from a verified Aluplast/Deceuninck ficha técnica yet) --
// scaled loosely with profile depth as a stand-in until real datasheets replace it. 0 for
// non-corredera categories, where leaves never meet a sliding sibling.
export const catalog: Record<Brand, System[]> = {
  Aluplast: [
    { name: "CORREDERA 60MM", category: "Corredera", depth: 60, chambers: "3 cámaras", glazing: 24, maxW: 4000, maxH: 2400, rails: [2, 3], frame: 74, sash: 75, hardware: 950, uf: "1.6 W/m²K", sourced: true, frameSeatMm: 8, centerOverlapMm: 20 },
    { name: "CORREDERA 60MM · Monorriel", category: "Corredera", depth: 60, chambers: "3 cámaras", glazing: 24, maxW: 3600, maxH: 2400, rails: [1], frame: 92, sash: 68, hardware: 850, uf: "1.6 W/m²K", sourced: true, frameSeatMm: 8, centerOverlapMm: 20 },
    { name: "CORREDERA 96MM", category: "Corredera", depth: 96, chambers: "multicámara", glazing: 28, maxW: 5200, maxH: 2600, rails: [1, 2], frame: 97, sash: 105, hardware: 1300, uf: "1.5 W/m²K", sourced: true, frameSeatMm: 8, centerOverlapMm: 26 },
    { name: "IDEAL 2000 · Practicable", category: "Practicable", depth: 60, chambers: "3 cámaras", glazing: 33, maxW: 2800, maxH: 2400, rails: [0], frame: 84, sash: 128, hardware: 1700, uf: "1.6 W/m²K", sourced: true, frameSeatMm: 8, centerOverlapMm: 0 },
    { name: "ELEVADORA 70MM · Corredera elevable", category: "Especial", depth: 70, chambers: "5 cámaras", glazing: 40, maxW: 5500, maxH: 2700, rails: [2], frame: 211, sash: 206, hardware: 6800, uf: "1.3 W/m²K", sourced: true, frameSeatMm: 8, centerOverlapMm: 30 },
    { name: "IDEAL 2000 Classic-line · Fijo", category: "Fijo", depth: 60, chambers: "3 cámaras", glazing: 33, maxW: 3000, maxH: 2600, rails: [0], frame: 172, sash: 0, hardware: 180, uf: "1.6 W/m²K", frameSeatMm: 8, centerOverlapMm: 0 },
    { name: "IDEAL 2000 · Puerta interior/exterior", category: "Puerta", depth: 60, chambers: "3 cámaras", glazing: 33, maxW: 2400, maxH: 2600, rails: [0], frame: 205, sash: 198, hardware: 2480, uf: "1.6 W/m²K", frameSeatMm: 8, centerOverlapMm: 0 },
    { name: "IDEAL 4000 70", category: "Practicable", depth: 70, chambers: "5 cámaras", glazing: 41, maxW: 3000, maxH: 2600, rails: [0], frame: 208, sash: 191, hardware: 2150, uf: "1.3 W/m²K", frameSeatMm: 8, centerOverlapMm: 0 },
    { name: "IDEAL 7000 85", category: "Practicable", depth: 85, chambers: "6 cámaras", glazing: 44, maxW: 3200, maxH: 2700, rails: [0], frame: 236, sash: 205, hardware: 2400, uf: "1.2 W/m²K", frameSeatMm: 8, centerOverlapMm: 0 },
    { name: "IDEAL 8000 85", category: "Premium", depth: 85, chambers: "6 cámaras · triple junta", glazing: 44, maxW: 3200, maxH: 2700, rails: [0], frame: 258, sash: 224, hardware: 2650, uf: "1.0 W/m²K", frameSeatMm: 8, centerOverlapMm: 0 },
    { name: "neo smart-slide", category: "Especial", depth: 70, chambers: "cierre perimetral", glazing: 41, maxW: 6000, maxH: 2500, rails: [1, 2], frame: 245, sash: 218, hardware: 4200, uf: "1.3 W/m²K", frameSeatMm: 8, centerOverlapMm: 24 },
    { name: "Lift-slide 85 (HS)", category: "Especial", depth: 85, chambers: "umbral especial", glazing: 52, maxW: 6500, maxH: 2800, rails: [2], frame: 320, sash: 285, hardware: 7600, uf: "1.1 W/m²K", frameSeatMm: 8, centerOverlapMm: 32 },
    // IDEAL IS · Corredera mx -- el sistema que aluplastmex suministra hoy, y el unico del catalogo
    // con ficha de fabricacion propia y lista de precios vigente. Anadido el 2026-08-19 desde la
    // documentacion que entrego dc; calibrado el 2026-08-20 con los planos de liberacion.
    //
    // Precios de "Lista de Precios IS_V1.2.2.2.xlsx" (EXWORK Veracruz, en euros), convertidos con
    // EUR_MXN igual que el resto de los sistemas `sourced`:
    //   Marco de 58 mm 2 rieles IS        1.71 EUR/m  ->  37 MXN/m
    //   Hoja corrediza c/felpillo 19 mm   1.20 EUR/m  ->  26 MXN/m   (el traslape es 1.19, casi igual)
    //
    // HERRAJE: 39 MXN por ventana = cerradero media luna 0.90 EUR + carro p/hoja 0.90 EUR. El plano
    // 020072-01 confirma que son las dos unicas piezas de herraje del sistema (620075 "locking part"
    // y 620076 "roller", que ap-Mexico compra directo a proveedor chino y por eso no figuran en la
    // lista de Aluplast con su codigo aleman). El mismo plano anota que el rodamiento 620076 sirve
    // ademas de separador para la hoja fija, asi que no hay una tercera pieza.
    // Nota: sobre este 39 el motor sigue sumando las estimaciones planas y sin calibrar de
    // `hardwareLeafCount * 110` y `rail * 165` (ver D-12), que no son especificas de este sistema.
    //
    // frameSeatMm y centerOverlapMm van en 0 A PROPOSITO: este sistema NO usa el modelo generico de
    // hoja. Su descuento esta documentado en la ficha y vive en data/glazing.ts (leafSizingFor), que
    // manda sobre esos dos campos. Se dejan en 0 para que quede claro que no se leen.
    //
    // ------------------------------------------------------------------------------------------
    // ESPESOR DE VIDRIO: 6 mm, y es un limite REAL, no un placeholder
    // ------------------------------------------------------------------------------------------
    // El plano de liberacion 020072-01 (sliding-window mx) dice "glazing bead for 3mm glass", y el
    // de la puerta 020074-01, que usa el MISMO junquillo 020073, dice "glazing bead for 6mm glass".
    // Los dos anaden "laminated is not planned".
    //
    // Se pone 6: es el maximo que respalda cualquier documento del sistema. Con esto la aplicacion
    // marca correctamente todo lo que no cabe -- templado de 9.5, laminado, y los dos DVH.
    //
    // Antes estaba en 24 (el maximo del catalogo de vidrio) porque la ficha de usuario no publica el
    // dato. Era un error grave: permitia cotizar DVH de 24 mm en un sistema que acepta 6, y el
    // vidrio a medida no se devuelve.
    //
    // OJO: el vidrio mas delgado del catalogo de la aplicacion es de 6 mm. Si el taller acristala
    // este sistema con 3 mm, hay que agregar esa partida a data/glass.ts.
    //
    // ------------------------------------------------------------------------------------------
    // SIN PRESTACIONES CERTIFICADAS -- leer antes de especificarlo en un proyecto
    // ------------------------------------------------------------------------------------------
    // El plano 020072-01 lo dice literalmente: "no requirement for compatibility, U-value, water
    // resistance, wind load, burglary resistance and certification". Es decir que Aluplast libero
    // este sistema SIN requisitos de valor U, estanqueidad al agua, resistencia al viento, ni
    // certificacion. Es una linea economica pensada para competir con aluminio sin RPT.
    //
    // Consecuencia: NO se puede especificar donde se exija clasificacion NMX-R-060 ni prestacion
    // termica o acustica declarada. `uf` lo dice en lugar de mostrar un valor que no existe.
    //
    // CONFLICTO DE MEDIDAS MAXIMAS, pendiente de confirmar con Aluplast: el plano de liberacion
    // 020072-01 rev 03 dice "max. sizes 1200 x 1200 mm", y el manual de usuario ed. 2025-10 dice
    // 1500 mm. Se conserva 1500 por ser el documento mas reciente y de cara al fabricante --y porque
    // en la puerta los dos documentos SI coinciden en 2000-- pero conviene verificarlo.
    { name: "IDEAL IS · Corredera mx", category: "Corredera", depth: 58, chambers: "linea economica, sin camaras publicadas", glazing: 6, maxW: 1500, maxH: 1500, rails: [2], frame: 37, sash: 26, hardware: 39, uf: "sin requisito de valor U (liberado sin certificacion)", sourced: true, frameSeatMm: 0, centerOverlapMm: 0 },
  ],
  Deceuninck: [
    { name: "Sliding 2 rieles", category: "Corredera", depth: 60, chambers: "multicámara", glazing: 24, maxW: 4000, maxH: 2400, rails: [2], frame: 148, sash: 126, hardware: 930, uf: "según configuración", frameSeatMm: 8, centerOverlapMm: 20 },
    { name: "Sliding Monorriel", category: "Corredera", depth: 60, chambers: "multicámara", glazing: 24, maxW: 4000, maxH: 2400, rails: [1], frame: 164, sash: 132, hardware: 1040, uf: "según configuración", frameSeatMm: 8, centerOverlapMm: 20 },
    { name: "Bella Sliding", category: "Corredera", depth: 80, chambers: "multicámara", glazing: 24, maxW: 5200, maxH: 2600, rails: [2, 3], frame: 176, sash: 151, hardware: 1180, uf: "según configuración", frameSeatMm: 8, centerOverlapMm: 24 },
    { name: "Bella Sliding Monorriel", category: "Corredera", depth: 80, chambers: "multicámara", glazing: 24, maxW: 5200, maxH: 2600, rails: [1], frame: 185, sash: 158, hardware: 1290, uf: "según configuración", frameSeatMm: 8, centerOverlapMm: 24 },
    { name: "Everest Max 60", category: "Practicable", depth: 60, chambers: "4 cámaras · doble junta", glazing: 36, maxW: 3000, maxH: 2600, rails: [0], frame: 182, sash: 168, hardware: 1780, uf: "según vidrio", frameSeatMm: 8, centerOverlapMm: 0 },
    { name: "Lotus Sliding", category: "Corredera", depth: 76, chambers: "multicámara", glazing: 24, maxW: 4800, maxH: 2500, rails: [1, 2], frame: 194, sash: 164, hardware: 1380, uf: "según configuración", frameSeatMm: 8, centerOverlapMm: 22 },
    { name: "Legend / Legend Slide", category: "Premium", depth: 80, chambers: "multicámara", glazing: 44, maxW: 5200, maxH: 2700, rails: [0, 1, 2], frame: 238, sash: 207, hardware: 2450, uf: "alto desempeño", frameSeatMm: 8, centerOverlapMm: 26 },
    { name: "HS-76 Elevadora", category: "Especial", depth: 175, chambers: "elevadora", glazing: 52, maxW: 6500, maxH: 2800, rails: [2], frame: 310, sash: 278, hardware: 7200, uf: "según configuración", frameSeatMm: 8, centerOverlapMm: 32 },
  ],
};
