import type { Brand, System } from "@/types/domain";

export const catalog: Record<Brand, System[]> = {
  Aluplast: [
    { name: "IDEAL 2000 MX · Corredera 2 rieles", category: "Corredera", depth: 60, chambers: "3 cámaras", glazing: 24, maxW: 4000, maxH: 2400, rails: [2], frame: 155, sash: 132, hardware: 980, uf: "1.6 W/m²K" },
    { name: "IDEAL 2000 MX · Corredera 3 rieles", category: "Corredera", depth: 60, chambers: "3 cámaras", glazing: 24, maxW: 4800, maxH: 2400, rails: [3], frame: 178, sash: 132, hardware: 1360, uf: "1.6 W/m²K" },
    { name: "IDEAL 2000 MX · Monorriel", category: "Corredera", depth: 60, chambers: "3 cámaras", glazing: 24, maxW: 4000, maxH: 2400, rails: [1], frame: 168, sash: 137, hardware: 1080, uf: "1.6 W/m²K" },
    { name: "IDEAL 2000 Classic-line · Fijo", category: "Fijo", depth: 60, chambers: "3 cámaras", glazing: 33, maxW: 3000, maxH: 2600, rails: [0], frame: 172, sash: 0, hardware: 180, uf: "1.6 W/m²K" },
    { name: "IDEAL 2000 Classic-line · Practicable", category: "Practicable", depth: 60, chambers: "3 cámaras", glazing: 33, maxW: 2800, maxH: 2400, rails: [0], frame: 188, sash: 172, hardware: 1850, uf: "1.6 W/m²K" },
    { name: "IDEAL 2000 Round-line · Practicable", category: "Practicable", depth: 60, chambers: "3 cámaras", glazing: 33, maxW: 2800, maxH: 2400, rails: [0], frame: 196, sash: 180, hardware: 1850, uf: "1.6 W/m²K" },
    { name: "IDEAL 2000 · Puerta interior/exterior", category: "Puerta", depth: 60, chambers: "3 cámaras", glazing: 33, maxW: 2400, maxH: 2600, rails: [0], frame: 205, sash: 198, hardware: 2480, uf: "1.6 W/m²K" },
    { name: "IDEAL 2000 · Osciloparalela", category: "Especial", depth: 60, chambers: "3 cámaras", glazing: 33, maxW: 3600, maxH: 2400, rails: [1], frame: 218, sash: 192, hardware: 3900, uf: "1.6 W/m²K" },
    { name: "IDEAL 4000 70", category: "Practicable", depth: 70, chambers: "5 cámaras", glazing: 41, maxW: 3000, maxH: 2600, rails: [0], frame: 208, sash: 191, hardware: 2150, uf: "1.3 W/m²K" },
    { name: "smart-slide 70", category: "Especial", depth: 70, chambers: "cierre perimetral", glazing: 41, maxW: 5800, maxH: 2400, rails: [1, 2], frame: 245, sash: 218, hardware: 4200, uf: "1.3 W/m²K" },
    { name: "Lift-slide 85", category: "Especial", depth: 85, chambers: "umbral especial", glazing: 52, maxW: 6500, maxH: 2800, rails: [2], frame: 320, sash: 285, hardware: 7600, uf: "1.1 W/m²K" },
  ],
  Deceuninck: [
    { name: "Sliding 2 rieles", category: "Corredera", depth: 60, chambers: "multicámara", glazing: 24, maxW: 4000, maxH: 2400, rails: [2], frame: 148, sash: 126, hardware: 930, uf: "según configuración" },
    { name: "Sliding Monorriel", category: "Corredera", depth: 60, chambers: "multicámara", glazing: 24, maxW: 4000, maxH: 2400, rails: [1], frame: 164, sash: 132, hardware: 1040, uf: "según configuración" },
    { name: "Bella Sliding", category: "Corredera", depth: 80, chambers: "multicámara", glazing: 24, maxW: 5200, maxH: 2600, rails: [2, 3], frame: 176, sash: 151, hardware: 1180, uf: "según configuración" },
    { name: "Bella Sliding Monorriel", category: "Corredera", depth: 80, chambers: "multicámara", glazing: 24, maxW: 5200, maxH: 2600, rails: [1], frame: 185, sash: 158, hardware: 1290, uf: "según configuración" },
    { name: "Everest Max 60", category: "Practicable", depth: 60, chambers: "4 cámaras · doble junta", glazing: 36, maxW: 3000, maxH: 2600, rails: [0], frame: 182, sash: 168, hardware: 1780, uf: "según vidrio" },
    { name: "Lotus Sliding", category: "Corredera", depth: 76, chambers: "multicámara", glazing: 24, maxW: 4800, maxH: 2500, rails: [1, 2], frame: 194, sash: 164, hardware: 1380, uf: "según configuración" },
    { name: "Legend / Legend Slide", category: "Premium", depth: 80, chambers: "multicámara", glazing: 44, maxW: 5200, maxH: 2700, rails: [0, 1, 2], frame: 238, sash: 207, hardware: 2450, uf: "alto desempeño" },
    { name: "HS-76 Elevadora", category: "Especial", depth: 175, chambers: "elevadora", glazing: 52, maxW: 6500, maxH: 2800, rails: [2], frame: 310, sash: 278, hardware: 7200, uf: "según configuración" },
  ],
};
