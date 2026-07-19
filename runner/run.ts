/**
 * Run lifecycle:
 *   npx tsx runner/run.ts create --trigger <ui|slash|routine> [--request <id>] [--personas ciso,vrm,gtm_cs]
 *     → prints RUN_ID=<uuid>
 *   npx tsx runner/run.ts finish --run <id> [--status completed|failed] [--error "<msg>"]
 */
import { eq } from "drizzle-orm";
import { loadEnv } from "./lib/env";
import { getDb } from "../lib/db";
import { personaEvaluations, runRequests, runs } from "../lib/db/schema";
import { PERSONAS } from "../lib/schemas/findings";
import { ensureRunTrace, flushLangfuse } from "./trace";

loadEnv();

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function create(): Promise<void> {
  const trigger = arg("--trigger") ?? "slash";
  const requestId = arg("--request");
  const personas = (arg("--personas") ?? PERSONAS.join(","))
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  const invalid = personas.filter((p) => !(PERSONAS as readonly string[]).includes(p));
  if (invalid.length) throw new Error(`unknown personas: ${invalid.join(", ")}`);

  const db = await getDb();
  const [run] = await db
    .insert(runs)
    .values({ trigger, personas, status: "running" })
    .returning();

  await db.update(runs).set({ langfuseTraceId: run.id }).where(eq(runs.id, run.id));
  if (requestId) {
    await db
      .update(runRequests)
      .set({ status: "running", runId: run.id })
      .where(eq(runRequests.id, requestId));
  }
  ensureRunTrace(run.id, { trigger, personas, requestId: requestId ?? null });
  await flushLangfuse();
  console.log(`RUN_ID=${run.id}`);
}

async function finish(): Promise<void> {
  const runId = arg("--run");
  if (!runId) throw new Error("usage: finish --run <id> [--status ...] [--error ...]");
  const error = arg("--error");
  let status = arg("--status");

  const db = await getDb();
  if (!status) {
    const evals = await db
      .select({ status: personaEvaluations.status })
      .from(personaEvaluations)
      .where(eq(personaEvaluations.runId, runId));
    const completed = evals.filter((e) => e.status === "completed").length;
    status = error ? "failed" : completed > 0 ? "completed" : "failed";
  }

  await db
    .update(runs)
    .set({ status, finishedAt: new Date(), error: error ?? null })
    .where(eq(runs.id, runId));
  const requests = await db
    .select({ id: runRequests.id })
    .from(runRequests)
    .where(eq(runRequests.runId, runId));
  for (const r of requests) {
    await db
      .update(runRequests)
      .set({ status: status === "completed" ? "completed" : "failed" })
      .where(eq(runRequests.id, r.id));
  }
  await flushLangfuse();
  console.log(`run ${runId} → ${status}`);
}

async function main(): Promise<void> {
  const cmd = process.argv[2];
  if (cmd === "create") return create();
  if (cmd === "finish") return finish();
  throw new Error("usage: run.ts <create|finish> …");
}

main().catch((e) => {
  console.error(`ERROR: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
