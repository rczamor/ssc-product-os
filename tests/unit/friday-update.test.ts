import { describe, expect, it } from "vitest";
import { buildFridayUpdate } from "@/lib/friday-update";
import { loadFeatureTaxonomy, loadMetricsRegistry } from "@/lib/metrics";
import { generateMetricObservations } from "@/lib/metric-generator";
import { FridayUpdateSchema } from "@/lib/schemas/friday";
import type { WorkIssue } from "@/lib/db/queries";

const NOW = new Date("2026-07-24T00:00:00Z"); // a Friday, midnight UTC so day-diffs are whole numbers

const issue = (over: Partial<WorkIssue>): WorkIssue => ({
  id: over.id ?? "id",
  identifier: over.identifier ?? "TRZ-1",
  title: over.title ?? "title",
  description: over.description ?? null,
  stateName: over.stateName ?? "Todo",
  stateType: over.stateType ?? "unstarted",
  priority: over.priority ?? 0,
  labels: over.labels ?? [],
  parentId: over.parentId ?? null,
  url: over.url ?? null,
  dueDate: over.dueDate ?? null,
  completedAt: over.completedAt ?? null,
});

const features = loadFeatureTaxonomy();
const registry = loadMetricsRegistry();
const observations = generateMetricObservations(features, registry);

