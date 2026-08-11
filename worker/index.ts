/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { buildVersionResponse } from "@/lib/buildVersion";
import { guardInternal } from "@/lib/internalGate";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  /** Contraseña del área interna. Ver lib/internalGate.ts; se carga con `wrangler secret put`. */
  INTERNAL_PASSWORD?: string;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Candado de lo interno ANTES que cualquier otra cosa: éste es el único punto por el que
    // pasa toda petición, así que ninguna ruta lo esquiva. Lo público (el cotizador y sus
    // endpoints) sigue de largo -- ver lib/internalGate.ts.
    const gated = await guardInternal(request, env.INTERNAL_PASSWORD);
    if (gated) return gated;

    // Respuesta directa para que tanto /api/version como /api/version/ funcionen igual en el
    // Worker desplegado. Así incluso una pestaña de una versión anterior puede descubrir el
    // siguiente deploy y recargarse.
    if (url.pathname === "/api/version" || url.pathname === "/api/version/") {
      return buildVersionResponse();
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;
