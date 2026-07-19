import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { approvals, runs } from "@/lib/db/schema";
import { isUuid } from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * POST /api/runs/[id]/approve — record the human approval of a run's matrix.
 * This is the SOLE trigger for the Phase-3 matrix→Linear push; nothing else may
 * write an approval. Idempotent: approving an already-approved run returns the
 * existing approval (no duplicate). Auth is enforced by middleware.
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

  const approval =
    inserted ?? (await db.select().from(approvals).where(eq(approvals.runId, id)))[0];

  return NextResponse.json({ approval, alreadyApproved: !inserted }, { status: 200 });
}
