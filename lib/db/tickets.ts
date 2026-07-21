import { and, asc, eq, or } from "drizzle-orm";
import type { Db } from "@/lib/db";
import { deliverables, findings, ticketDrafts } from "@/lib/db/schema";
import { draftTicketsFromFindings } from "@/lib/tickets";
import { TicketDraftSchema, type TicketDraft } from "@/lib/schemas/ticket";
import type { KfdRow, KfdVerdict } from "@/lib/schemas/findings";

/**
 * Ensure a validated ticket draft exists for a run, generating it deterministically
 * from the themes the human flagged "Add to ticket". Returns the stored draft, or
 * null when there's nothing to convert — either no theme is flagged (flagging is
 * the SOLE convert trigger; an unflagged matrix produces no tickets) or the
 * generated draft fails validation (e.g. more flagged rows than TicketDraftSchema's
 * ticket cap) — a malformed/oversized draft degrades to "can't draft yet" rather
 * than throwing an unhandled 500 out of an API route. Never regenerates over an
 * existing draft (so a push in flight isn't disturbed). The caller is responsible
 * for the approval gate.
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
  const kfd = (deliverable?.kfdTable ?? []) as KfdRow[];

  // Verdict resolver for a finding whose own verdict column is null (older runs):
  // inherit the KFD row that cites it, else likes→double_down / dislikes→fix.
  const verdictByKey = new Map<string, string>();
  for (const row of Array.isArray(kfd) ? kfd : []) {
    for (const raw of row.sourceFindingKeys ?? []) {
      verdictByKey.set(raw, row.verdict);
      const bare = raw.includes("/") ? raw.split("/").pop()! : raw;
      if (!verdictByKey.has(bare)) verdictByKey.set(bare, row.verdict);
    }
  }

  // Human-curated subset: convert ONLY the findings flagged "Add to ticket"
  // (this is also the only path by which human-authored findings — which never
  // enter the KFD table — become tickets). Flagging is the sole convert trigger;
  // with nothing flagged there is nothing to draft.
  const selectedRows = await db
    .select()
    .from(findings)
    .where(and(eq(findings.runId, runId), eq(findings.selectedForTicket, true)))
    .orderBy(asc(findings.createdAt));
  if (selectedRows.length === 0) return null;

  const draft = draftTicketsFromFindings(
    selectedRows.map((f) => ({
      key: f.key,
      persona: f.persona,
      kind: f.kind as "like" | "dislike",
      title: f.title,
      customerPain: f.customerPain,
      rootCause: f.rootCause,
      effort: f.effort,
      firstAction: f.firstAction,
      detail: f.detail,
      verdict: (f.verdict ??
        verdictByKey.get(`${f.persona}/${f.key}`) ??
        verdictByKey.get(f.key) ??
        (f.kind === "like" ? "double_down" : "fix")) as KfdVerdict,
    })),
    { runId, generatedAt: new Date().toISOString() },
  );

  const parsed = TicketDraftSchema.safeParse(draft);
  if (!parsed.success) return null;

  await db
    .insert(ticketDrafts)
    .values({ runId, draft: parsed.data })
    .onConflictDoNothing({ target: ticketDrafts.runId });
  return parsed.data;
}

/**
 * Archive the findings that were converted into the given (already-pushed)
 * draft's tickets, keyed off the draft's recorded `sourceFindingKeys` — NOT the
 * live `selectedForTicket` flags. The draft is frozen at first materialization,
 * so a theme flagged or unflagged AFTER that point would drift a flag-based
 * archive (archiving a theme with no Linear ticket, or leaving a converted one
 * active). Keying off the draft archives exactly what was pushed. Idempotent via
 * the `archived = false` guard, so a re-push (or a retried best-effort archive)
 * is a no-op.
 */
export async function archiveConvertedFindings(
  db: Db,
  runId: string,
  draft: TicketDraft,
): Promise<void> {
  const keys = draft.tickets.flatMap((t) => t.sourceFindingKeys ?? []);
  if (keys.length === 0) return;
  // sourceFindingKeys are "persona/key" (findings-based drafts) or a bare "key"
  // (legacy KFD-derived drafts). Match on the pair when the persona is present,
  // else fall back to the bare key within the run.
  const conds = keys.map((raw) => {
    const slash = raw.indexOf("/");
    if (slash > 0) {
      return and(
        eq(findings.persona, raw.slice(0, slash)),
        eq(findings.key, raw.slice(slash + 1)),
      );
    }
    return eq(findings.key, raw);
  });
  await db
    .update(findings)
    .set({ archived: true, archivedReason: "converted" })
    .where(and(eq(findings.runId, runId), eq(findings.archived, false), or(...conds)));
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
