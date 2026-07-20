import type { HealthState, MetricDefinition, MetricObservation, TaxonomyFeature } from "@/lib/schemas/metrics";
import { PRODUCT_LEVEL_KEY } from "@/lib/schemas/metrics";

/** Deterministic PRNG (mulberry32) so a given seed always generates the same
 *  dataset — needed for reproducible tests and predictable demo data. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const WEEKS = 12;

/** Baseline days-between-uses per rhythm class (metric 3's comparison band). */
const RHYTHM_BASELINE_DAYS: Record<string, number> = {
  "daily-ops": 1.5,
  "weekly-review": 6,
  "monthly-reporting": 28,
  "quarterly-assessment": 85,
  "event-driven": 20,
};

/** Baseline adoption % per rhythm class (metric 1's "class baseline" comparison). */
const RHYTHM_ADOPTION_BASELINE: Record<string, number> = {
  "daily-ops": 65,
  "weekly-review": 50,
  "monthly-reporting": 35,
  "quarterly-assessment": 25,
  "event-driven": 30,
};

/** Adoption-anchor range per health state (fraction 0-1). */
const HEALTH_ADOPTION_RANGE: Record<HealthState, [number, number]> = {
  "strategic-growing": [0.55, 0.85],
  "valuable-but-hidden": [0.3, 0.55],
  "critical-to-few": [0.04, 0.15],
  "shipped-not-adopted": [0.08, 0.24],
  "legacy-kill": [0.01, 0.05],
};

/** Trend direction per health state applied across the 12 weeks (relative). */
const HEALTH_TREND: Record<HealthState, number> = {
  "strategic-growing": 0.18,
  "valuable-but-hidden": 0.0,
  "critical-to-few": 0.0,
  "shipped-not-adopted": 0.05,
  "legacy-kill": -0.15,
};

/**
 * Features/weeks hard-forced to specific values so the spec's required ≥4
 * tripped triggers are always present regardless of the general randomized
 * generation (which still runs for everything else and can trip more
 * organically). Keyed by feature key; each entry patches the LAST week's
 * (index 11) value for the named metric.
 */
const DESIGNATED_TRIGGERS: Record<
  string,
  Partial<Record<number, { value: number; triggerText: string }>>
> = {
  // #1 required: shipped-not-adopted feature with D30 activation <25% (metric 6).
  "risk-quantification": {
    6: {
      value: 19,
      triggerText: "D30 activation 19% (<25%) — shipped-not-adopted tag confirmed; enablement queue opened.",
    },
  },
  // #2 required: legacy-kill candidate with reach <2% (metric 1).
  "notification-center": {
    1: {
      value: 1.4,
      triggerText: "Adoption 1.4% (<2% reach) — legacy-kill candidate, forced CCB kill/invest decision.",
    },
  },
  // #3 required: critical-to-few feature, low reach + top-decile ARR concentration (metrics 1 + 13).
  "action-plans-remediation": {
    1: { value: 6.5, triggerText: "Adoption 6.5% — low reach, consistent with critical-to-few classification." },
    13: {
      value: 82,
      triggerText: "82% of adopters are top-decile ARR accounts at <10% overall adoption — kill candidate with tier-1 concentration, account-flagged review before CCB.",
    },
  },
  // #4 required: tier-1 account crossing the renewal watchlist threshold (metric 11).
  // report-center is retention-driver — metric 11 is restricted to that value_role.
  "report-center": {
    11: {
      value: 2,
      triggerText: "2 tier-1 accounts inside their renewal window dropped below rhythm on this feature — CSM play triggered in Gainsight.",
    },
  },
};

