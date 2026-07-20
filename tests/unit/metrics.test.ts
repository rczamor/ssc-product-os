import { describe, expect, it } from "vitest";
import { loadFeatureTaxonomy, loadMetricsRegistry, buildHealthBoard, buildMetricCards } from "@/lib/metrics";
import { generateMetricObservations } from "@/lib/metric-generator";
import { formatValue } from "@/components/MetricCard";
import {
  GeneratedObservationsSchema,
  PRODUCT_LEVEL_KEY,
  TaxonomyFeatureSchema,
} from "@/lib/schemas/metrics";

describe("feature taxonomy + metrics registry (data files)", () => {
  it("loads and validates, with every health state represented", () => {
    const features = loadFeatureTaxonomy();
    expect(features.length).toBeGreaterThanOrEqual(12);
    expect(features.length).toBeLessThanOrEqual(20);
    const board = buildHealthBoard(features);
    for (const entry of board.entries) {
      expect(entry.count).toBeGreaterThanOrEqual(1);
    }
  });

  it("rejects the 'product' sentinel as a taxonomy feature key", () => {
    // "product" is the sentinel featureKey for product-level metrics; a
    // taxonomy feature reusing it would collide in every Map keyed by
    // featureKey and in metric_observations' unique index.
    const bad = {
      key: PRODUCT_LEVEL_KEY,
      name: "Should be rejected",
      surface: "n/a",
      description: "This key collides with the product-level sentinel.",
      rhythm_class: "daily-ops",
      value_role: "table-stakes",
      health_state: "strategic-growing",
      rationale: "Exercising the schema guard against the reserved key.",
      evidence: "test",
    };
    expect(TaxonomyFeatureSchema.safeParse(bad).success).toBe(false);
  });

  it("registry has exactly the 14 Appendix A metrics, with metric 14 marked derived", () => {
    const registry = loadMetricsRegistry();
    expect(registry).toHaveLength(14);
    const health = registry.find((m) => m.id === 14);
    expect(health?.derived).toBe(true);
  });

  it("every registry relatedFeatureKeys entry resolves to a real taxonomy key", () => {
    // A typo here would silently produce an empty linkedFeatures array on the
    // card with no error signal — this regression test is the error signal.
    const features = loadFeatureTaxonomy();
    const registry = loadMetricsRegistry();
    const keys = new Set(features.map((f) => f.key));
    for (const m of registry) {
      for (const related of m.relatedFeatureKeys ?? []) {
        expect(keys.has(related), `metric ${m.id} references unknown feature key "${related}"`).toBe(true);
      }
    }
  });
});

describe("buildHealthBoard", () => {
  it("detects movers from previousHealthState vs health_state", () => {
    const features = loadFeatureTaxonomy();
    const board = buildHealthBoard(features);
    // The taxonomy deliberately seeds at least one mover to exercise the UI.
    expect(board.movers.length).toBeGreaterThan(0);
    for (const m of board.movers) {
      expect(m.from).not.toBe(m.to);
    }
  });
});

