import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { findings, reviews, runs } from "@/lib/db/schema";
import { isUuid } from "@/lib/validation";
import { CreateReviewSchema } from "@/lib/schemas/review";

export const dynamic = "force-dynamic";

/** The admin identity a human review/approval is attributed to (single-admin app). */
function reviewerName(): string {
  return process.env.ADMIN_EMAIL?.trim() || "admin";
}

/**
 * POST /api/runs/[id]/reviews — record a human up/down vote (+ comment) on a
 * finding. Upserts on (run, finding, persona, reviewer): re-voting replaces the
 * prior vote. Auth is enforced by middleware, so the caller is the admin.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "run not found" }, { status: 404 });

  const parsed = CreateReviewSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid review", issues: parsed.error.issues }, { status: 400 });
  }

  const db = await getDb();
  const [run] = await db.select({ id: runs.id }).from(runs).where(eq(runs.id, id));
  if (!run) return NextResponse.json({ error: "run not found" }, { status: 404 });

  // The finding must exist in this run so a vote can't be attributed to nothing.
  const [finding] = await db
    .select({ id: findings.id })
    .from(findings)
    .where(
      and(
        eq(findings.runId, id),
        eq(findings.key, parsed.data.findingKey),
        eq(findings.persona, parsed.data.persona),
      ),
    );
  if (!finding) return NextResponse.json({ error: "finding not found" }, { status: 404 });

  const [row] = await db
    .insert(reviews)
    .values({
      runId: id,
      findingKey: parsed.data.findingKey,
      persona: parsed.data.persona,
      reviewerType: "human",
      reviewerName: reviewerName(),
      verdict: parsed.data.verdict,
      comment: parsed.data.comment ?? null,
    })
    .onConflictDoUpdate({
      target: [
        reviews.runId,
        reviews.findingKey,
        reviews.persona,
        reviews.reviewerType,
        reviews.reviewerName,
      ],
      // Update the vote in place; keep createdAt as the first-vote time.
      set: { verdict: parsed.data.verdict, comment: parsed.data.comment ?? null },
    })
    .returning();

  return NextResponse.json({ review: row }, { status: 201 });
}
