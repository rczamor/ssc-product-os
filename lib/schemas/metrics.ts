import { z } from "zod";

/** Sentinel featureKey for product-level (not per-feature) metrics. Defined
 *  before TaxonomyFeatureSchema so the schema can reject it as a real feature key. */
export const PRODUCT_LEVEL_KEY = "product";

/** Appendix A's 5 rhythm classes — how often a feature is naturally used. */
export const RHYTHM_CLASSES = [
  "daily-ops",
  "weekly-review",
  "monthly-reporting",
  "quarterly-assessment",
  "event-driven",
] as const;
export const RhythmClassSchema = z.enum(RHYTHM_CLASSES);
export type RhythmClass = z.infer<typeof RhythmClassSchema>;

export const VALUE_ROLES = ["retention-driver", "expansion-driver", "table-stakes"] as const;
export const ValueRoleSchema = z.enum(VALUE_ROLES);
export type ValueRole = z.infer<typeof ValueRoleSchema>;

/** The 5 states of spec Phase 4.1 / Appendix A metric 14. */
export const HEALTH_STATES = [
  "strategic-growing",
  "valuable-but-hidden",
  "critical-to-few",
  "shipped-not-adopted",
  "legacy-kill",
] as const;
export const HealthStateSchema = z.enum(HEALTH_STATES);
export type HealthState = z.infer<typeof HealthStateSchema>;

export const HEALTH_STATE_LABELS: Record<HealthState, string> = {
  "strategic-growing": "Strategic & growing",
  "valuable-but-hidden": "Valuable but hidden",
  "critical-to-few": "Critical to few",
  "shipped-not-adopted": "Shipped, not adopted",
  "legacy-kill": "Legacy / kill candidate",
};

/** One entry in data/feature-taxonomy.json. */
export const TaxonomyFeatureSchema = z.object({
  key: z
    .string()
    .regex(/^[a-z0-9][a-z0-9-]{2,79}$/)
    .refine((k) => k !== PRODUCT_LEVEL_KEY, {
      message: `"${PRODUCT_LEVEL_KEY}" is reserved for product-level metrics and cannot be used as a feature key`,
    }),
  name: z.string().min(3).max(160),
  surface: z.string().min(1).max(200),
  description: z.string().min(10).max(500),
  rhythm_class: RhythmClassSchema,
  value_role: ValueRoleSchema,
  health_state: HealthStateSchema,
  rationale: z.string().min(20).max(1000),
  evidence: z.string().min(3).max(500),
  previousHealthState: HealthStateSchema.nullish(),
});
export type TaxonomyFeature = z.infer<typeof TaxonomyFeatureSchema>;

export const FeatureTaxonomySchema = z.object({
  features: z.array(TaxonomyFeatureSchema).min(12).max(20),
});

/** One entry in data/metrics-registry.json (Appendix A). */
export const MetricDefinitionSchema = z.object({
  id: z.number().int().min(1).max(14),
  name: z.string().min(3).max(120),
  definition: z.string().min(10).max(400),
  source: z.string().min(1).max(120),
  owner: z.string().min(1).max(120),
  cadence: z.string().min(1).max(40),
  actionTrigger: z.string().min(10).max(500),
  vizType: z.string().min(1).max(40),
  /**
   * How the stored numeric value should be displayed. Explicit rather than
   * inferred from the value's magnitude — a card's `currentValue` is a MEAN
   * across features, and count/delta metrics (e.g. Churn Risk Watchlist's
   * "0.83 accounts") can coincidentally land in the same [-1,1] band as a
   * genuine 0-1 ratio (Engagement), which previously caused them to be
   * misrendered as a percentage.
   */
  unit: z.enum(["percent", "ratio", "days", "minutes", "count", "points", "index"]),
  rhythmAware: z.boolean(),
  perFeature: z.boolean(),
  restrictToRhythmClasses: z.array(RhythmClassSchema).nullish(),
  restrictToValueRoles: z.array(ValueRoleSchema).nullish(),
  relatedFeatureKeys: z.array(z.string()).nullish(),
  derived: z.boolean().nullish(),
});
export type MetricDefinition = z.infer<typeof MetricDefinitionSchema>;

export const MetricsRegistrySchema = z.object({
  metrics: z.array(MetricDefinitionSchema).length(14),
});

/** One generated weekly observation (runner/seed-metrics.ts output, pre-insert). */
export const MetricObservationSchema = z.object({
  metricId: z.number().int().min(1).max(13), // metric 14 is derived, never generated
  featureKey: z.string().min(1),
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  value: z.number(),
  tripped: z.boolean(),
  triggerText: z.string().max(300).nullish(),
});
export type MetricObservation = z.infer<typeof MetricObservationSchema>;

export const GeneratedObservationsSchema = z.object({
  observations: z.array(MetricObservationSchema).min(1),
});
