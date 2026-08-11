import { getCompanySettings } from "@/lib/companySettings";
import { getChatGPTUser } from "./chatgpt-auth";
import type { LuftActor } from "@/lib/luft-ai";
import { Workspace } from "./Workspace";

// Envoltorio de servidor del workspace interno. Existe por una sola razón: los datos bancarios
// se resuelven aquí, en el servidor, y bajan como props ya resueltas a un componente de
// cliente. Así la CLABE nunca se sirve por una ruta de API (que hoy sería pública, porque
// ninguna ruta de app/api tiene autenticación) ni queda escrita en el repositorio.
// Ver lib/companySettings.ts y PROCESO_POST_COTIZACION.md.
function emailList(value: string | undefined): Set<string> {
  return new Set((value ?? "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean));
}

export default async function Page() {
  const user = await getChatGPTUser();
  const email = user?.email.toLowerCase();
  const owners = emailList(process.env.LUFT_OWNER_USERS);
  const technicalUsers = emailList(process.env.LUFT_TECHNICAL_USERS);
  const role: LuftActor["role"] = email && owners.has(email)
    ? "owner"
    : email && technicalUsers.has(email)
      ? "technical"
      : process.env.NODE_ENV === "development"
        ? "technical"
        : "viewer";
  const actor: LuftActor = {
    id: email ?? (process.env.NODE_ENV === "development" ? "local-development" : "anonymous"),
    role,
    displayName: user?.displayName ?? (role === "technical" ? "Sesión local" : "Visitante"),
  };
  return <Workspace company={getCompanySettings()} agentActor={actor} agentSignedIn={!!user} />;
}
