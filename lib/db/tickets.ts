import { eq } from "drizzle-orm";
import type { Db } from "@/lib/db";
import { deliverables, ticketDrafts } from "@/lib/db/schema";
import { draftTicketsFromDeliverable } from "@/lib/tickets";
import { TicketDraftSchema, type TicketDraft } from "@/lib/schemas/ticket";
import type { KfdRow } from "@/lib/schemas/findings";

/**
 * Ensure a validated ticket draft exists for a run, generating it deterministically
 * from the approved deliverable's Kill/Fix/Double-Down matrix if absent. Returns the
 * stored draft, or null if there's nothing to draft (no deliverable) OR the
 * generated draft fails validation (e.g. more KFD rows than TicketDraftSchema's
 * ticket cap) — a malformed/oversized deliverable degrades to "can't draft yet"
 * rather than throwing an unhandled 500 out of an API route. Never regenerates
 * over an existing draft (so a push in flight isn't disturbed). The caller is
 * responsible for the approval gate.
 */
export async function ensureTicketDraft(db: Db, runId: string): Promise<TicketDraft | null> {
  const [existing] = await db.select().from(ticketDrafts).where(eq(ticketDrafts.runId, runId));
  if (existing) {
    const parsed = TicketDraftSchema.safeParse(existing.draft);
    return parsed.success ? parsed.data : null;
  }

  const [deliverable] = await db
    .select()
    .from(deliverables)
    .where(eq(deliverables.runId, runId));
  if (!deliverable) return null;

  const kfd = deliverable.kfdTable as KfdRow[];
  if (!Array.isArray(kfd) || kfd.length === 0) return null;

  const draft = draftTicketsFromDeliverable(kfd, {
    runId,
    generatedAt: new Date().toISOString(),
  });
  const parsed = TicketDraftSchema.safeParse(draft);
  if (!parsed.success) return null;

  await db
    .insert(ticketDrafts)
    .values({ runId, draft: parsed.data })
    .onConflictDoNothing({ target: ticketDrafts.runId });
  return parsed.data;
}

/** Read the stored draft + push state for a run (null if none drafted or malformed). */
export async function getTicketDraft(db: Db, runId: string) {
  const [row] = await db.select().from(ticketDrafts).where(eq(ticketDrafts.runId, runId));
  if (!row) return null;
  const parsed = TicketDraftSchema.safeParse(row.draft);
  if (!parsed.success) return null;
  return {
    draft: parsed.data,
    pushedAt: row.pushedAt,
    pushedIssueIds: row.pushedIssueIds,
  };
}
