import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { findings, runs } from "@/lib/db/schema";
import { isUuid } from "@/lib/validation";

export const dynamic = "force-dynamic";

const SelectSchema = z.object({
  findingKey: z.string().min(1).max(120),
  persona: z.string().min(1).max(40),
  selected: z.boolean(),
});

/**
 * POST /api/runs/[id]/findings/select — set a finding's "convert to ticket" flag.
 * The human curates which matrix themes become Linear tickets; when any finding
 * in the run is flagged, the draft converts only the flagged ones (see
 * ensureTicketDraft). Auth is enforced by middleware, so the caller is the admin.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "run not found" }, { status: 404 });

  const parsed = SelectSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid selection", issues: parsed.error.issues }, { status: 400 });
  }

  const db = await getDb();
  const [run] = await db.select({ id: runs.id }).from(runs).where(eq(runs.id, id));
  if (!run) return NextResponse.json({ error: "run not found" }, { status: 404 });

  const updated = await db
    .update(findings)
    .set({ selectedForTicket: parsed.data.selected })
    .where(
      and(
        eq(findings.runId, id),
        eq(findings.key, parsed.data.findingKey),
        eq(findings.persona, parsed.data.persona),
      ),
    )
    .returning({ id: findings.id, selected: findings.selectedForTicket });

  if (updated.length === 0) {
    return NextResponse.json({ error: "finding not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, selected: updated[0].selected });
}
