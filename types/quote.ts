import type { WingType } from "./domain";
import type { QuoteStatus } from "@/lib/quoteStatus";

// El expediente comercial de una cotización pública. Vive aparte de types/project.ts porque
// responde otra pregunta: `ProjectRecord` describe lo que se va a fabricar, esto describe a quién
// se le cotizó y qué documento se le entregó.

/** Un renglón del documento, con los nombres ya resueltos contra el catálogo y su importe ya
 *  calculado. No guarda ids: el documento debe poder leerse dentro de dos años aunque el
 *  catálogo haya cambiado de nombres o de estilos. */
export type QuoteSnapshotItem = {
  id: string;
  productName: string;
  styleName: string;
  brandName: string;
  panels: number;
  wings: WingType[];
  widthMm: number;
  heightMm: number;
  quantity: number;
  colorName: string;
  frameHex: string;
  glassName: string;
  extras: { instalacion: boolean };
  unitPrice: number;
  lineTotal: number;
};

/** El documento definitivo, congelado. Es la ÚNICA estructura del proyecto que contiene importes
 *  destinados a los ojos del cliente, y solo se renderiza en la página del documento
 *  (app/cotizacion/[token]) -- nunca se envía al cotizador mientras el cliente configura.
 *
 *  Se guarda resuelto y no como configuración cruda a propósito: recalcular al abrirlo haría que
 *  la cotización de marzo cambiara de precio en abril, y lo que se cotizó es lo que se cotizó. */
export type QuoteSnapshot = {
  version: 1;
  folio: string;
  issuedAt: string;
  customer: {
    name: string;
    phone: string;
    email: string;
    company: string;
    city: string;
    postalCode: string;
    address: string;
  };
  project: { name: string; notes: string };
  items: QuoteSnapshotItem[];
  totals: {
    subtotal: number;
    total: number;
    estimated: boolean;
    depositPercentage: number;
    deposit: number;
    remaining: number;
  };
};

/** Una fila de la libreta de clientes del panel interno. Reúne cotización y cliente porque es
 *  como se lee: "José Pérez · LUFT-2026-000015 · Contactado". */
export type QuoteListRow = {
  id: string;
  folio: string;
  token: string;
  status: QuoteStatus;
  projectId: string | null;
  projectName: string;
  notes: string;
  itemCount: number;
  pieceCount: number;
  total: number;
  createdAt: string;
  updatedAt: string;
  customer: {
    id: string;
    name: string;
    phone: string;
    email: string;
    company: string;
    city: string;
    postalCode: string;
    address: string;
  };
  /** Cuántas cotizaciones tiene ese cliente en total, contando esta. Es lo que convierte la
   *  lista en un expediente: un cliente con 3 se reconoce sin abrir nada. */
  customerQuoteCount: number;
};

export type QuoteEventRow = {
  id: string;
  status: QuoteStatus;
  note: string;
  createdAt: string;
};
