import { describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

/**
 * pushDraftToLinear talks to the real @linear/sdk, which needs a live
 * LINEAR_API_KEY this test environment doesn't have. lib/linear-sync.test.ts
 * already exercises the DB-level claim race (pushed_at IS NULL) against real
 * PGlite; this file exercises the OTHER idempotency guarantee spec calls out
 * explicitly — "re-approve → no new Linear issues" — by mocking the Linear
 * client so pushDraftToLinear's actual createIssue-skip-already-pushed logic
 * runs for real, just against a fake wire.
 */
const createIssueCalls: Array<{ title: string; parentId?: string }> = [];
let nextIssueId = 0;

vi.mock("@/lib/linear", () => ({
  isLinearConfigured: () => true,
  getLinearConfig: () => ({
    team: { id: "team-1", key: "TRZ", name: "Test Team" },
    project: { id: "project-1", name: "Test Project", url: "https://linear.app/test" },
    labels: { "track:external": "label-external", "origin:matrix": "label-matrix" },
    states: { Done: "state-done", Todo: "state-todo" },
    priorities: { urgent: 1, high: 2, medium: 3, low: 4 },
    day0: "2026-07-20",
    buildEpics: {},
  }),
  labelId: (name: string) => `label-${name}`,
  stateId: (name: string) => `state-${name}`,
  getLinearClient: () => ({
    createIssue: async (input: { title: string; parentId?: string }) => {
      createIssueCalls.push({ title: input.title, parentId: input.parentId });
      const id = `issue-${++nextIssueId}`;
      return { issue: Promise.resolve({ id, identifier: `TRZ-${nextIssueId}`, url: `https://linear.app/test/${id}` }) };
    },
  }),
}));

describe("pushDraftToLinear (push idempotency)", () => {
  it("re-pushing an already-pushed draft creates no new Linear issues", async () => {
    const { getDb } = await import("@/lib/db");
    const { runs, ticketDrafts } = await import("@/lib/db/schema");
    const { draftTicketsFromDeliverable } = await import("@/lib/tickets");
    const { pushDraftToLinear } = await import("@/lib/linear-sync");

    const db = await getDb();
    const [run] = await db
      .insert(runs)
      .values({ status: "completed", trigger: "slash", personas: ["ciso"] })
      .returning();

    const draft = draftTicketsFromDeliverable([
      {
        item: "Idempotency test fix",
        verdict: "fix",
        customerPain: "Pain that is long enough to satisfy the schema minimum.",
        personas: ["ciso"],
        rootCause: "ux",
        effort: "M",
        firstAction: "Do the first action for the idempotency test.",
        sourceFindingKeys: [],
      },
      {
        item: "Idempotency test kill",
        verdict: "kill",
        customerPain: "Pain that is long enough to satisfy the schema minimum.",
        personas: ["vrm"],
        rootCause: "workflow",
        effort: "S",
        firstAction: "n/a",
        sourceFindingKeys: [],
      },
    ]);
    await db.insert(ticketDrafts).values({ runId: run.id, draft });

    const firstPush = await pushDraftToLinear(db, run.id);
    // fix -> 1 parent + 3 sub-issues (firstAction + acceptance + metric); kill -> 1 parent, no subs.
    expect(firstPush).toHaveLength(2);
    const firstCallCount = createIssueCalls.length;
    expect(firstCallCount).toBeGreaterThan(2); // parents + the fix epic's sub-issues

    const secondPush = await pushDraftToLinear(db, run.id);
    expect(createIssueCalls.length).toBe(firstCallCount); // no new issues created
    expect(secondPush).toEqual(firstPush); // identical result returned

    const [row] = await db.select().from(ticketDrafts).where(eq(ticketDrafts.runId, run.id));
    expect(row.pushedAt).not.toBeNull();
  });

  it("resumes a partially-failed push: only the still-missing ticket gets created", async () => {
    const { getDb } = await import("@/lib/db");
    const { runs, ticketDrafts } = await import("@/lib/db/schema");
    const { draftTicketsFromDeliverable } = await import("@/lib/tickets");
    const { pushDraftToLinear } = await import("@/lib/linear-sync");

    const db = await getDb();
    const [run] = await db
      .insert(runs)
      .values({ status: "completed", trigger: "slash", personas: ["ciso"] })
      .returning();

    const draft = draftTicketsFromDeliverable([
      {
        item: "Resume test kill A",
        verdict: "kill",
        customerPain: "Pain that is long enough to satisfy the schema minimum.",
        personas: ["ciso"],
        rootCause: "ux",
        effort: "S",
        firstAction: "n/a",
        sourceFindingKeys: [],
      },
      {
        item: "Resume test kill B",
        verdict: "kill",
        customerPain: "Pain that is long enough to satisfy the schema minimum.",
        personas: ["ciso"],
        rootCause: "ux",
        effort: "S",
        firstAction: "n/a",
        sourceFindingKeys: [],
      },
    ]);
    // Simulate a prior attempt that created ticket A's issue, then died before
    // finishing and before the claim was released — pushedAt IS NULL again,
    // as pushDraftToLinear's catch path leaves it, but ticket A is already recorded.
    const fakeAlreadyPushed = [
      { key: draft.tickets[0].key, issueId: "issue-preexisting", identifier: "TRZ-999", url: "https://linear.app/test/issue-preexisting", subIssueIds: [] },
    ];
    await db.insert(ticketDrafts).values({ runId: run.id, draft, pushedIssueIds: fakeAlreadyPushed });

    const before = createIssueCalls.length;
    const pushed = await pushDraftToLinear(db, run.id);
    expect(pushed).toHaveLength(2);
    expect(pushed[0]).toEqual(fakeAlreadyPushed[0]); // untouched
    expect(createIssueCalls.length).toBe(before + 1); // only ticket B's issue was created
  });
});
