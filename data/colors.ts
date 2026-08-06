import type { Brand, ColorItem } from "@/types/domain";

export const colors: Record<Brand, ColorItem[]> = {
  Aluplast: [
    { name: "Blanco", code: "BL", factor: 1 },
    { name: "Negro JB", code: "JB", factor: 1.18 },
    { name: "Antracita", code: "ANT", factor: 1.22 },
    { name: "Nogal", code: "NOG", factor: 1.24 },
    { name: "Roble dorado", code: "RD", factor: 1.24 },
  ],
  Deceuninck: [
    { name: "Blanco", code: "M3", factor: 1 },
    { name: "Roble Dorado", code: "190", factor: 1.21 },
    { name: "Nogal", code: "191", factor: 1.22 },
    { name: "Macoré", code: "149", factor: 1.22 },
    { name: "Mountain Oak", code: "196", factor: 1.23 },
    { name: "Winchester", code: "194", factor: 1.23 },
    { name: "Antracita Veteado", code: "523", factor: 1.22 },
    { name: "Antracita", code: "408", factor: 1.22 },
    { name: "Black Ulti Matt", code: "192", factor: 1.25 },
    { name: "Gris Aluminio", code: "911", factor: 1.22 },
    { name: "Truffle Oak", code: "422", factor: 1.24 },
    { name: "Nogal Ulti Matt", code: "456", factor: 1.25 },
  ],
};
