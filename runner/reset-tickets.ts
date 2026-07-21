/**
 * Reset a run's matrix→ticket state back to default so the Approve→create-tickets
 * flow can be tested fresh: deletes the ticket_draft (draft + push record), the
 * approval row(s), clears every finding's selected_for_ticket flag, and un-archives
 * every finding (archived/archived_reason back to default). Does NOT delete
 * findings, the deliverable, or Linear — clean up Linear issues separately.
 *
 *   npx tsx runner/reset-tickets.ts --dry-run [--run <id>]
 *     Print what WOULD be reset (default: latest completed run). No writes.
 *
 *   npx tsx runner/reset-tickets.ts --confirm [--run <id>]
 *     Perform the reset. --confirm is required (guards a destructive write).
 */
import { desc, eq } from "drizzle-orm";
import { loadEnv } from "./lib/env";
import { hasFlag as hasFlagOf } from "./lib/args";
import { getDb } from "../lib/db";
import { approvals, findings, runs, ticketDrafts } from "../lib/db/schema";

loadEnv();
const ARGV = process.argv.slice(2);
const hasFlag = (f: string) => hasFlagOf(ARGV, f);
function getArg(flag: string): string | undefined {
  const i = ARGV.indexOf(flag);
  return i >= 0 ? ARGV[i + 1] : undefined;
}

async function main(): Promise<void> {
  const db = await getDb();
  const runId =
    getArg("--run") ??
    (
      await db
        .select({ id: runs.id })
        .from(runs)
        .where(eq(runs.status, "completed"))
        .orderBy(desc(runs.startedAt))
        .limit(1)
    )[0]?.id;
  if (!runId) throw new Error("no completed run found — pass --run <uuid>");

  const [draft] = await db.select().from(ticketDrafts).where(eq(ticketDrafts.runId, runId));
  const appr = await db.select({ id: approvals.id }).from(approvals).where(eq(approvals.runId, runId));
  const flagged = await db
    .select({ id: findings.id, sel: findings.selectedForTicket, archived: findings.archived })
    .from(findings)
    .where(eq(findings.runId, runId));
  const flaggedCount = flagged.filter((f) => f.sel).length;
  const archivedCount = flagged.filter((f) => f.archived).length;

  console.log(`run ${runId}:`);
  console.log(`  ticket_drafts: ${draft ? "1 (pushedAt=" + draft.pushedAt + ")" : "0"}`);
  console.log(`  approvals: ${appr.length}`);
  console.log(`  findings selected_for_ticket: ${flaggedCount} of ${flagged.length}`);
  console.log(`  findings archived: ${archivedCount} of ${flagged.length}`);

  if (!hasFlag("--confirm")) {
    console.log("\nDRY RUN — pass --confirm to reset. Nothing was written.");
    return;
  }

  await db.delete(ticketDrafts).where(eq(ticketDrafts.runId, runId));
  await db.delete(approvals).where(eq(approvals.runId, runId));
  await db
    .update(findings)
    .set({ selectedForTicket: false, archived: false, archivedReason: null })
    .where(eq(findings.runId, runId));

  console.log(
    "\nRESET complete: draft removed, approval(s) cleared, selections unflagged, findings un-archived.",
  );
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
