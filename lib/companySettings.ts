import { env } from "cloudflare:workers";

// Datos fiscales, bancarios y comerciales de la empresa.
//
// SOLO SERVIDOR. Importa `cloudflare:workers`, así que si un componente de cliente lo importa
// el bundle revienta -- esa ruptura es intencional: es la barrera que impide que la CLABE
// termine en el JavaScript que descarga el navegador. La forma correcta de usarlo es leerlo en
// un server component y bajarlo como props (ver app/page.tsx).
//
// POR QUÉ NO ESTÁ EN EL CÓDIGO NI EN LA BASE DE DATOS:
// - Estaba escrito en components/reports/CotizacionDoc.tsx, y por tanto en todo el historial
//   de git. El repo es privado hoy, pero cualquier cambio de visibilidad lo expone
//   retroactivamente.
// - Tampoco se sirve por una ruta de API: hoy NINGUNA ruta de app/api tiene autenticación,
//   así que un endpoint que devuelva la CLABE la dejaría en internet abierto -- peor que
//   tenerla en un repo privado. Mientras no exista autenticación, este dato solo se resuelve
//   en el servidor y viaja ya renderizado dentro del documento.
//
// Cuando exista el panel de administración (ver PROCESO_POST_COTIZACION.md, fases 1-2), esto
// se mueve a una tabla de configuración editable, detrás de autenticación. La forma de este
// tipo no cambia: solo cambia de dónde se llena.
//
// CÓMO SE CONFIGURA
//   Local:      archivo .dev.vars en la raíz (ignorado por git). Ver .dev.vars.example.
//   Producción: `wrangler secret put COMPANY_CLABE`, etc.

export type CompanySettings = {
  legalName: string;
  bankName: string;
  bankAccount: string;
  clabe: string;
  comercial: string;
  warranty: string;
  /** Porcentaje de anticipo (0-100). Configurable porque el 70/30 es política comercial,
   * no una constante del negocio. */
  depositPercentage: number;
};

// Sin valores de respaldo a propósito: un default plausible es justo lo que haría que un dato
// bancario equivocado pasara desapercibido en una cotización real. Si falta, se ve que falta.
function read(key: string): string {
  const value = (env as unknown as Record<string, unknown>)[key];
  return typeof value === "string" ? value.trim() : "";
}

const DEFAULT_DEPOSIT_PERCENTAGE = 70;

export function getCompanySettings(): CompanySettings {
  const rawDeposit = Number(read("COMPANY_DEPOSIT_PERCENTAGE"));
  return {
    legalName: read("COMPANY_LEGAL_NAME"),
    bankName: read("COMPANY_BANK_NAME"),
    bankAccount: read("COMPANY_BANK_ACCOUNT"),
    clabe: read("COMPANY_CLABE"),
    comercial: read("COMPANY_COMERCIAL"),
    warranty: read("COMPANY_WARRANTY"),
    depositPercentage:
      Number.isFinite(rawDeposit) && rawDeposit > 0 && rawDeposit <= 100 ? rawDeposit : DEFAULT_DEPOSIT_PERCENTAGE,
  };
}

// Los importes del anticipo se derivan aquí, en servidor, nunca en el navegador: el frontend
// presenta, no decide cuánto debe depositar un cliente (regla §14 del brief).
export function splitDeposit(total: number, depositPercentage: number) {
  const deposit = Math.round((total * depositPercentage) / 100);
  return { total, depositPercentage, deposit, remaining: total - deposit };
}
