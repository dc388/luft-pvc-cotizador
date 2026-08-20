import type { Brand, ColorItem } from "@/types/domain";

export type AluplastColorItem = ColorItem & {
  hex: string;
  note?: string | null;
  /** Referencia del folio en el sistema Renolit, tal como la publica aluplastmex. */
  renolit?: string;
  /** Código de pedido del perfil laminado por UNA cara. */
  codeOneFace?: string;
  /** Código de pedido del perfil laminado por LAS DOS caras. */
  codeTwoFaces?: string;
};

// El HEX y el factor de precio salen de la lista EXWORK Veracruz
// (Catalogo_Perfiles_Aluplast_Base_Cotizacion.xlsx, rev. ABR_22 2022-05-01): el factor es el
// promedio de precio/precio-base-blanco entre todos los SKU que comparten ese código de color.
//
// LOS NOMBRES, en cambio, salen de "catalogo de folios 2025.pdf". Antes, nueve de estas entradas
// se llamaban como su código -- "BR", "BD", "NB", "DC", "GO", "SH", "SOA", "SOC", "TOM" -- porque
// la lista de precios de 2022 solo traía el código. A un arquitecto "BD" no le dice nada; "Brown
// Decor" sí. El factor de precio se queda como estaba: el catálogo de folios no lleva precios, y
// mezclar dos fuentes en un mismo número es como se fabrican los errores silenciosos.
//
// La referencia Renolit y los códigos de pedido por una o dos caras salen de
// "información técnica_Folios.pdf" (aluplastmex, ed. 2019, emitida el 2020-08-28). Sirven para
// pedir: el selector de cara de la ficha ("Exterior / Interior / Ambas caras") elige entre esos
// dos códigos. Es documentación más antigua que el catálogo de 2025, pero los nombres de los dos
// coinciden en todos los códigos comunes, así que se leen como la misma familia.
export const aluplastColors: AluplastColorItem[] = [
  { code: "bl", name: "Blanco", hex: "#F3F3EF", factor: 1.0, note: null },
  { code: "jb", name: "Jet Black Matt", hex: "#171717", factor: 1.47, renolit: "446-6062", codeOneFace: "271", codeTwoFaces: "171", note: null },
  { code: "negro", name: "Negro", hex: "#111111", factor: 1.15, note: "Código de la lista de precios sin entrada propia en el catálogo de folios 2025." },
  { code: "ag", name: "Gris Antracita", hex: "#3E4347", factor: 1.48, renolit: "436-7003", codeOneFace: "260", codeTwoFaces: "160", note: null },
  { code: "mar", name: "Marrón", hex: "#6E4A32", factor: 1.2, note: "Código de la lista de precios sin entrada propia en el catálogo de folios 2025." },
  { code: "br", name: "Bronce", hex: "#6B4939", factor: 1.4, renolit: "436-6055", codeOneFace: "278", codeTwoFaces: "178", note: null },
  { code: "bd", name: "Brown Decor", hex: "#4A342A", factor: 1.39, renolit: "436-5010", codeOneFace: "233", codeTwoFaces: "133", note: "Marrón oscuro." },
  { code: "nb", name: "Nusbaun", hex: "#5B4638", factor: 1.39, renolit: "436-2035", codeOneFace: "227", codeTwoFaces: "127", note: "Nogal." },
  { code: "dc", name: "DC", hex: "#65493E", factor: 1.35, note: "El ÚNICO código que sigue sin nombre: no aparece en el catálogo de folios 2025 ni en la ficha técnica de folios. Falta confirmarlo con aluplastmex." },
  { code: "go", name: "Golden Oak", hex: "#B07A3A", factor: 1.4, renolit: "436-2036", codeOneFace: "223", codeTwoFaces: "123", note: "Roble dorado." },
  { code: "sh", name: "Sheffield", hex: "#B9AA8D", factor: 1.47, renolit: "456-3081", codeOneFace: "275", codeTwoFaces: "175", note: null },
  { code: "ma", name: "Mahagoni", hex: "#7B3F2E", factor: 1.4, renolit: "436-2002", codeOneFace: "205", codeTwoFaces: "105", note: "Caoba. Está en el catálogo de folios 2025 y en la ficha técnica, pero NO en la lista de precios de 2022: el factor es el de los folios de su misma familia (436-20xx, maderas), no un dato de precio propio." },
  { code: "sil", name: "Aluminio Silver", hex: "#B9BEC3", factor: 1.47, renolit: "436-1001", codeOneFace: "234", codeTwoFaces: "134", note: null },
  { code: "soa", name: "Woodec Sheffield Oak Alpine", hex: "#92704D", factor: 1.48, renolit: "470-3002", codeOneFace: "220", codeTwoFaces: "120", note: null },
  { code: "soc", name: "Woodec Sheffield Oak Concrete", hex: "#574338", factor: 1.48, renolit: "470-3003", codeOneFace: "221", codeTwoFaces: "121", note: null },
  { code: "tom", name: "Woodec Turner Oak Malt", hex: "#8A6749", factor: 1.47, renolit: "470-3001", codeOneFace: "219", codeTwoFaces: "119", note: null },
  { code: "ceylon", name: "Dark Chocolate Ceylon", hex: "#86715E", factor: 1.5, renolit: "446-7069", codeOneFace: "261", codeTwoFaces: "161", note: null },
  { code: "azul", name: "Azul", hex: "#315A8C", factor: 1.0, note: "Sin suficientes datos de variación de precio; se usa 1.0 como referencia." },
  { code: "rojo", name: "Rojo", hex: "#B33A32", factor: 1.0, note: "Sin suficientes datos de variación de precio; se usa 1.0 como referencia." },
];

export const colors: Record<Brand, ColorItem[]> = {
  Aluplast: aluplastColors,
  Deceuninck: [
    { name: "Blanco", code: "M3", factor: 1, hex: "#f3f3ef" },
    { name: "Roble Dorado", code: "190", factor: 1.21, hex: "#b07a3a" },
    { name: "Nogal", code: "191", factor: 1.22, hex: "#6e4a32" },
    { name: "Macoré", code: "149", factor: 1.22, hex: "#8a6749" },
    { name: "Mountain Oak", code: "196", factor: 1.23, hex: "#8a6749" },
    { name: "Winchester", code: "194", factor: 1.23, hex: "#8a6749" },
    { name: "Antracita Veteado", code: "523", factor: 1.22, hex: "#3e4347" },
    { name: "Antracita", code: "408", factor: 1.22, hex: "#3e4347" },
    { name: "Black Ulti Matt", code: "192", factor: 1.25, hex: "#1a1a1a" },
    { name: "Gris Aluminio", code: "911", factor: 1.22, hex: "#9aa0a6" },
    { name: "Truffle Oak", code: "422", factor: 1.24, hex: "#6e4a32" },
    { name: "Nogal Ulti Matt", code: "456", factor: 1.25, hex: "#6e4a32" },
  ],
};

// Real brand colors, used only as a small, contained accent on the brand toggle pill
// (not a full-page repaint — see app/page.tsx). Aluplast red extracted directly from
// aluplast.net's logo SVG fill (rgb(209,10,17)). Deceuninck reuses the page's own accent
// (--accent in globals.css), a deep cyan-blue sampled from Deceuninck's own printed
// catalog hero banners (Línea Bella/Sliding/Everest Max), averaged and darkened ~20%.
export const brandAccent: Record<Brand, string> = {
  Aluplast: "#D10A11",
  Deceuninck: "#1D6CA6",
};
