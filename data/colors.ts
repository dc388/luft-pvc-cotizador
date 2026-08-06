import type { Brand, ColorItem } from "@/types/domain";

export type AluplastColorItem = ColorItem & { hex: string; note?: string | null };

// Real HEX + price factor extracted from the Aluplast EXWORK Veracruz price list
// (Catalogo_Perfiles_Aluplast_Base_Cotizacion.xlsx, rev. ABR_22 2022-05-01). factor is the
// average of price/base-white-price across every SKU sharing that color code. Entries whose
// commercial name wasn't present in the source (only a code) keep the code as their name.
export const aluplastColors: AluplastColorItem[] = [
  { code: "bl", name: "Blanco", hex: "#F3F3EF", factor: 1.0, note: null },
  { code: "jb", name: "JB / Negro", hex: "#171717", factor: 1.47, note: null },
  { code: "negro", name: "Negro", hex: "#111111", factor: 1.15, note: null },
  { code: "ag", name: "Gris antracita", hex: "#3E4347", factor: 1.48, note: null },
  { code: "mar", name: "Marrón", hex: "#6E4A32", factor: 1.2, note: null },
  { code: "br", name: "BR", hex: "#6B4939", factor: 1.4, note: "Código comercial sin nombre descriptivo en la lista de origen." },
  { code: "bd", name: "BD", hex: "#4A342A", factor: 1.39, note: "Código comercial sin nombre descriptivo en la lista de origen." },
  { code: "nb", name: "NB", hex: "#5B4638", factor: 1.39, note: "Código comercial sin nombre descriptivo en la lista de origen." },
  { code: "dc", name: "DC", hex: "#65493E", factor: 1.35, note: "Código comercial sin nombre descriptivo en la lista de origen." },
  { code: "go", name: "GO", hex: "#B07A3A", factor: 1.4, note: "Código comercial sin nombre descriptivo en la lista de origen." },
  { code: "sh", name: "SH", hex: "#B9AA8D", factor: 1.47, note: "Código comercial sin nombre descriptivo en la lista de origen." },
  { code: "sil", name: "Silver", hex: "#B9BEC3", factor: 1.47, note: null },
  { code: "soa", name: "SOA", hex: "#92704D", factor: 1.48, note: "Código comercial sin nombre descriptivo en la lista de origen." },
  { code: "soc", name: "SOC", hex: "#574338", factor: 1.48, note: "Código comercial sin nombre descriptivo en la lista de origen." },
  { code: "tom", name: "TOM", hex: "#8A6749", factor: 1.47, note: "Código comercial sin nombre descriptivo en la lista de origen." },
  { code: "ceylon", name: "Ceylon", hex: "#86715E", factor: 1.5, note: null },
  { code: "azul", name: "Azul", hex: "#315A8C", factor: 1.0, note: "Sin suficientes datos de variación de precio; se usa 1.0 como referencia." },
  { code: "rojo", name: "Rojo", hex: "#B33A32", factor: 1.0, note: "Sin suficientes datos de variación de precio; se usa 1.0 como referencia." },
];

export const colors: Record<Brand, ColorItem[]> = {
  Aluplast: aluplastColors,
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

// Real brand accent colors, extracted directly from each brand's own live site:
// aluplast.net logo SVG fill = rgb(209,10,17); deceuninck.com.mx logo/nav dominant
// color ~ rgb(0,96,176). Used to theme the UI per selected brand.
export const brandAccent: Record<Brand, string> = {
  Aluplast: "#D10A11",
  Deceuninck: "#0060B0",
};
