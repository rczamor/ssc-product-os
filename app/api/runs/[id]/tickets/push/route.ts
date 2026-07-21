import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { isRunApproved } from "@/lib/db/queries";
import { archiveConvertedFindings, ensureTicketDraft, getTicketDraft } from "@/lib/db/tickets";
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

  let pushed;
  try {
    pushed = await pushDraftToLinear(db, id);
  } catch (e) {
    if (e instanceof LinearNotConfiguredError) {
      return NextResponse.json({ error: e.message, draftReady: true }, { status: 503 });
    }
    // Log the real cause server-side; never echo a raw exception message to the client.
    console.error(`Linear push failed for run ${id}:`, e);
    return NextResponse.json({ error: "push failed — see server logs" }, { status: 502 });
  }

  // The push succeeded — the converted themes are now attached to Linear tickets,
  // so archive them (reason 'converted') off the active Plan list. Keyed off the
  // frozen draft that was actually pushed, not the live "Add to ticket" flags, so
  // a flag toggled after the draft was materialized can't archive a theme with no
  // ticket (or leave a converted one active). Best-effort: a DB failure here must
  // never turn an already-completed Linear push into a 502 — the archive is
  // idempotent and re-runs cleanly on the next push.
  try {
    await archiveConvertedFindings(db, id, draft);
  } catch (e) {
    console.error(`archive-after-push failed for run ${id}:`, e);
  }

  return NextResponse.json({ pushed, alreadyPushed, count: pushed.length }, { status: 200 });
}
