import { beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@/lib/db";
import { runRequests } from "@/lib/db/schema";
import { claimNext } from "@/runner/poll";

beforeAll(async () => {
  await getDb();
});

describe("queue claim", () => {
  it("returns null on an empty queue", async () => {
    expect(await claimNext()).toBeNull();
  });

  it("claims exactly once under concurrent pollers", async () => {
    const db = await getDb();
    await db.insert(runRequests).values({ note: "only-one", requestedBy: "test" });

    const results = await Promise.all([claimNext(), claimNext(), claimNext()]);
    const claimed = results.filter(Boolean);
    expect(claimed).toHaveLength(1);
    expect((claimed[0] as { note: string }).note).toBe("only-one");
  });

  it("claims oldest-first", async () => {
    const db = await getDb();
    await db.insert(runRequests).values({ note: "first", requestedBy: "test" });
    await db.insert(runRequests).values({ note: "second", requestedBy: "test" });
    const a = (await claimNext()) as { note: string };
    const b = (await claimNext()) as { note: string };
    expect(a.note).toBe("first");
    expect(b.note).toBe("second");
  });
});
