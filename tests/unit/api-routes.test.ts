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
    const res = await loginPost(jsonReq("/api/auth/login", "POST", { password: "wrong" }));
    expect(res.status).toBe(401);
  });

  it("sets the session cookie for the right password", async () => {
    const res = await loginPost(
      jsonReq("/api/auth/login", "POST", { password: process.env.ADMIN_PASSWORD }),
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
