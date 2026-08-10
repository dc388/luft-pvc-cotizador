import { mkdtempSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

// Keep the transient bundle inside the workspace. On Windows the sandboxed esbuild child
// cannot always traverse from the user Temp directory back into the repository.
const temp = mkdtempSync(join(resolve("."), ".codex-public-assistant-tests-"));
const output = join(temp, "public-assistant.test.mjs");
const bin = resolve("node_modules", "esbuild", "bin", "esbuild");
const entry = resolve("tests", "public-assistant.test.ts");
const workersStub = resolve("tests", "cloudflare-workers-stub.ts").replaceAll("\\", "/");

try {
  const bundle = spawnSync(process.execPath, [bin,
    entry,
    "--bundle",
    "--platform=node",
    "--format=esm",
    `--alias:cloudflare:workers=${workersStub}`,
    `--outfile=${output}`,
  ], { stdio: "inherit" });
  if (bundle.status !== 0) process.exit(bundle.status ?? 1);
  const tests = spawnSync(process.execPath, ["--test", output], { stdio: "inherit" });
  process.exitCode = tests.status ?? 1;
} finally {
  rmSync(temp, { recursive: true, force: true });
}
