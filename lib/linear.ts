import fs from "fs";
import path from "path";
import { LinearClient } from "@linear/sdk";

/**
 * Linear workspace resolution + SDK client. Ids come from config/linear.json
 * (committed); the LINEAR_API_KEY secret comes from the environment only.
 * All take-home work lives inside the SSC-ProductOS project so it never mixes
 * with the team's other labels.
 */

export interface LinearConfig {
  team: { id: string; key: string; name: string };
  project: { id: string; name: string; url: string };
  /** label name -> label id (e.g. "track:external"). */
  labels: Record<string, string>;
  /** state name -> state id (e.g. "Done"). */
  states: Record<string, string>;
  priorities: { urgent: number; high: number; medium: number; low: number };
  /** Configurable day-0 for the 30-day role-plan due dates (ISO date). */
  day0: string;
  buildEpics: Record<string, string>;
}

let cachedConfig: LinearConfig | null = null;

/** Load config/linear.json (throws with a clear message if absent). */
export function getLinearConfig(): LinearConfig {
  if (cachedConfig) return cachedConfig;
  const file = path.join(process.cwd(), "config", "linear.json");
  if (!fs.existsSync(file)) {
    throw new Error(
      "config/linear.json not found — run Phase 0 Linear setup to create the project and record its ids",
    );
  }
  cachedConfig = JSON.parse(fs.readFileSync(file, "utf8")) as LinearConfig;
  return cachedConfig;
}

/** True when a LINEAR_API_KEY is present so live Linear calls can be made. */
export function isLinearConfigured(): boolean {
  return Boolean(process.env.LINEAR_API_KEY);
}

let cachedClient: LinearClient | null = null;

/**
 * The Linear SDK client. Throws a clear error when LINEAR_API_KEY is unset so
 * callers (the push route, the sync job) fail loudly rather than silently
 * no-op — every Linear write path checks isLinearConfigured() first and
 * returns a 503-style response when it is missing.
 */
export function getLinearClient(): LinearClient {
  const apiKey = process.env.LINEAR_API_KEY;
  if (!apiKey) {
    throw new Error("LINEAR_API_KEY is not set — cannot reach Linear");
  }
  if (!cachedClient) cachedClient = new LinearClient({ apiKey });
  return cachedClient;
}

/** Resolve a label name to its id from config (throws if unknown). */
export function labelId(name: string): string {
  const id = getLinearConfig().labels[name];
  if (!id) throw new Error(`unknown Linear label: ${name}`);
  return id;
}

/** Resolve a workflow-state name to its id from config (throws if unknown). */
export function stateId(name: string): string {
  const id = getLinearConfig().states[name];
  if (!id) throw new Error(`unknown Linear state: ${name}`);
  return id;
}
