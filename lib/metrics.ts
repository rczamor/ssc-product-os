import fs from "fs";
import path from "path";
import {
  FeatureTaxonomySchema,
  HEALTH_STATES,
  MetricsRegistrySchema,
  PRODUCT_LEVEL_KEY,
  type HealthState,
  type MetricDefinition,
  type MetricObservation,
  type TaxonomyFeature,
} from "@/lib/schemas/metrics";

/** Loads and validates data/feature-taxonomy.json (server-only, read at request time). */
export function loadFeatureTaxonomy(): TaxonomyFeature[] {
  const file = path.join(process.cwd(), "data", "feature-taxonomy.json");
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  return FeatureTaxonomySchema.parse(raw).features;
}

/** Loads and validates data/metrics-registry.json (the spec's Appendix A). */
export function loadMetricsRegistry(): MetricDefinition[] {
  const file = path.join(process.cwd(), "data", "metrics-registry.json");
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  return MetricsRegistrySchema.parse(raw).metrics;
}

export interface HealthBoardEntry {
  state: HealthState;
  count: number;
  features: TaxonomyFeature[];
}

export interface HealthMover {
  feature: TaxonomyFeature;
  from: HealthState;
  to: HealthState;
}

export interface HealthBoard {
  entries: HealthBoardEntry[];
  movers: HealthMover[];
  totalFeatures: number;
}

/**
 * Metric 14 (Feature Portfolio Health) is DERIVED from the taxonomy's current
 * health_state distribution — it is never a generated observation series.
 * "Movers" are features whose `previousHealthState` differs from their current
 * `health_state` (set directly in the human-edited taxonomy file).
 */
export function buildHealthBoard(features: TaxonomyFeature[]): HealthBoard {
  const entries: HealthBoardEntry[] = HEALTH_STATES.map((state) => ({
    state,
    count: 0,
    features: [],
  }));
  const byState = new Map(entries.map((e) => [e.state, e]));

  for (const f of features) {
    byState.get(f.health_state)!.features.push(f);
    byState.get(f.health_state)!.count += 1;
  }

  const movers: HealthMover[] = features
    .filter((f) => f.previousHealthState && f.previousHealthState !== f.health_state)
    .map((f) => ({ feature: f, from: f.previousHealthState as HealthState, to: f.health_state }));

  return { entries, movers, totalFeatures: features.length };
}

/** Whether a lower or higher value is the "worse" direction for a metric —
 *  used to rank tripped examples so a card surfaces its worst offenders first,
 *  and reused by lib/friday-update.ts to find each metric's genuine trend
 *  direction (so "improvement" isn't hardcoded to any one metric). */
export const WORSE_DIRECTION: Record<number, "lower" | "higher"> = {
  1: "lower", // Feature Adoption Rate
  2: "lower", // Engagement
  3: "higher", // Usage Frequency (days between uses)
  4: "lower", // Task Completion Rate
  5: "higher", // Time on Task
  6: "lower", // Activation Rate (D30)
  7: "higher", // Time to Adoption
  8: "higher", // Friction Index
  9: "lower", // AI Containment Rate
  10: "lower", // Feature NPS
  11: "higher", // Churn Risk Watchlist (more at-risk accounts is worse)
  12: "higher", // Expansion PQLs (a trip is a good signal, but "more" is the notable direction)
  13: "higher", // Feature Revenue Concentration (a kill-candidate concentration)
};

export interface TrippedExample {
  featureKey: string;
  featureName: string;
  value: number;
  triggerText: string;
}

export interface MetricCard {
  metric: MetricDefinition;
  /** Mean of the latest week's per-feature values (or the single value for a
   *  product-level metric); null when no applicable feature has data yet. */
  currentValue: number | null;
  /** 12 weekly values (mean across applicable features per week), oldest first. */
  series: number[];
  /** How many feature×metric pairs are tripped in the LATEST week. */
  trippedCount: number;
  /** Up to 3 tripped examples from the latest week, for the card's detail view. */
  trippedExamples: TrippedExample[];
  linkedFeatures: TaxonomyFeature[];
}

/**
 * Group raw observations into one card per metric (1-13; metric 14 is the
 * separately-rendered health board). Per-feature metrics aggregate across every
 * feature they apply to (mean per week) so one card represents the whole
 * metric rather than one card per feature × metric — the per-feature detail
 * surfaces via `trippedExamples` and `linkedFeatures`.
 */
export function buildMetricCards(
  observations: MetricObservation[],
  registry: MetricDefinition[],
  features: TaxonomyFeature[],
): MetricCard[] {
  const featureByKey = new Map(features.map((f) => [f.key, f]));
  const byMetric = new Map<number, MetricObservation[]>();
  for (const o of observations) {
    const arr = byMetric.get(o.metricId) ?? [];
    arr.push(o);
    byMetric.set(o.metricId, arr);
  }

  return registry
    .filter((m) => !m.derived)
    .map((metric) => {
      const rows = byMetric.get(metric.id) ?? [];
      const weeks = [...new Set(rows.map((r) => r.weekStart))].sort();
      const series = weeks.map((w) => {
        const atWeek = rows.filter((r) => r.weekStart === w);
        return atWeek.length > 0 ? atWeek.reduce((a, r) => a + r.value, 0) / atWeek.length : 0;
      });
      const currentValue = series.length > 0 ? series[series.length - 1] : null;

      const latestWeek = weeks[weeks.length - 1];
      const latestRows = rows.filter((r) => r.weekStart === latestWeek);
      const direction = WORSE_DIRECTION[metric.id] ?? "lower";
      const trippedAtLatest = latestRows
        .filter((r) => r.tripped)
        .sort((a, b) => (direction === "lower" ? a.value - b.value : b.value - a.value));
      const trippedExamples: TrippedExample[] = trippedAtLatest.slice(0, 3).map((r) => ({
        featureKey: r.featureKey,
        featureName:
          r.featureKey === PRODUCT_LEVEL_KEY
            ? "Product-wide"
            : featureByKey.get(r.featureKey)?.name ?? r.featureKey,
        value: r.value,
        triggerText: r.triggerText ?? "",
      }));

      const linkedFeatures = metric.perFeature
        ? features.filter((f) => rows.some((r) => r.featureKey === f.key))
        : (metric.relatedFeatureKeys ?? [])
            .map((k) => featureByKey.get(k))
            .filter((f): f is TaxonomyFeature => Boolean(f));

      return {
        metric,
        currentValue,
        series,
        trippedCount: trippedAtLatest.length,
        trippedExamples,
        linkedFeatures,
      };
    });
}
