// Same translation the examples/d1 sample route uses: a missing table means the migration
// hasn't been generated/applied yet, which is a much more actionable message than a raw
// SQLite error for whoever's looking at server logs or a failed fetch in the client.
export function toRouteErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "Unexpected error";
  const detail = error instanceof Error && error.cause instanceof Error ? error.cause.message : "";
  const combined = `${message}\n${detail}`;

  if (combined.includes("no such table")) {
    return "Las tablas de proyectos no existen todavía. Genera la migración con `npm run db:generate` y aplícala antes de usar la base de datos.";
  }
  if (combined.includes("D1 binding")) {
    return "La base de datos D1 no está disponible en este entorno todavía.";
  }
  return message;
}
