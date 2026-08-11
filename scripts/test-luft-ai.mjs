import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const loader = pathToFileURL(resolve("tests", "register-ts-loader.mjs")).href;
const entry = resolve("tests", "luft-ai.test.ts");
const tests = spawnSync(process.execPath, ["--experimental-strip-types", "--import", loader, "--test", entry], { stdio: "inherit" });
process.exitCode = tests.status ?? 1;
