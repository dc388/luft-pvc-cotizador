import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const loader = pathToFileURL(resolve("tests", "register-ts-loader.mjs")).href;
const entries = [
  "luft-ai.test.ts",
  "assistantBrief.test.ts",
  "briefMatch.test.ts",
  "priceStatus.test.ts",
  "publicSteps.test.ts",
  "public-assistant.test.ts",
].map((file) => resolve("tests", file));
const tests = spawnSync(process.execPath, ["--experimental-strip-types", "--import", loader, "--test", ...entries], { stdio: "inherit" });
process.exitCode = tests.status ?? 1;
