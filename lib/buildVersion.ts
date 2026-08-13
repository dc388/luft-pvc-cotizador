/** El identificador del build actual. Se usa además para sellar los archivos exportados
 *  (`exportedBy` en lib/projectFile.ts): si algún día llega un archivo raro, dice qué versión lo
 *  escribió. */
export function buildId(): string {
  return __LUFT_BUILD_ID__;
}

// Se comparte entre el entry point del Worker y la ruta de la app. El manejo directo en el
// Worker cubre /api/version sin barra final, que en producción no siempre llega al app router.
export function buildVersionResponse() {
  return Response.json(
    { version: __LUFT_BUILD_ID__ },
    {
      headers: {
        "cache-control": "no-store, no-cache, must-revalidate, max-age=0",
        expires: "0",
        pragma: "no-cache",
      },
    },
  );
}
