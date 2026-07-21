import { describe, expect, it } from "vitest";
import { draftTicketsFromDeliverable } from "@/lib/tickets";
import { TicketDraftSchema } from "@/lib/schemas/ticket";
import type { KfdRow } from "@/lib/schemas/findings";

const row = (over: Partial<KfdRow>): KfdRow => ({
  item: "Factor drill-down prioritization",
  verdict: "fix",
  customerPain: "I can see issues but not which three to fix first each week.",
  personas: ["ciso"],
  rootCause: "ux",
  effort: "M",
  firstAction: "Add a top-3 score drivers summary to each factor page.",
  sourceFindingKeys: ["factor-drilldown"],
  ...over,
});

describe("draftTicketsFromDeliverable", () => {
  it("maps fix/double-down to epics and kill to a CCB decision", () => {
    const draft = draftTicketsFromDeliverable([
      row({ verdict: "fix", item: "Factor prioritization" }),
      row({ verdict: "double_down", item: "Portfolio triage view", effort: "S" }),
      row({ verdict: "kill", item: "Legacy PDF export", personas: ["gtm_cs"] }),
    ]);
    // Whole draft validates against the contract.
    expect(TicketDraftSchema.safeParse(draft).success).toBe(true);

    const types = draft.tickets.map((t) => t.type);
    expect(types).toEqual(["epic", "epic", "decision"]);

    const fix = draft.tickets[0];
    if (fix.type !== "epic") throw new Error("expected epic");
    // firstAction is the first sub-issue; 3 sub-issues total.
    expect(fix.subIssues).toHaveLength(3);
    expect(fix.subIssues[0].description).toContain("top-3 score drivers");
    expect(fix.labels).toContain("track:external");
    expect(fix.labels).toContain("origin:matrix");
    // Effort M → week-2 phase.
    expect(fix.phase).toBe("phase:week-2");

    const dd = draft.tickets[1];
    expect(dd.priority).toBe(2); // double-down → High
    expect(dd.phase).toBe("phase:week-1"); // effort S → week-1

    const kill = draft.tickets[2];
    expect(kill.type).toBe("decision");
    expect(kill.title.toLowerCase()).toContain("kill");
  });

  it("embeds Requirements + Acceptance criteria into every ticket description", () => {
    const draft = draftTicketsFromDeliverable([
      row({ verdict: "fix", item: "Factor prioritization" }),
      row({ verdict: "double_down", item: "Portfolio triage view", effort: "S" }),
      row({ verdict: "kill", item: "Legacy PDF export", personas: ["gtm_cs"] }),
    ]);
    const [fix, dd, kill] = draft.tickets;
    // Every ticket carries the two authored sections + a checklist of criteria.
    for (const t of [fix, dd, kill]) {
      expect(t.description).toContain("### Requirements");
      expect(t.description).toContain("### Acceptance criteria");
      expect(t.description).toContain("- [ ]");
    }
    // Fix speaks to resolving the root cause; double-down to extending what works.
    expect(fix.description.toLowerCase()).toContain("root cause");
    expect(dd.description.toLowerCase()).toContain("extend");
    // Kill decision requires evidence + a recorded CCB decision.
    expect(kill.description).toContain("CCB");
    // Still within TicketSchema's bounds.
    expect(TicketDraftSchema.safeParse(draft).success).toBe(true);
  });

  it("produces unique keys even for duplicate item names", () => {
    const draft = draftTicketsFromDeliverable([
      row({ verdict: "fix", item: "Same title" }),
      row({ verdict: "fix", item: "Same title" }),
    ]);
    const keys = draft.tickets.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("clips oversized KFD text so the result always satisfies TicketSchema's bounds", () => {
    // ensureTicketDraft reads kfdTable via a raw cast, not re-validated by
    // KfdRowSchema, so a deliverable with unbounded text must never crash the
    // drafter — every produced field must stay within TicketSchema's caps.
    const huge = "x".repeat(5000);
    const draft = draftTicketsFromDeliverable([
      row({ verdict: "fix", item: huge, customerPain: huge, firstAction: huge }),
      row({ verdict: "kill", item: huge, customerPain: huge }),
    ]);
    expect(TicketDraftSchema.safeParse(draft).success).toBe(true);
    for (const t of draft.tickets) {
      expect(t.title.length).toBeLessThanOrEqual(200);
      expect(t.description.length).toBeLessThanOrEqual(6000);
      if (t.type === "epic") {
        expect(t.customerPain.length).toBeLessThanOrEqual(2000);
        for (const sub of t.subIssues) {
          expect(sub.title.length).toBeLessThanOrEqual(200);
          expect(sub.description.length).toBeLessThanOrEqual(2000);
        }
      }
    }
  });
});
