/**
 * Drafts the matrix→Linear tickets for a run from its published deliverable and
 * writes runs/<id>/tickets.json + stores the draft in the DB (ticket_drafts).
 * Deterministic (draftTicketsFromDeliverable) so it's reproducible/idempotent.
 *
 *   npx tsx runner/draft-tickets.ts --run <id> --validate-only
 *   npx tsx runner/draft-tickets.ts --run <id>
 *
 * Drafting is harmless without approval, but the app-side PUSH is hard-gated on a
 * human approval — this only prepares the artifact.
 */
import fs from "fs";
import path from "path";
import { eq } from "drizzle-orm";
import { loadEnv } from "./lib/env";
import { arg as argOf, hasFlag as hasFlagOf } from "./lib/args";
import { assertSafeSegment } from "./lib/session";
import { getDb } from "../lib/db";
import { deliverables } from "../lib/db/schema";
import { draftTicketsFromDeliverable } from "../lib/tickets";
import { ensureTicketDraft } from "../lib/db/tickets";
import { TicketDraftSchema } from "../lib/schemas/ticket";
import type { KfdRow } from "../lib/schemas/findings";
import { runMain } from "./lib/zod";

loadEnv();
const ARGV = process.argv.slice(2);
const arg = (f: string) => argOf(ARGV, f);
const hasFlag = (f: string) => hasFlagOf(ARGV, f);

async function main(): Promise<void> {
  const runId = arg("--run");
  if (!runId) throw new Error("--run <id> is required");
  assertSafeSegment("run id", runId);

  const db = await getDb();
  const [deliverable] = await db
    .select()
    .from(deliverables)
    .where(eq(deliverables.runId, runId));
  if (!deliverable) throw new Error(`no deliverable published for run ${runId}`);

  const kfd = deliverable.kfdTable as KfdRow[];
  const draft = TicketDraftSchema.parse(
    draftTicketsFromDeliverable(kfd, { runId, generatedAt: new Date().toISOString() }),
  );

  if (hasFlag("--validate-only")) {
    const epics = draft.tickets.filter((t) => t.type === "epic").length;
    const decisions = draft.tickets.filter((t) => t.type === "decision").length;
    console.log(`VALID: ${epics} epics + ${decisions} CCB decisions`);
    return;
  }

  const dir = path.join(process.cwd(), "runs", runId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "tickets.json"), JSON.stringify(draft, null, 2));
  await ensureTicketDraft(db, runId);
  console.log(`drafted ${draft.tickets.length} tickets → runs/${runId}/tickets.json + ticket_drafts`);
}

runMain(main);
