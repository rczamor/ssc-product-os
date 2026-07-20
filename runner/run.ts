/**
 * Run lifecycle:
 *   npx tsx runner/run.ts create --trigger <ui|slash|routine> [--id <uuid>] [--request <id>] [--personas ciso,vrm,gtm_cs]
 *     → prints RUN_ID=<uuid>. --id adopts an existing on-disk run id idempotently
 *       (used to republish a locally-built run into the deployed Neon DB).
 *   npx tsx runner/run.ts finish --run <id> [--status completed|failed] [--error "<msg>"]
 */
import { eq } from "drizzle-orm";
import { loadEnv } from "./lib/env";
import { arg as argOf } from "./lib/args";
import { getDb } from "../lib/db";
import { personaEvaluations, runRequests, runs } from "../lib/db/schema";
import { PERSONAS } from "../lib/schemas/findings";
import { isUuid } from "../lib/validation";
import { ensureRunTrace, flushLangfuse } from "./trace";

loadEnv();

const ARGV = process.argv.slice(2);
const arg = (flag: string) => argOf(ARGV, flag);

const RUN_STATUSES = ["running", "completed", "failed"] as const;
const TRIGGERS = ["ui", "slash", "routine"] as const;

async function create(): Promise<void> {
  const trigger = arg("--trigger") ?? "slash";
  if (!(TRIGGERS as readonly string[]).includes(trigger)) {
    throw new Error(`invalid --trigger: ${trigger} (one of ${TRIGGERS.join("|")})`);
  }
  const requestId = arg("--request");
  const personas = (arg("--personas") ?? PERSONAS.join(","))
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  const invalid = personas.filter((p) => !(PERSONAS as readonly string[]).includes(p));
  if (invalid.length) throw new Error(`unknown personas: ${invalid.join(", ")}`);

  // --id adopts an existing on-disk run into whatever DB DATABASE_URL points at,
  // idempotently. This is how a run built locally (PGlite) is republished to the
  // deployed Neon DB without re-running the browser: create --id <same-id>, then
  // the usual publish.ts steps find their FK parent. Re-running never clobbers a
  // completed row (onConflictDoNothing).
  const explicitId = arg("--id");
  if (explicitId && !isUuid(explicitId)) {
    throw new Error(`--id must be a uuid: ${explicitId}`);
  }

  const db = await getDb();
  let run: typeof runs.$inferSelect;
  if (explicitId) {
    await db
      .insert(runs)
      .values({ id: explicitId, trigger, personas, status: "running" })
      .onConflictDoNothing({ target: runs.id });
    const [adopted] = await db.select().from(runs).where(eq(runs.id, explicitId));
    if (!adopted) throw new Error(`failed to adopt run ${explicitId}`);
    run = adopted;
  } else {
    [run] = await db.insert(runs).values({ trigger, personas, status: "running" }).returning();
  }

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
  if (status && !(RUN_STATUSES as readonly string[]).includes(status)) {
    throw new Error(`invalid --status: ${status} (one of ${RUN_STATUSES.join("|")})`);
  }

  const db = await getDb();
  if (!status) {
    // Completed only when every requested persona completed — a run where some
    // personas failed is a partial failure, not a green run.
    const [run] = await db.select({ personas: runs.personas }).from(runs).where(eq(runs.id, runId));
    const requested = run?.personas ?? [];
    const evals = await db
      .select({ persona: personaEvaluations.persona, status: personaEvaluations.status })
      .from(personaEvaluations)
      .where(eq(personaEvaluations.runId, runId));
    const completed = new Set(evals.filter((e) => e.status === "completed").map((e) => e.persona));
    const allDone = requested.length > 0 && requested.every((p) => completed.has(p));
    status = error || !allDone ? "failed" : "completed";
  }

  await db
    .update(runs)
    .set({ status, finishedAt: new Date(), error: error ?? null })
    .where(eq(runs.id, runId));
  // One statement, not a per-row loop — atomic and can't strand requests.
  await db
    .update(runRequests)
    .set({ status: status === "completed" ? "completed" : "failed" })
    .where(eq(runRequests.runId, runId));
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
