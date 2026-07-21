import { describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { deliverables, findings, runs } from "@/lib/db/schema";
import { ensureTicketDraft } from "@/lib/db/tickets";
import { draftTicketsFromFindings } from "@/lib/tickets";

const PAIN = "Pain that is long enough to satisfy the schema minimum length.";

describe("draftTicketsFromFindings", () => {
  it("maps a dislike→kill to a CCB decision and a like→double_down to an epic (with defaults)", () => {
    const draft = draftTicketsFromFindings([
      {
        key: "k1",
        persona: "vrm",
        kind: "dislike",
        title: "Vendor Detection is a report",
        customerPain: PAIN,
        rootCause: "workflow",
        effort: "M",
        firstAction: "Move it into config",
        detail: "detail",
        verdict: "kill",
      },
      {
        key: "k2",
        persona: "ciso",
        kind: "like",
        title: "Getting Started guides next actions",
        customerPain: null, // a like has no customer pain → falls back to detail
        rootCause: null,
        effort: null,
        firstAction: null,
        detail: "It turns a static report into a to-do list, which is long enough.",
        verdict: "double_down",
      },
    ]);

    expect(draft.tickets.map((t) => t.type).sort()).toEqual(["decision", "epic"]);
    const epic = draft.tickets.find((t) => t.type === "epic")!;
    expect(epic.title).toContain("Double down");
    // The like still produces a well-formed epic with the standard 3 sub-issues.
    expect(epic.type === "epic" && epic.subIssues.length).toBe(3);
  });

  it("gives each double-down an item-specific first sub-issue (no identical 'protect and extend' duplicates)", () => {
    const draft = draftTicketsFromFindings([
      { key: "a", persona: "ciso", kind: "like", title: "Alpha capability", customerPain: null, rootCause: null, effort: null, firstAction: null, detail: "A detail that is comfortably long enough here.", verdict: "double_down" },
      { key: "b", persona: "vrm", kind: "like", title: "Beta capability", customerPain: null, rootCause: null, effort: null, firstAction: null, detail: "Another detail that is long enough to pass.", verdict: "double_down" },
    ]);
    const firstSubs = draft.tickets.map((t) => (t.type === "epic" ? t.subIssues[0].title : ""));
    expect(firstSubs[0]).not.toBe(firstSubs[1]); // the bug was: both were identical
    expect(firstSubs[0]).toContain("Alpha capability");
    expect(firstSubs[1]).toContain("Beta capability");
  });
});

describe("ensureTicketDraft honors the Add-to-ticket selection", () => {
  const kfd = [
    {
      item: "Agent fix A",
      verdict: "fix",
      customerPain: PAIN,
      personas: ["ciso"],
      rootCause: "ux",
      effort: "M",
      firstAction: "Do A first.",
      sourceFindingKeys: ["ciso/agent-a"],
    },
    {
      item: "Agent kill B",
      verdict: "kill",
      customerPain: PAIN,
      personas: ["vrm"],
      rootCause: "workflow",
      effort: "S",
      firstAction: "n/a",
      sourceFindingKeys: ["vrm/agent-b"],
    },
  ];

  async function seedRun() {
    const db = await getDb();
    const [run] = await db
      .insert(runs)
      .values({ status: "completed", trigger: "slash", personas: ["ciso"] })
      .returning();
    await db
      .insert(deliverables)
      .values({ runId: run.id, likes: [], dislikes: [], kfdTable: kfd, markdown: "x" });
    // Two agent findings that ARE in the KFD table, plus a human finding that is NOT.
    await db.insert(findings).values([
      { runId: run.id, persona: "ciso", key: "agent-a", kind: "dislike", title: "Agent fix A", detail: "d", customerPain: PAIN, rootCause: "ux", effort: "M", firstAction: "Do A.", verdict: "fix", origin: "agent", raw: {} },
      { runId: run.id, persona: "vrm", key: "agent-b", kind: "dislike", title: "Agent kill B", detail: "d", customerPain: PAIN, rootCause: "workflow", effort: "S", firstAction: "n/a", verdict: "kill", origin: "agent", raw: {} },
      { runId: run.id, persona: "gtm_cs", key: "human-c", kind: "dislike", title: "Human fix C", detail: "d", customerPain: PAIN, rootCause: "packaging", effort: "M", firstAction: "Split the profile from the Trust Center.", verdict: "fix", origin: "human", raw: {} },
    ]);
    return run.id;
  }

  it("with no selection, drafts nothing (flagging is the sole convert trigger)", async () => {
    const db = await getDb();
    const runId = await seedRun();
    // The full-matrix fallback was removed: nothing flagged → nothing to draft.
    const draft = await ensureTicketDraft(db, runId);
    expect(draft).toBeNull();
  });

  it("with a human finding flagged, drafts ONLY the selected one (even though it's not in the KFD table)", async () => {
    const db = await getDb();
    const runId = await seedRun();
    await db
      .update(findings)
      .set({ selectedForTicket: true })
      .where(and(eq(findings.runId, runId), eq(findings.key, "human-c")));

    const draft = await ensureTicketDraft(db, runId);
    expect(draft?.tickets).toHaveLength(1);
    expect(draft?.tickets[0].title).toContain("Human fix C");
  });
});
