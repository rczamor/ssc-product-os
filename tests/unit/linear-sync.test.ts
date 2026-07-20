import { beforeAll, describe, expect, it } from "vitest";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { seed } from "@/lib/db/seed";
import { runs, ticketDrafts } from "@/lib/db/schema";
import { draftTicketsFromDeliverable } from "@/lib/tickets";

beforeAll(async () => {
  const db = await getDb();
  await seed(db);
});

describe("ticket_drafts push claim (race safety)", () => {
  it("only one of two concurrent claim attempts on the same draft succeeds", async () => {
    const db = await getDb();
    const [run] = await db.select({ id: runs.id }).from(runs);

    const draft = draftTicketsFromDeliverable([
      {
        item: "Race test item",
        verdict: "fix",
        customerPain: "Pain that is long enough to satisfy the schema minimum.",
        personas: ["ciso"],
        rootCause: "ux",
        effort: "M",
        firstAction: "Do the first action for the race test.",
        sourceFindingKeys: [],
      },
    ]);
    await db.insert(ticketDrafts).values({ runId: run.id, draft });

    // This is the exact primitive pushDraftToLinear uses to claim a push:
    // an atomic UPDATE ... WHERE pushed_at IS NULL. Simulate two "concurrent"
    // callers racing for the same draft by issuing the claim twice.
    const claim = () =>
      db
        .update(ticketDrafts)
        .set({ pushedAt: new Date() })
        .where(and(eq(ticketDrafts.runId, run.id), isNull(ticketDrafts.pushedAt)))
        .returning();

    const first = await claim();
    const second = await claim();

    expect(first).toHaveLength(1); // the winner claims the row
    expect(second).toHaveLength(0); // the loser gets nothing — no duplicate push
  });

  it("a released claim (pushedAt reset to null after a failure) can be re-claimed", async () => {
    const db = await getDb();
    const [run] = await db.select({ id: runs.id }).from(runs);
    const draft = draftTicketsFromDeliverable([
      {
        item: "Retry test item",
        verdict: "kill",
        customerPain: "Pain that is long enough to satisfy the schema minimum.",
        personas: ["vrm"],
        rootCause: "workflow",
        effort: "S",
        firstAction: "n/a",
        sourceFindingKeys: [],
      },
    ]);
    await db.insert(ticketDrafts).values({ runId: run.id, draft }).onConflictDoUpdate({
      target: ticketDrafts.runId,
      set: { draft, pushedAt: null, pushedIssueIds: [] },
    });

    const claim = () =>
      db
        .update(ticketDrafts)
        .set({ pushedAt: new Date() })
        .where(and(eq(ticketDrafts.runId, run.id), isNull(ticketDrafts.pushedAt)))
        .returning();

    const first = await claim();
    expect(first).toHaveLength(1);

    // Simulate a failed push: the claim is released (pushDraftToLinear's catch path).
    await db.update(ticketDrafts).set({ pushedAt: null }).where(eq(ticketDrafts.runId, run.id));

    const retry = await claim();
    expect(retry).toHaveLength(1); // released claim is re-claimable, not stuck forever
  });
});
