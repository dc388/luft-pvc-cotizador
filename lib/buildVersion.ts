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
