import fs from "fs";
import path from "path";

/**
 * Loads .env.local into process.env (already-set variables win, no variable
 * expansion). Runner scripts call this first so `npx tsx runner/x.ts` works
 * without shell plumbing.
 *
 * Caveat: NODE_EXTRA_CA_CERTS is read by Node at process start, so setting it
 * here is too late for TLS. When talking to Langfuse/Neon from behind a
 * TLS-intercepting proxy, launch scripts with the variable already exported:
 *   set -a; . ./.env.local; set +a; npx tsx runner/x.ts
 */
export function loadEnv(): void {
  const file = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
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
