import crypto from "crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { verifyLinearSignature } from "@/lib/linear-webhook";
import { POST as webhookPost } from "@/app/linear/webhook/route";

const SECRET = "test-webhook-secret";
const sign = (body: string, secret = SECRET) =>
  crypto.createHmac("sha256", secret).update(body, "utf8").digest("hex");

describe("verifyLinearSignature", () => {
  const body = JSON.stringify({ action: "update", type: "Issue", data: { id: "abc" } });

  it("accepts a correctly-signed body", () => {
    expect(verifyLinearSignature(body, sign(body), SECRET)).toBe(true);
  });

  it("rejects a wrong signature, a tampered body, and a wrong secret", () => {
    expect(verifyLinearSignature(body, "deadbeef", SECRET)).toBe(false);
    expect(verifyLinearSignature(body + " ", sign(body), SECRET)).toBe(false);
    expect(verifyLinearSignature(body, sign(body, "other-secret"), SECRET)).toBe(false);
  });

  it("fails closed when the secret or signature is missing", () => {
    expect(verifyLinearSignature(body, sign(body), undefined)).toBe(false);
    expect(verifyLinearSignature(body, null, SECRET)).toBe(false);
    expect(verifyLinearSignature(body, "", SECRET)).toBe(false);
  });
});

describe("POST /linear/webhook", () => {
  const req = (body: string, signature?: string) =>
    new NextRequest("http://test.local/linear/webhook", {
      method: "POST",
      headers: signature ? { "linear-signature": signature } : {},
      body,
    });

  let prevSecret: string | undefined;
  let prevKey: string | undefined;
  beforeEach(() => {
    prevSecret = process.env.LINEAR_WEBHOOK_SECRET;
    prevKey = process.env.LINEAR_API_KEY;
    process.env.LINEAR_WEBHOOK_SECRET = SECRET;
    delete process.env.LINEAR_API_KEY; // no live Linear in unit env
  });
  afterEach(() => {
    if (prevSecret === undefined) delete process.env.LINEAR_WEBHOOK_SECRET;
    else process.env.LINEAR_WEBHOOK_SECRET = prevSecret;
    if (prevKey === undefined) delete process.env.LINEAR_API_KEY;
    else process.env.LINEAR_API_KEY = prevKey;
  });

  it("rejects an unsigned request with 401 before doing any work", async () => {
    const body = JSON.stringify({ action: "update", type: "Issue", data: { id: "x" } });
    const res = await webhookPost(req(body)); // no signature header
    expect(res.status).toBe(401);
  });

  it("rejects a wrongly-signed request with 401", async () => {
    const body = JSON.stringify({ action: "update", type: "Issue", data: { id: "x" } });
    const res = await webhookPost(req(body, "not-the-right-signature"));
    expect(res.status).toBe(401);
  });

  it("acks (200) a correctly-signed non-Issue event without processing it", async () => {
    const body = JSON.stringify({ action: "create", type: "Comment", data: { id: "c1" } });
    const res = await webhookPost(req(body, sign(body)));
    expect(res.status).toBe(200);
    expect((await res.json()).ignored).toBe(true);
  });

  it("acks (200) a signed Issue event but skips it when LINEAR_API_KEY is unset", async () => {
    const body = JSON.stringify({ action: "update", type: "Issue", data: { id: "i1" } });
    const res = await webhookPost(req(body, sign(body)));
    expect(res.status).toBe(200);
    expect((await res.json()).skipped).toBe("no-api-key");
  });

  it("removes a cached issue that an update moved OUT of the project (no ghost row)", async () => {
    const { getDb } = await import("@/lib/db");
    const { linearCache } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");
    const db = await getDb();
    await db
      .insert(linearCache)
      .values({ id: "ghost-1", identifier: "TRZ-9", title: "Moved out", stateName: "Todo", stateType: "unstarted" })
      .onConflictDoNothing();

    // An update whose payload shows the issue now belongs to another project.
    const body = JSON.stringify({
      action: "update",
      type: "Issue",
      data: { id: "ghost-1", projectId: "some-other-project-id" },
    });
    const res = await webhookPost(req(body, sign(body)));
    expect(res.status).toBe(200);
    expect((await res.json()).ignored).toBe("other-project");

    const rows = await db.select().from(linearCache).where(eq(linearCache.id, "ghost-1"));
    expect(rows).toHaveLength(0); // the stale row was deleted, not left behind
  });
});
