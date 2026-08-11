// Sustituto de `cloudflare:workers` para las pruebas en Node. Solo lo resuelve el loader de
// tests (tests/ts-alias-loader.mjs); el bundle de la aplicación nunca lo ve, así que la barrera
// que impide que lib/companySettings.ts llegue al navegador sigue intacta.
//
// El entorno va vacío a propósito: getCompanySettings() no tiene valores de respaldo, así que
// las pruebas ejercitan el mismo camino que producción cuando un secreto no está configurado.
// Ninguna prueba debe depender de datos bancarios reales para pasar.
export const env: Record<string, unknown> = {};
