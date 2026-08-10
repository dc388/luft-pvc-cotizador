import { buildVersionResponse } from "@/lib/buildVersion";

export const dynamic = "force-dynamic";

// Los clientes antiguos consultan este endpoint del Worker nuevo y comparan la versión con
// la que quedó incrustada en su JavaScript. Nunca debe responder desde caché.
export async function GET() {
  return buildVersionResponse();
}
