import { beforeAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { seed } from "@/lib/db/seed";
import { runs } from "@/lib/db/schema";

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

  it("gates the matrix push: no approval before Approve, approval is idempotent", async () => {
    const id = await seededRunId();
    // The hard gate: nothing may push before a human approval exists.
    expect(await isRunApproved(id)).toBe(false);

    const first = await approvePost(jsonReq(`/api/runs/${id}/approve`, "POST"), params(id));
    expect(first.status).toBe(200);
    expect((await first.json()).alreadyApproved).toBe(false);
    expect(await isRunApproved(id)).toBe(true);

    // Approving again is a no-op, not a duplicate.
    const second = await approvePost(jsonReq(`/api/runs/${id}/approve`, "POST"), params(id));
    expect((await second.json()).alreadyApproved).toBe(true);
  });
});
