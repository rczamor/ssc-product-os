import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getLinearConfig, isLinearConfigured } from "@/lib/linear";
import { removeIssueFromCache, upsertIssueToCache } from "@/lib/linear-sync";
import { verifyLinearSignature, type LinearWebhookEvent } from "@/lib/linear-webhook";

// crypto (signature verification) needs the Node runtime, not the Edge runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /linear/webhook — the inbound half of the two-way Linear sync. Linear
 * calls this whenever an issue changes; we mirror that one issue into
 * linear_cache so the Work screen reflects Linear edits in near-real-time
 * (instead of only on a manual Sync). This endpoint is PUBLIC (Linear has no
 * session cookie), so its trust boundary is the HMAC signature check — an
 * unsigned or wrongly-signed request is rejected before anything is read or
 * written. Non-Issue events, and issues outside the SSC-ProductOS project, are
 * acknowledged (200) but ignored so Linear doesn't retry them.
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!verifyLinearSignature(raw, req.headers.get("linear-signature"), process.env.LINEAR_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let event: LinearWebhookEvent;
  try {
    event = JSON.parse(raw) as LinearWebhookEvent;
  } catch {
    return NextResponse.json({ error: "malformed payload" }, { status: 400 });
  }

  // We only mirror Issue events. Ack the rest so Linear marks them delivered.
  if (event.type !== "Issue" || !event.data?.id) {
    return NextResponse.json({ ok: true, ignored: true });
  }
  const issueId = event.data.id;

  try {
    const db = await getDb();
    const cfg = getLinearConfig();

    // A delete — or an update whose payload already shows the issue is now in a
    // DIFFERENT project (a move OUT of ours) — must be REMOVED from the cache,
    // not just ignored, so no ghost row lingers on the Work board. Both are pure
    // DB deletes, so they work even without a Linear API key.
    if (event.action === "remove") {
      await removeIssueFromCache(db, issueId);
      return NextResponse.json({ ok: true, action: "remove" });
    }
    if (event.data.projectId && event.data.projectId !== cfg.project.id) {
      await removeIssueFromCache(db, issueId);
      return NextResponse.json({ ok: true, ignored: "other-project" });
    }

    // Enriching a create/update upsert needs the API key. If it's unset, ack
    // (don't 5xx) so Linear doesn't hammer retries against a deployment that
    // can't process yet.
    if (!isLinearConfigured()) {
      console.warn("linear webhook received but LINEAR_API_KEY is unset — skipped");
      return NextResponse.json({ ok: true, skipped: "no-api-key" });
    }

    // upsertIssueToCache re-fetches the issue and, if it turns out not to be in
    // our project (payload lacked projectId), deletes the stale row instead.
    const upserted = await upsertIssueToCache(db, issueId);
    return NextResponse.json({ ok: true, action: event.action ?? "update", upserted });
  } catch (e) {
    console.error("linear webhook processing failed:", e);
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }
}
