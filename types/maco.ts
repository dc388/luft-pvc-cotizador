// Tipos compartidos del catálogo de herrajes MACO para sistemas Aluplast.
//
// Viven aparte de lib/maco/catalog.ts a propósito. Ese módulo consulta la base y devuelve precios
// de proveedor, así que es SOLO de servidor; la pantalla interna (un componente cliente) necesita
// los tipos de los renglones que recibe por fetch, pero no debe tener ninguna razón para importar
// el módulo que hace la consulta. Un `import type` se borra al compilar, pero teniendo los tipos
// aquí no queda ni la tentación: si algún día alguien convierte ese import en un import de valor,
// el precio de proveedor se iría al bundle del navegador.
//
// Este archivo no importa nada y no debe importar nada.

/** Campos por los que se puede buscar en el catálogo. "todo" busca en los tres. */
export type MacoSearchField = "sku" | "clave" | "descripcion" | "todo";

/** Un herraje con su precio en la revisión consultada. */
export type MacoHardwareRow = {
  sku: string;
  altKey: string;
  description: string;
  unit: string;
  presentation: string;
  qtyPerPresentation: string;
  /** Precio unitario exacto, en texto: "11.38". Nunca un número de coma flotante. */
  unitPrice: string;
  currency: string;
  effectiveDate: string;
  terms: string;
  revision: string;
  /** Fila del Excel de origen: la procedencia del dato. */
  sourceRow: number;
  /** Fabricante del herraje: "MACO". */
  supplier: string;
  /** Marca de perfiles compatible: "Aluplast". */
  brand: string;
  revisionActive: boolean;
  revisionHistorical: boolean;
};

/** Una revisión de la lista, tal como la muestra la pantalla interna. */
export type MacoRevision = {
  revision: string;
  /** Etiqueta lista para mostrar: "Lista histórica ABR_22 · 1 de mayo de 2022 · EUR · …". */
  label: string;
  active: boolean;
  historical: boolean;
  currency: string;
  terms: string;
  effectiveDate: string;
  fileName: string;
  fileHashShort: string;
  itemCount: number;
  supplier: string;
  brand: string;
};