describe("buildFridayUpdate", () => {
  it("produces a schema-valid update from an empty board with no findings", () => {
    const update = buildFridayUpdate(
      { issues: [], observations, registry, features, findings: [], reviews: [], runsCount: 0 },
      NOW,
    );
    expect(FridayUpdateSchema.safeParse(update).success).toBe(true);
    expect(update.shipped).toEqual([]);
    expect(update.slipped).toEqual([]);
    expect(update.velocity).toMatch(/No Linear board synced yet/);
    expect(update.customerImpact).toMatch(/No customer-facing tickets shipped/);
    expect(update.risks.length).toBeGreaterThan(0);
  });

  it("windowStart/windowEnd bracket exactly the trailing 7 days ending 'now'", () => {
    const update = buildFridayUpdate(
      { issues: [], observations, registry, features, findings: [], reviews: [], runsCount: 0 },
      NOW,
    );
    expect(update.windowEnd).toBe("2026-07-24");
    expect(update.windowStart).toBe("2026-07-17");
  });

  it("counts an issue completed within the window as shipped, and outside it as not", () => {
    const inWindow = issue({
      id: "a",
      identifier: "TRZ-100",
      title: "Shipped this week",
      stateType: "completed",
      completedAt: "2026-07-22T00:00:00Z",
    });
    const beforeWindow = issue({
      id: "b",
      identifier: "TRZ-101",
      title: "Shipped last month",
      stateType: "completed",
      completedAt: "2026-06-01T00:00:00Z",
    });
    const update = buildFridayUpdate(
      { issues: [inWindow, beforeWindow], observations, registry, features, findings: [], reviews: [], runsCount: 0 },
      NOW,
    );
    expect(update.shipped.map((s) => s.identifier)).toEqual(["TRZ-100"]);
  });

  it("counts a past-due, not-Done issue as slipped, but not a completed or canceled one", () => {
    const late = issue({ id: "a", identifier: "TRZ-200", stateType: "started", dueDate: "2026-07-10" });
    const doneButLate = issue({
      id: "b",
      identifier: "TRZ-201",
      stateType: "completed",
      dueDate: "2026-07-10",
      completedAt: "2026-07-20T00:00:00Z",
    });
    const canceledLate = issue({ id: "c", identifier: "TRZ-202", stateType: "canceled", dueDate: "2026-07-10" });
    const notYetDue = issue({ id: "d", identifier: "TRZ-203", stateType: "started", dueDate: "2026-07-30" });

    const update = buildFridayUpdate(
      {
        issues: [late, doneButLate, canceledLate, notYetDue],
        observations,
        registry,
        features,
        findings: [],
        reviews: [],
        runsCount: 0,
      },
      NOW,
    );
    expect(update.slipped.map((s) => s.identifier)).toEqual(["TRZ-200"]);
    expect(update.slipped[0].daysLate).toBe(14);
    expect(update.risks.some((r) => /past due/.test(r))).toBe(true);
  });

  it("extracts the embedded customer-pain line from a shipped external (matrix) ticket", () => {
    const shipped = issue({
      id: "a",
      identifier: "TRZ-300",
      title: "Fix: dispute flow",
      stateType: "completed",
      completedAt: "2026-07-23T00:00:00Z",
      labels: ["track:external", "origin:matrix"],
      description: "**From the approved platform-review matrix (fix).**\n\n**Customer pain:** QBRs derail into attribution disputes.\n\n**Root cause:** workflow",
    });
    const update = buildFridayUpdate(
      { issues: [shipped], observations, registry, features, findings: [], reviews: [], runsCount: 0 },
      NOW,
    );
    expect(update.customerImpact).toMatch(/Fix: dispute flow/);
    expect(update.customerImpact).toMatch(/QBRs derail into attribution disputes/);
  });

  it("computes AI-usage agree-rate identically to lib/reviews.computeAccuracy", () => {
    const findings = [
      { key: "a", persona: "ciso", origin: "agent", kind: "dislike", title: "t", customerPain: "p", severity: 3, specificityScore: 4, actionabilityScore: 5 },
    ];
    const reviews = [{ findingKey: "a", persona: "ciso", reviewerType: "human", verdict: "up" }];
    const update = buildFridayUpdate(
      { issues: [], observations, registry, features, findings, reviews, runsCount: 3 },
      NOW,
    );
    expect(update.aiUsage.agreeRatePercent).toBe(100);
    expect(update.aiUsage.workflowsRunCount).toBe(3);
  });

  it("is deterministic for identical inputs and a fixed 'now'", () => {
    const input = { issues: [], observations, registry, features, findings: [], reviews: [], runsCount: 1 };
    const a = buildFridayUpdate(input, NOW);
    const b = buildFridayUpdate(input, NOW);
    expect(a).toEqual(b);
  });

  it("never reports a rising 'higher is worse' metric (e.g. Churn Risk Watchlist) as the one win", () => {
    // Regression: a naive "value went up" check would call this an improvement.
    // Metric 11 (Churn Risk Watchlist) is worse when it goes UP — a rising count
    // of at-risk accounts is a decline, never a win. Metric 1 (Feature Adoption
    // Rate) is worse when it goes DOWN, so its rise here is the genuine win.
    const synthetic = [
      { metricId: 11, featureKey: "attribution-disputes", weekStart: "2026-06-01", value: 1, tripped: false, triggerText: null },
      { metricId: 11, featureKey: "attribution-disputes", weekStart: "2026-06-08", value: 5, tripped: false, triggerText: null },
      { metricId: 1, featureKey: "score-factors-grade", weekStart: "2026-06-01", value: 40, tripped: false, triggerText: null },
      { metricId: 1, featureKey: "score-factors-grade", weekStart: "2026-06-08", value: 90, tripped: false, triggerText: null },
    ];
    const update = buildFridayUpdate(
      { issues: [], observations: synthetic, registry, features, findings: [], reviews: [], runsCount: 0 },
      NOW,
    );
    expect(update.oneWin).toMatch(/Feature Adoption Rate/);
    expect(update.oneWin).not.toMatch(/Churn Risk Watchlist/);
  });

  it("falls back to a true, generic win when no metric improved and nothing shipped", () => {
    // A flat series (no metric can show improvement) with no shipped issues.
    const flatObservations = observations.map((o) => ({ ...o, value: 1 }));
    const update = buildFridayUpdate(
      { issues: [], observations: flatObservations, registry, features, findings: [], reviews: [], runsCount: 0 },
      NOW,
    );
    expect(update.oneWin.length).toBeGreaterThan(10);
    expect(update.oneWin).toMatch(/review-gate loop/);
  });
});
