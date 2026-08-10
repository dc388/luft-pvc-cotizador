const cloudflareWorkersStub =
  "data:text/javascript,export%20const%20env%20%3D%20Object.freeze%28%7B%7D%29%3B";

// The production Worker provides this built-in module. Node's artifact smoke tests do not,
// so resolve only that one specifier to an empty environment while leaving all other imports
// on Node's normal loader path.
export async function resolve(specifier, context, nextResolve) {
  if (specifier === "cloudflare:workers") {
    return { shortCircuit: true, url: cloudflareWorkersStub };
  }
  return nextResolve(specifier, context);
}
