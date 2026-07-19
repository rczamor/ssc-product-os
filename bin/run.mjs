#!/usr/bin/env node
/**
 * Robust runner launcher. Loads .env.local IN-PROCESS (no shell expansion) and
 * execs the given command with that environment. Use this instead of the
 * fragile `set -a; . ./.env.local; set +a; <cmd>` prefix:
 *
 *   node bin/run.mjs npx tsx runner/browse.ts login
 *   ./bin/run.mjs npx tsx runner/journey.ts --run <id> --persona ciso
 *
 * Why: sourcing .env.local in bash expands `$`-sequences, so a value like
 * SSC_PASSWORD=3H$7ASRiip becomes 3HASRiip. Node reads the file literally, and
 * because NODE_EXTRA_CA_CERTS is placed into the environment BEFORE the child
 * process starts, TLS to the proxy (Langfuse/Neon) works for the child too.
 * Mirrors runner/lib/env.ts loadEnv(): already-set variables win; matching
 * single/double quotes are stripped.
 */
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";

const envFile = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("usage: node bin/run.mjs <command> [args…]");
  console.error("  e.g. node bin/run.mjs npx tsx runner/browse.ts login");
  process.exit(1);
}

const result = spawnSync(args[0], args.slice(1), {
  stdio: "inherit",
  env: process.env,
});
if (result.error) {
  console.error(`ERROR: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
