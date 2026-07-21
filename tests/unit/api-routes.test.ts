import { beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { seed } from "@/lib/db/seed";
import { findings, reviews, runs } from "@/lib/db/schema";

// Route handlers under test (invoked directly against in-memory PGlite).
import { POST as loginPost } from "@/app/api/auth/login/route";
import { GET as runsGet } from "@/app/api/runs/route";
import { GET as runGet } from "@/app/api/runs/[id]/route";
import { GET as requestsGet, POST as requestsPost } from "@/app/api/run-requests/route";
import { PATCH as requestPatch } from "@/app/api/run-requests/[id]/route";
import { GET as screenshotGet } from "@/app/api/screenshots/[id]/route";
import { POST as reviewsPost } from "@/app/api/runs/[id]/reviews/route";
import { POST as humanFindingPost } from "@/app/api/runs/[id]/findings/route";
import { POST as approvePost } from "@/app/api/runs/[id]/approve/route";
import { GET as ticketsPreviewGet, POST as ticketsPushPost } from "@/app/api/runs/[id]/tickets/push/route";
import { POST as ticketsDraftPost } from "@/app/api/runs/[id]/tickets/draft/route";
import { isRunApproved } from "@/lib/db/queries";

function jsonReq(url: string, method: string, body?: unknown): NextRequest {
  return new NextRequest(`http://test.local${url}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });

beforeAll(async () => {
  const db = await getDb();
  await seed(db);
});

describe("POST /api/auth/login", () => {
  it("rejects a wrong password", async () => {
    const res = await loginPost(
      jsonReq("/api/auth/login", "POST", {
        email: process.env.ADMIN_EMAIL,
        password: "wrong",
      }),
    );
    expect(res.status).toBe(401);
  });

  it("rejects a wrong email even with the right password", async () => {
    const res = await loginPost(
      jsonReq("/api/auth/login", "POST", {
        email: "attacker@example.com",
        password: process.env.ADMIN_PASSWORD,
      }),
    );
    expect(res.status).toBe(401);
  });

  it("sets the session cookie for the right email + password", async () => {
    const res = await loginPost(
      jsonReq("/api/auth/login", "POST", {
        email: (process.env.ADMIN_EMAIL ?? "").toUpperCase(), // case-insensitive
        password: process.env.ADMIN_PASSWORD,
      }),
    );
    expect(res.status).toBe(200);
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("ssc_admin=");
    expect(cookie.toLowerCase()).toContain("httponly");
  });

  it("400s on malformed bodies", async () => {
    const res = await loginPost(jsonReq("/api/auth/login", "POST", { nope: 1 }));
    expect(res.status).toBe(400);
  });
});

describe("runs endpoints", () => {
  it("lists runs with finding counts", async () => {
    const res = await runsGet();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.runs.length).toBeGreaterThanOrEqual(1);
    const seeded = body.runs[0];
    expect(seeded.likeCount).toBe(3);
    expect(seeded.dislikeCount).toBe(3);
    expect(seeded.hasDeliverable).toBe(true);
  });

  it("returns full run detail incl. screenshots metadata", async () => {
    const db = await getDb();
    const [run] = await db.select({ id: runs.id }).from(runs);
    const res = await runGet(jsonReq(`/api/runs/${run.id}`, "GET"), params(run.id));
    const body = await res.json();
    expect(body.run.id).toBe(run.id);
    expect(body.personaEvaluations).toHaveLength(3);
    expect(body.findings).toHaveLength(6);
    expect(body.deliverable).not.toBeNull();
    expect(body.screenshots.length).toBeGreaterThanOrEqual(1);
    // Metadata only — no image bytes in the JSON payload.
    expect(body.screenshots[0].data).toBeUndefined();
  });

  it("404s for a missing run", async () => {
    const id = "00000000-0000-4000-8000-000000000000";
    const res = await runGet(jsonReq(`/api/runs/${id}`, "GET"), params(id));
    expect(res.status).toBe(404);
  });

  it("404s (not 500) for a non-UUID id", async () => {
    const res = await runGet(jsonReq("/api/runs/not-a-uuid", "GET"), params("not-a-uuid"));
    expect(res.status).toBe(404);
    const shot = await screenshotGet(
      jsonReq("/api/screenshots/xyz", "GET"),
      params("xyz"),
    );
    expect(shot.status).toBe(404);
    const patch = await requestPatch(
      jsonReq("/api/run-requests/nope", "PATCH", { status: "cancelled" }),
      params("nope"),
    );
    expect(patch.status).toBe(404);
  });
});

describe("screenshots endpoint", () => {
  it("serves image bytes with the right content type", async () => {
    const db = await getDb();
    const [run] = await db.select({ id: runs.id }).from(runs);
    const detail = await (
      await runGet(jsonReq(`/api/runs/${run.id}`, "GET"), params(run.id))
    ).json();
    const shotId = detail.screenshots[0].id;
    const res = await screenshotGet(jsonReq(`/api/screenshots/${shotId}`, "GET"), params(shotId));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.length).toBeGreaterThan(100);
    expect(buf.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8])); // JPEG magic
  });
});

describe("run-requests endpoints", () => {
  it("enqueues, lists, and cancels a request", async () => {
    const createRes = await requestsPost(
      jsonReq("/api/run-requests", "POST", { personas: ["ciso"], note: "test note" }),
    );
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()).runRequest;
    expect(created.status).toBe("queued");
    expect(created.personas).toEqual(["ciso"]);

    const listRes = await requestsGet();
    const list = (await listRes.json()).runRequests;
    expect(list.some((r: { id: string }) => r.id === created.id)).toBe(true);

    const cancelRes = await requestPatch(
      jsonReq(`/api/run-requests/${created.id}`, "PATCH", { status: "cancelled" }),
      params(created.id),
    );
    expect(cancelRes.status).toBe(200);

    // A cancelled request cannot be cancelled again.
    const again = await requestPatch(
      jsonReq(`/api/run-requests/${created.id}`, "PATCH", { status: "cancelled" }),
      params(created.id),
    );
    expect(again.status).toBe(409);
  });

  it("rejects unknown personas", async () => {
    const res = await requestsPost(
      jsonReq("/api/run-requests", "POST", { personas: ["hacker"] }),
    );
    expect(res.status).toBe(400);
  });
});

describe("reviewer layer + approval gate", () => {
  async function seededRunId(): Promise<string> {
    const db = await getDb();
    const [run] = await db.select({ id: runs.id }).from(runs);
    return run.id;
  }

  it("records a human up/down vote and upserts on re-vote", async () => {
    const id = await seededRunId();
    const url = `/api/runs/${id}/reviews`;
    const first = await reviewsPost(
      jsonReq(url, "POST", { findingKey: "board-legible-grade", persona: "ciso", verdict: "up" }),
      params(id),
    );
    expect(first.status).toBe(201);
    expect((await first.json()).review.reviewerType).toBe("human");

    // Re-voting the same finding replaces the prior vote (no duplicate row).
    const second = await reviewsPost(
      jsonReq(url, "POST", {
        findingKey: "board-legible-grade",
        persona: "ciso",
        verdict: "down",
        comment: "changed my mind",
      }),
      params(id),
    );
    expect(second.status).toBe(201);
    const body = (await second.json()).review;
    expect(body.verdict).toBe("down");
    expect(body.comment).toBe("changed my mind");
  });

  it("404s a vote on a finding that isn't in the run", async () => {
    const id = await seededRunId();
    const res = await reviewsPost(
      jsonReq(`/api/runs/${id}/reviews`, "POST", {
        findingKey: "does-not-exist",
        persona: "ciso",
        verdict: "up",
      }),
      params(id),
    );
    expect(res.status).toBe(404);
  });

  it("400s a malformed vote", async () => {
    const id = await seededRunId();
    const res = await reviewsPost(
      jsonReq(`/api/runs/${id}/reviews`, "POST", { findingKey: "x", persona: "ciso", verdict: "sideways" }),
      params(id),
    );
    expect(res.status).toBe(400);
  });

  it("adds a human finding with origin=human and rejects an incomplete dislike", async () => {
    const id = await seededRunId();
    const ok = await humanFindingPost(
      jsonReq(`/api/runs/${id}/findings`, "POST", {
        persona: "vrm",
        kind: "dislike",
        title: "Human-added workflow gap",
        detail: "A reviewer noticed the export step forces a manual reformat every quarter.",
        jtbd: "Produce board-ready reporting without manual rework",
        customerPain: "I rebuild the board deck by hand every single quarter.",
        rootCause: "workflow",
        effort: "M",
        firstAction: "Prototype a board-template export.",
        severity: 3,
      }),
      params(id),
    );
    expect(ok.status).toBe(201);
    expect((await ok.json()).finding.origin).toBe("human");

    // A dislike missing its required fields is rejected by the shared contract.
    const bad = await humanFindingPost(
      jsonReq(`/api/runs/${id}/findings`, "POST", {
        persona: "vrm",
        kind: "dislike",
        title: "Missing required fields",
        detail: "This dislike omits customerPain/rootCause/effort/firstAction/severity entirely.",
        jtbd: "Some job to be done here",
      }),
      params(id),
    );
    expect(bad.status).toBe(400);

    // jtbd is required for parity with agent findings — a like without it 400s.
    const noJtbd = await humanFindingPost(
      jsonReq(`/api/runs/${id}/findings`, "POST", {
        persona: "vrm",
        kind: "like",
        title: "A like without a jtbd",
        detail: "This like omits the jtbd field which the shared contract requires.",
      }),
      params(id),
    );
    expect(noJtbd.status).toBe(400);
  });

  it("gates the matrix push: no approval before Approve, approval is idempotent, no draft materializes pre-approval", async () => {
    const id = await seededRunId();
    // The hard gate: nothing may push before a human approval exists.
    expect(await isRunApproved(id)).toBe(false);

    // Pre-approval: the push route refuses, and previewing does not draft yet.
    const preApprovalPush = await ticketsPushPost(
      jsonReq(`/api/runs/${id}/tickets/push`, "POST"),
      params(id),
    );
    expect(preApprovalPush.status).toBe(403);

    const preview = await ticketsPreviewGet(jsonReq(`/api/runs/${id}/tickets/push`, "GET"), params(id));
    const previewBody = await preview.json();
    expect(previewBody.approved).toBe(false);
    expect(previewBody.draft).toBeNull();

    // GET must never mutate: even calling it pre-approval leaves no draft row.
    const draftAttemptPreApproval = await ticketsDraftPost(
      jsonReq(`/api/runs/${id}/tickets/draft`, "POST"),
      params(id),
    );
    expect((await draftAttemptPreApproval.json()).draft).toBeNull();

    const first = await approvePost(jsonReq(`/api/runs/${id}/approve`, "POST"), params(id));
    expect(first.status).toBe(200);
    expect((await first.json()).alreadyApproved).toBe(false);
    expect(await isRunApproved(id)).toBe(true);

    // Approving again is a no-op, not a duplicate.
    const second = await approvePost(jsonReq(`/api/runs/${id}/approve`, "POST"), params(id));
    expect((await second.json()).alreadyApproved).toBe(true);

    // Post-approval, GET alone still shows no draft — materializing it is a
    // POST-only action (never a GET side effect).
    const beforeDraftPost = await ticketsPreviewGet(
      jsonReq(`/api/runs/${id}/tickets/push`, "GET"),
      params(id),
    );
    expect((await beforeDraftPost.json()).draft).toBeNull();

    // Flagging is the sole convert trigger now — with nothing flagged a draft
    // materializes to null. Flag one theme so the draft has something to convert.
    const db = await getDb();
    await db
      .update(findings)
      .set({ selectedForTicket: true })
      .where(and(eq(findings.runId, id), eq(findings.key, "factor-drilldown-so-what")));

    // The dedicated draft POST materializes it from the flagged theme.
    const draftPost = await ticketsDraftPost(jsonReq(`/api/runs/${id}/tickets/draft`, "POST"), params(id));
    const draftBody = await draftPost.json();
    expect(draftBody.approved).toBe(true);
    expect(draftBody.draft.tickets.length).toBeGreaterThan(0);

    // Now GET reflects the materialized draft.
    const afterApproval = await ticketsPreviewGet(
      jsonReq(`/api/runs/${id}/tickets/push`, "GET"),
      params(id),
    );
    const afterBody = await afterApproval.json();
    expect(afterBody.approved).toBe(true);
    expect(afterBody.draft.tickets.length).toBeGreaterThan(0);

    // No LINEAR_API_KEY in the test env, so the push is refused with 503, not silently no-op'd.
    const push = await ticketsPushPost(jsonReq(`/api/runs/${id}/tickets/push`, "POST"), params(id));
    expect(push.status).toBe(503);
    expect((await push.json()).draftReady).toBe(true);
  });

  it("archives downvoted-and-unflagged themes on approve (reason 'rejected'); flagged themes stay active", async () => {
    const db = await getDb();
    const [run] = await db
      .insert(runs)
      .values({ status: "completed", trigger: "slash", personas: ["ciso"] })
      .returning();
    const PAIN = "Pain that is long enough to satisfy the schema minimum length.";
    await db.insert(findings).values([
      { runId: run.id, persona: "ciso", key: "rej", kind: "dislike", title: "Rejected theme", detail: "d", customerPain: PAIN, rootCause: "ux", effort: "M", firstAction: "x", verdict: "fix", origin: "agent", raw: {} },
      { runId: run.id, persona: "ciso", key: "flag", kind: "dislike", title: "Flagged theme", detail: "d", customerPain: PAIN, rootCause: "ux", effort: "M", firstAction: "x", verdict: "fix", origin: "agent", selectedForTicket: true, raw: {} },
      { runId: run.id, persona: "ciso", key: "keep", kind: "like", title: "Untouched theme", detail: "d", jtbd: "j", origin: "agent", raw: {} },
    ]);
    // Down-vote the first AND the flagged one — the flag must win, keeping it active.
    await db.insert(reviews).values([
      { runId: run.id, findingKey: "rej", persona: "ciso", reviewerType: "human", verdict: "down" },
      { runId: run.id, findingKey: "flag", persona: "ciso", reviewerType: "human", verdict: "down" },
    ]);

    const res = await approvePost(jsonReq(`/api/runs/${run.id}/approve`, "POST"), params(run.id));
    expect(res.status).toBe(200);

    const rows = await db.select().from(findings).where(eq(findings.runId, run.id));
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r]));
    // Downvoted + not flagged → archived as rejected.
    expect(byKey.rej.archived).toBe(true);
    expect(byKey.rej.archivedReason).toBe("rejected");
    // Downvoted BUT flagged → flag wins; stays active to convert on push.
    expect(byKey.flag.archived).toBe(false);
    // No down-vote → untouched.
    expect(byKey.keep.archived).toBe(false);
  });
});
