import { existsSync, statSync } from "node:fs";
import { extname, resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolvePath(fileURLToPath(new URL("..", import.meta.url)));

function existingModule(path) {
  const candidates = extname(path)
    ? [path]
    : [path, `${path}.ts`, `${path}.tsx`, `${path}.js`, `${path}.mjs`, resolvePath(path, "index.ts")];
  return candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile()) ?? null;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const modulePath = existingModule(resolvePath(root, specifier.slice(2)));
    if (modulePath) return { url: pathToFileURL(modulePath).href, shortCircuit: true };
  }
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:")) {
    const parentPath = fileURLToPath(new URL(".", context.parentURL));
    const modulePath = existingModule(resolvePath(parentPath, specifier));
    if (modulePath) return { url: pathToFileURL(modulePath).href, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
