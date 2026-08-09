import { getCompanySettings } from "@/lib/companySettings";
import { Workspace } from "./Workspace";

// Envoltorio de servidor del workspace interno. Existe por una sola razón: los datos bancarios
// se resuelven aquí, en el servidor, y bajan como props ya resueltas a un componente de
// cliente. Así la CLABE nunca se sirve por una ruta de API (que hoy sería pública, porque
// ninguna ruta de app/api tiene autenticación) ni queda escrita en el repositorio.
// Ver lib/companySettings.ts y PROCESO_POST_COTIZACION.md.
export default function Page() {
  return <Workspace company={getCompanySettings()} />;
}