function weekStartDate(index: number): string {
  // Anchor "today" at a fixed reference so the generator is deterministic
  // regardless of when it runs; index 11 (most recent) is the current week.
  const anchor = new Date("2026-07-13T00:00:00Z"); // a Monday
  const d = new Date(anchor);
  d.setUTCDate(d.getUTCDate() + (index - (WEEKS - 1)) * 7);
  return d.toISOString().slice(0, 10);
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/**
 * Generate 12 weeks of rhythm-aware sample observations for every applicable
 * feature × metric(1-13) pair. Pure and deterministic for a given seed, so
 * it's directly unit-testable without a database.
 */
export function generateMetricObservations(
  features: TaxonomyFeature[],
  registry: MetricDefinition[],
  seed = 42,
): MetricObservation[] {
  const rand = mulberry32(seed);
  const noise = (spread: number) => (rand() * 2 - 1) * spread;
  const out: MetricObservation[] = [];

  const applicableMetrics = registry.filter((m) => !m.derived && m.id <= 13);

  for (const f of features) {
    const [lo, hi] = HEALTH_ADOPTION_RANGE[f.health_state];
    const adoptionAnchor = lo + rand() * (hi - lo);
    const trend = HEALTH_TREND[f.health_state];
    const isRetentionDriver = f.value_role === "retention-driver";
    const designated = DESIGNATED_TRIGGERS[f.key] ?? {};

    for (const m of applicableMetrics) {
      if (!m.perFeature) continue; // product-level metrics handled separately
      if (m.restrictToRhythmClasses && !m.restrictToRhythmClasses.includes(f.rhythm_class)) continue;
      if (m.restrictToValueRoles && !m.restrictToValueRoles.includes(f.value_role)) continue;

      const series: number[] = [];
      for (let w = 0; w < WEEKS; w++) {
        const progress = w / (WEEKS - 1); // 0..1 across the window
        // Renewal-window effect: retention-driver features show usage trending
        // down over the final ~4 weeks (simulating the 90-day renewal window).
        const renewalDecay = isRetentionDriver && w >= WEEKS - 4 ? 1 - (w - (WEEKS - 4)) * 0.06 : 1;

        let value: number;
        switch (m.id) {
          case 1: // Feature Adoption Rate (%)
            value = adoptionAnchor * 100 * (1 + trend * progress) * renewalDecay + noise(2);
            break;
          case 2: // Engagement (WAU/MAU ratio 0-1)
            value = clamp(adoptionAnchor * 0.9 * (1 + trend * progress) * renewalDecay + noise(0.03), 0.02, 0.95);
            break;
          case 3: { // Usage Frequency (days between uses)
            const baseline = RHYTHM_BASELINE_DAYS[f.rhythm_class] ?? 14;
            // Lower adoption -> more dormant -> higher days-between-uses.
            value = baseline * (1.4 - adoptionAnchor) + noise(baseline * 0.1);
            break;
          }
          case 4: // Task Completion Rate (%)
            value = clamp(70 + noise(15), 20, 98);
            break;
          case 5: // Time on Task (minutes)
            value = clamp(4 + noise(2) + (1 - adoptionAnchor) * 2, 1, 15);
            break;
          case 6: // Activation Rate D30 (%)
            value = clamp(adoptionAnchor * 100 * 0.7 * (1 + trend * progress) + noise(4), 1, 95);
            break;
          case 7: // Time to Adoption (days from GA to 10% adoption)
            value = clamp(45 - adoptionAnchor * 35 + noise(5), 3, 60);
            break;
          case 8: // Friction Index (per 100 active accounts)
            value = clamp((1 - adoptionAnchor) * 18 + noise(3), 0.5, 30);
            break;
          case 10: // Feature NPS delta vs company baseline
            value = clamp((adoptionAnchor - 0.4) * 40 + trend * 30 * progress + noise(4), -30, 30);
            break;
          case 11: // Churn Risk Watchlist (tier-1 accounts at risk, count)
            value = Math.max(0, Math.round((1 - adoptionAnchor) * 1.5 * renewalDecay + noise(0.5) - 0.5));
            break;
          case 12: // Expansion PQLs (accounts hitting ceilings, count)
            value = Math.max(0, Math.round(adoptionAnchor * 5 * (1 + trend * progress) + noise(1)));
            break;
          case 13: // Feature Revenue Concentration (% adopters that are top-decile ARR)
            value = clamp(50 - adoptionAnchor * 40 + noise(8), 5, 95);
            break;
          default:
            continue;
        }

        const patch = designated[m.id];
        if (w === WEEKS - 1 && patch) value = patch.value;
        series.push(value);
      }

      // Trigger evaluation (last week vs the series), plus any designated override.
      series.forEach((value, w) => {
        const patch = w === WEEKS - 1 ? designated[m.id] : undefined;
        const { tripped, triggerText } = evaluateTrigger(m, f, series, w, value);
        out.push({
          metricId: m.id,
          featureKey: f.key,
          weekStart: weekStartDate(w),
          value: Math.round(value * 100) / 100,
          tripped: patch ? true : tripped,
          triggerText: patch ? patch.triggerText : triggerText,
        });
      });
    }
  }

  // Product-level metrics (metric 9: AI Containment Rate) — one series, not per-feature.
  const aiMetric = registry.find((m) => m.id === 9);
  if (aiMetric) {
    for (let w = 0; w < WEEKS; w++) {
      // Improves over the build: starts below the 70% trigger, climbs as the
      // schema-gate + review-loop matures (a genuine reflection of this project).
      const value = clamp(65 + w * 2.2 + noise(3), 50, 95);
      out.push({
        metricId: 9,
        featureKey: PRODUCT_LEVEL_KEY,
        weekStart: weekStartDate(w),
        value: Math.round(value * 100) / 100,
        tripped: value < 70,
        triggerText: value < 70 ? "Acceptance <70% — prompt/eval review; failures logged to eval set." : null,
      });
    }
  }

  return out;
}

function evaluateTrigger(
  m: MetricDefinition,
  f: TaxonomyFeature,
  series: number[],
  w: number,
  value: number,
): { tripped: boolean; triggerText: string | null } {
  switch (m.id) {
    case 1: {
      const baseline = RHYTHM_ADOPTION_BASELINE[f.rhythm_class] ?? 40;
      const under = w >= 1 && value < baseline * 0.6 && series[w - 1] < baseline * 0.6;
      return under
        ? { tripped: true, triggerText: `Adoption ${value.toFixed(1)}% is under 60% of the ${f.rhythm_class} baseline for 2 consecutive weeks — tagged underused.` }
        : { tripped: false, triggerText: null };
    }
    case 2: {
      if (w < 4) return { tripped: false, triggerText: null };
      const decline = (series[w - 4] - value) / Math.max(series[w - 4], 0.01);
      return decline >= 0.15
        ? { tripped: true, triggerText: `Stickiness down ${Math.round(decline * 100)}% over 4 weeks — engagement review triggered.` }
        : { tripped: false, triggerText: null };
    }
    case 3: {
      const baseline = RHYTHM_BASELINE_DAYS[f.rhythm_class] ?? 14;
      return value > baseline * 2
        ? { tripped: true, triggerText: `Usage interval ${value.toFixed(1)}d is over 2x the ${f.rhythm_class} baseline (${baseline}d) — dormancy watch.` }
        : { tripped: false, triggerText: null };
    }
    case 4:
      return value < 40
        ? { tripped: true, triggerText: `Task completion ${value.toFixed(0)}% — funnel review this week.` }
        : { tripped: false, triggerText: null };
    case 5: {
      if (w < 4) return { tripped: false, triggerText: null };
      const avg = series.slice(Math.max(0, w - 4), w).reduce((a, b) => a + b, 0) / Math.min(4, w);
      return avg > 0 && value > avg * 1.2
        ? { tripped: true, triggerText: `Time on task up ${Math.round(((value - avg) / avg) * 100)}% vs 4-week average — regression check.` }
        : { tripped: false, triggerText: null };
    }
    case 6:
      return value < 25
        ? { tripped: true, triggerText: `D30 activation ${value.toFixed(0)}% (<25%) — shipped-not-adopted tag, enablement queue.` }
        : { tripped: false, triggerText: null };
    case 7:
      return value > 30
        ? { tripped: true, triggerText: `Time to adoption ${value.toFixed(0)} days (>30) — enablement gap review with PMM.` }
        : { tripped: false, triggerText: null };
    case 8: {
      const rank = [...series].sort((a, b) => b - a).indexOf(value);
      return rank < 3
        ? { tripped: true, triggerText: `Top-3 friction week (rank ${rank + 1}) — named owner + first action at Monday standup.` }
        : { tripped: false, triggerText: null };
    }
    case 10:
      return value <= -10
        ? { tripped: true, triggerText: `Feature NPS ${value.toFixed(0)} points below company baseline — verbatims clustered into a theme brief.` }
        : { tripped: false, triggerText: null };
    case 11:
      return value >= 1
        ? { tripped: true, triggerText: `${Math.round(value)} tier-1 renewal-window account(s) below rhythm — CSM play triggered in Gainsight.` }
        : { tripped: false, triggerText: null };
    case 12: {
      const prev = w > 0 ? series[w - 1] : 0;
      return value >= 3 && prev < 3
        ? { tripped: true, triggerText: `Expansion threshold crossed (${Math.round(value)} accounts) — routed to AE.` }
        : { tripped: false, triggerText: null };
    }
    case 13:
      return value > 70
        ? { tripped: true, triggerText: `${value.toFixed(0)}% of adopters are top-decile ARR at low overall adoption — kill candidate, account-flagged review before CCB.` }
        : { tripped: false, triggerText: null };
    default:
      return { tripped: false, triggerText: null };
  }
}
