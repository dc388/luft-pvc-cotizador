import { execSync } from "node:child_process";
import vinext from "vinext";
import { defineConfig } from "vite";
import { sites } from "./build/sites-vite-plugin";

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

/** El commit de esta copia de trabajo, para que un despliegue manual sepa decir quien es.
 *  Sin git disponible devuelve null y se cae al valor de siempre. */
function localGitSha(): string | null {
  try {
    const sha = execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
    if (!sha) return null;
    const sucio = execSync("git status --porcelain", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
    // Un build con cambios sin confirmar no es ese commit: decirlo evita perseguir fantasmas.
    return sucio ? `${sha}+local` : sha;
  } catch {
    return null;
  }
}

export default defineConfig(async ({ command }) => {
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");
  // Se incrusta en cliente y servidor. Una pestaña antigua consulta /api/version del
  // despliegue nuevo, detecta el cambio y se recarga sobre el mismo URL permanente.
  // Las tres primeras las pone la integracion continua. La cuarta es la que faltaba: un despliegue
  // hecho a mano desde una computadora se quedaba en "development", asi que produccion no sabia
  // decir que version estaba sirviendo. Eso costo una sesion entera de confusion -- se reviso el
  // codigo tres veces buscando un defecto que ya estaba corregido, porque el navegador miraba un
  // build viejo y el endpoint de version no lo delataba. Un despliegue tiene que saber decir quien
  // es, venga de donde venga.
  const buildId = process.env.NEXT_PUBLIC_BUILD_ID
    ?? process.env.GITHUB_SHA
    ?? process.env.CF_PAGES_COMMIT_SHA
    ?? localGitSha()
    ?? "development";

  return {
    define: {
      __LUFT_BUILD_ID__: JSON.stringify(buildId),
      // Cierto únicamente con `vite` (servidor de desarrollo). Cualquier `vite build` lo deja en
      // `false`, así que lo que dependa de esta bandera desaparece del bundle desplegado.
      __LUFT_LOCAL_DEV__: JSON.stringify(command === "serve"),
    },
    server: {
      host: "0.0.0.0",
      // Puerto fijo para que http://localhost:5173 sea el enlace de siempre y se pueda anclar en
      // el navegador. Los arranques con `--port` explícito lo sobrescriben.
      port: 5173,
      // ".trycloudflare.com" habilita los túneles rápidos de Cloudflare
      // (`cloudflared tunnel --url http://localhost:5174`) para enseñarle el cotizador a
      // alguien fuera de esta red sin desplegar. Solo afecta al servidor de desarrollo: es la
      // protección anti DNS-rebinding de Vite, que no existe en producción. El subdominio del
      // túnel es aleatorio en cada arranque, de ahí el comodín en vez de un host fijo.
      allowedHosts: ["terminal.local", ".trycloudflare.com"],
      ...(isCodexSeatbeltSandbox
        ? { watch: { useFsEvents: false, usePolling: true } }
        : {}),
    },
    plugins: [
      vinext(),
      sites(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        inspectorPort: false,
      }),
    ],
  };
});
