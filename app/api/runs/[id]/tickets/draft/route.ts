import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { isRunApproved } from "@/lib/db/queries";
import { ensureTicketDraft } from "@/lib/db/tickets";
import { isUuid } from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * POST — materialize (or return the existing) ticket draft for an approved run.
 * This is a DB-only operation (never touches the Linear API) split out from the
 * push route's GET specifically so draft creation is a POST action, never a side
 * effect of a GET — keeping GET /tickets/push a pure read as HTTP semantics (and
 * the SameSite=Lax session cookie) require. No-ops (returns null) pre-approval.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "run not found" }, { status: 404 });

  const db = await getDb();
  if (!(await isRunApproved(id))) {
    return NextResponse.json({ draft: null, approved: false });
  }
  const draft = await ensureTicketDraft(db, id);
  return NextResponse.json({ draft, approved: true });
}
