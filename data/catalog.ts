import type { Brand, System } from "@/types/domain";

// Reference EUR->MXN rate used only to convert the Aluplast EXWORK Veracruz price list
// (rev. ABR_22, 01/05/2022) into MXN for the `sourced: true` systems below. Update if
// quoting against a materially different exchange rate.
export const EUR_MXN = 21.8;

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
