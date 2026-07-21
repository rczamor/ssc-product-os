import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { isRunApproved } from "@/lib/db/queries";
import { ensureTicketDraft, getTicketDraft } from "@/lib/db/tickets";
import { findings } from "@/lib/db/schema";
import { isLinearConfigured } from "@/lib/linear";
import { LinearNotConfiguredError, pushDraftToLinear } from "@/lib/linear-sync";
import { isUuid } from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * GET — read-only preview of whatever draft/push state already exists. Never
 * mutates: materializing the draft is a POST-only action (see the sibling
 * `draft` route), so a GET reached via a plain link/top-level navigation (the
 * session cookie is SameSite=Lax, which rides along on those) can't write
 * anything.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "run not found" }, { status: 404 });

  const db = await getDb();
  const approved = await isRunApproved(id);
  const draft = await getTicketDraft(db, id);
  return NextResponse.json({
    approved,
    linearConfigured: isLinearConfigured(),
    draft: draft?.draft ?? null,
    pushedAt: draft?.pushedAt ?? null,
    pushedIssueIds: draft?.pushedIssueIds ?? [],
  });
}

/**
 * POST — push the approved matrix to Linear. HARD GATE: refuses unless a human
 * `approvals` row exists (isRunApproved). Idempotent: a run already pushed
 * returns its existing issue ids and creates nothing new. Returns 503 (not an
 * error state) when LINEAR_API_KEY is unset — the draft is still prepared.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "run not found" }, { status: 404 });

  const db = await getDb();

  // The one hard gate: no approval, no push.
  if (!(await isRunApproved(id))) {
    return NextResponse.json(
      { error: "run is not approved — approve the matrix before pushing" },
      { status: 403 },
    );
  }

  const draft = await ensureTicketDraft(db, id);
  if (!draft) {
    return NextResponse.json({ error: "no deliverable to draft tickets from" }, { status: 409 });
  }

  if (!isLinearConfigured()) {
    return NextResponse.json(
      {
        error: "LINEAR_API_KEY is not set — the draft is prepared but cannot be pushed",
        draftReady: true,
        ticketCount: draft.tickets.length,
      },
      { status: 503 },
    );
  }

  const existing = await getTicketDraft(db, id);
  const alreadyPushed = Boolean(existing?.pushedAt);
  try {
    const pushed = await pushDraftToLinear(db, id);
    // The flagged themes are now attached to Linear tickets — archive them
    // (reason 'converted') so they drop off the active Plan list. Idempotent:
    // a re-push re-runs this over already-archived rows and changes nothing.
    await db
      .update(findings)
      .set({ archived: true, archivedReason: "converted" })
      .where(
        and(
          eq(findings.runId, id),
          eq(findings.selectedForTicket, true),
          eq(findings.archived, false),
        ),
      );
    return NextResponse.json({ pushed, alreadyPushed, count: pushed.length }, { status: 200 });
  } catch (e) {
    if (e instanceof LinearNotConfiguredError) {
      return NextResponse.json({ error: e.message, draftReady: true }, { status: 503 });
    }
    // Log the real cause server-side; never echo a raw exception message to the client.
    console.error(`Linear push failed for run ${id}:`, e);
    return NextResponse.json({ error: "push failed — see server logs" }, { status: 502 });
  }
}
