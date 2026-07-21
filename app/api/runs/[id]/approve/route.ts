import { NextRequest, NextResponse } from "next/server";
import { and, eq, or } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { approvals, findings, reviews, runs } from "@/lib/db/schema";
import { isUuid } from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * POST /api/runs/[id]/approve — record the human approval of a run's matrix.
 * This is the SOLE trigger for the Phase-3 matrix→Linear push; nothing else may
 * write an approval. Idempotent: approving an already-approved run returns the
 * existing approval (no duplicate). Auth is enforced by middleware.
 *
 * On approval it also archives the themes the human rejected: any finding with a
 * human down-vote that was NOT flagged "Add to ticket" is set archived (reason
 * 'rejected') so it drops off the active Plan list. Flagged themes are archived
 * separately — as 'converted' — only once they're actually pushed to Linear.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "run not found" }, { status: 404 });

  const db = await getDb();
  const [run] = await db.select({ id: runs.id }).from(runs).where(eq(runs.id, id));
  if (!run) return NextResponse.json({ error: "run not found" }, { status: 404 });

  const approvedBy = process.env.ADMIN_EMAIL?.trim() || "admin";
  const [inserted] = await db
    .insert(approvals)
    .values({ runId: id, approvedBy })
    .onConflictDoNothing({ target: approvals.runId })
    .returning();

  // Archive downvoted-and-not-flagged themes: they were reviewed as inaccurate
  // and aren't converting to a ticket, so they leave the active list. Flagged
  // themes stay active until their push archives them as 'converted'.
  const downvotes = await db
    .select({ findingKey: reviews.findingKey, persona: reviews.persona })
    .from(reviews)
    .where(
      and(eq(reviews.runId, id), eq(reviews.reviewerType, "human"), eq(reviews.verdict, "down")),
    );
  if (downvotes.length > 0) {
    const match = downvotes.map((d) =>
      and(eq(findings.key, d.findingKey), eq(findings.persona, d.persona)),
    );
    await db
      .update(findings)
      .set({ archived: true, archivedReason: "rejected" })
      .where(
        and(
          eq(findings.runId, id),
          eq(findings.selectedForTicket, false),
          eq(findings.archived, false),
          or(...match),
        ),
      );
  }

  const approval =
    inserted ?? (await db.select().from(approvals).where(eq(approvals.runId, id)))[0];

  return NextResponse.json({ approval, alreadyApproved: !inserted }, { status: 200 });
}
