export const dynamic = "force-dynamic";

// Los clientes antiguos consultan este endpoint del Worker nuevo y comparan la versión con
// la que quedó incrustada en su JavaScript. Nunca debe responder desde caché.
export async function GET() {
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