describe("generateMetricObservations", () => {
  const features = loadFeatureTaxonomy();
  const registry = loadMetricsRegistry();

  it("produces schema-valid observations", () => {
    const observations = generateMetricObservations(features, registry);
    expect(GeneratedObservationsSchema.safeParse({ observations }).success).toBe(true);
  });

  it("generates exactly 12 weeks per applicable feature×metric pair", () => {
    const observations = generateMetricObservations(features, registry);
    const weeksFor = (metricId: number, featureKey: string) =>
      observations.filter((o) => o.metricId === metricId && o.featureKey === featureKey).length;
    // score-factors-grade is daily-ops (Engagement metric 2 applies) and has no
    // value_role restriction on metric 1.
    expect(weeksFor(1, "score-factors-grade")).toBe(12);
    expect(weeksFor(2, "score-factors-grade")).toBe(12);
  });

  it("restricts Engagement (metric 2) to daily-ops/weekly-review rhythm classes", () => {
    const observations = generateMetricObservations(features, registry);
    const quarterly = features.find((f) => f.rhythm_class === "quarterly-assessment");
    expect(quarterly).toBeDefined();
    expect(observations.some((o) => o.metricId === 2 && o.featureKey === quarterly!.key)).toBe(false);
  });

  it("restricts Churn Risk Watchlist (11) to retention-driver and Expansion PQLs (12) to expansion-driver", () => {
    const observations = generateMetricObservations(features, registry);
    const tableStakes = features.find((f) => f.value_role === "table-stakes")!;
    expect(observations.some((o) => o.metricId === 11 && o.featureKey === tableStakes.key)).toBe(false);
    expect(observations.some((o) => o.metricId === 12 && o.featureKey === tableStakes.key)).toBe(false);
  });

  it("generates a single product-level series for AI Containment Rate (metric 9)", () => {
    const observations = generateMetricObservations(features, registry);
    const aiRows = observations.filter((o) => o.metricId === 9);
    expect(aiRows).toHaveLength(12);
    expect(aiRows.every((r) => r.featureKey === PRODUCT_LEVEL_KEY)).toBe(true);
  });

  it("trips all 4 spec-required triggers at the most recent week", () => {
    const observations = generateMetricObservations(features, registry);
    const weeks = [...new Set(observations.map((o) => o.weekStart))].sort();
    const latest = weeks[weeks.length - 1];
    const at = (metricId: number, featureKey: string) =>
      observations.find((o) => o.metricId === metricId && o.featureKey === featureKey && o.weekStart === latest);

    // #1 shipped-not-adopted feature, D30 activation <25%.
    const d30 = at(6, "risk-quantification");
    expect(d30?.tripped).toBe(true);
    expect(d30!.value).toBeLessThan(25);

    // #2 legacy-kill candidate, adoption reach <2%.
    const reach = at(1, "notification-center");
    expect(reach?.tripped).toBe(true);
    expect(reach!.value).toBeLessThan(2);

    // #3 critical-to-few feature, low reach + top-decile ARR concentration.
    const lowReach = at(1, "action-plans-remediation");
    const concentration = at(13, "action-plans-remediation");
    expect(lowReach?.tripped).toBe(true);
    expect(lowReach!.value).toBeLessThan(10);
    expect(concentration?.tripped).toBe(true);
    expect(concentration!.value).toBeGreaterThan(70);

    // #4 tier-1 account crossing the renewal watchlist threshold.
    const watchlist = at(11, "report-center");
    expect(watchlist?.tripped).toBe(true);
    expect(watchlist!.value).toBeGreaterThanOrEqual(1);
  });

  it("is deterministic for a given seed (reproducible dataset)", () => {
    const a = generateMetricObservations(features, registry, 7);
    const b = generateMetricObservations(features, registry, 7);
    expect(a).toEqual(b);
  });

  it("applies a renewal-window down-trend on retention-driver features' final 4 weeks", () => {
    const observations = generateMetricObservations(features, registry);
    // vendor-engagement: retention-driver, moderate adoption anchor (valuable-
    // but-hidden, flat trend) so the ~6-18% renewal decay in weeks 8-11 is
    // clearly larger than the ±2-point noise — a robust signal, not a coin flip.
    const series = observations
      .filter((o) => o.metricId === 1 && o.featureKey === "vendor-engagement")
      .sort((a, b) => a.weekStart.localeCompare(b.weekStart))
      .map((o) => o.value);
    expect(series).toHaveLength(12);
    const earlyAvg = series.slice(0, 4).reduce((a, b) => a + b, 0) / 4;
    const renewalWindowAvg = series.slice(8, 12).reduce((a, b) => a + b, 0) / 4;
    expect(renewalWindowAvg).toBeLessThan(earlyAvg);
  });
});

describe("buildMetricCards", () => {
  it("aggregates per-feature observations into one card per metric with tripped examples", () => {
    const features = loadFeatureTaxonomy();
    const registry = loadMetricsRegistry();
    const observations = generateMetricObservations(features, registry);
    const cards = buildMetricCards(observations, registry, features);

    expect(cards).toHaveLength(13); // metric 14 excluded (derived, own health board)
    expect(cards.every((c) => c.series.length === 12)).toBe(true);

    const legacyKillCard = cards.find((c) => c.metric.id === 1)!;
    expect(legacyKillCard.trippedCount).toBeGreaterThan(0);
    expect(
      legacyKillCard.trippedExamples.some((ex) => ex.featureKey === "notification-center"),
    ).toBe(true);
  });

  it("links the product-level AI Containment card to its named feature via relatedFeatureKeys", () => {
    const features = loadFeatureTaxonomy();
    const registry = loadMetricsRegistry();
    const observations = generateMetricObservations(features, registry);
    const cards = buildMetricCards(observations, registry, features);
    const aiCard = cards.find((c) => c.metric.id === 9)!;
    expect(aiCard.linkedFeatures.map((f) => f.key)).toContain("ai-product-ops-workflows");
  });
});

describe("formatValue", () => {
  it("formats by the metric's explicit unit, never by guessing from the value's magnitude", () => {
    // Regression: a count metric (Churn Risk Watchlist) averaging to 0.83
    // accounts previously rendered as "83%" because the old heuristic assumed
    // any non-integer value in [-1,1] was a 0-1 ratio.
    expect(formatValue(0.8333333333, "count")).toBe("1");
    expect(formatValue(0.55, "ratio")).toBe("55%");
    expect(formatValue(37.7, "percent")).toBe("38%");
    expect(formatValue(20.1, "days")).toBe("20.1d");
    expect(formatValue(5.0, "minutes")).toBe("5.0m");
    expect(formatValue(-1.3, "points")).toBe("-1.3");
    expect(formatValue(4.2, "points")).toBe("+4.2");
    expect(formatValue(11.9, "index")).toBe("11.9");
  });
});
