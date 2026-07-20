import type { Db } from "./index";
import { metricObservations } from "./schema";
import { loadFeatureTaxonomy, loadMetricsRegistry } from "@/lib/metrics";
import { generateMetricObservations } from "@/lib/metric-generator";

/**
 * Ensure the Metrics tab's generated 12-week sample exists.
 *
 * The metric observations are ALWAYS a synthetic sample (the UI says so
 * explicitly) — there is no "real" metrics data to protect, so unlike the
 * run/feedback demo seed this must not be gated behind DB_SEED_ON_EMPTY. On a
 * deployed Neon database that was populated by publishing a real run (which
 * never writes observations), the table would otherwise stay empty and every
 * metric card renders "—". Calling this from the read path guarantees the
 * dataset materializes on first view.
 *
 * Idempotent AND race-safe: the empty-check skips the common case, and the
 * insert uses onConflictDoNothing against the (metric_id, feature_key,
 * week_start) unique index so two concurrent cold requests that both see an
 * empty table cannot double-insert the sample.
 */
export async function ensureMetricsSeeded(db: Db): Promise<void> {
  const existing = await db
    .select({ id: metricObservations.id })
    .from(metricObservations)
    .limit(1);
  if (existing.length > 0) return;

  const rows = generateMetricObservations(loadFeatureTaxonomy(), loadMetricsRegistry());
  if (rows.length === 0) return;
  await db
    .insert(metricObservations)
    .values(rows)
    .onConflictDoNothing({
      target: [
        metricObservations.metricId,
        metricObservations.featureKey,
        metricObservations.weekStart,
      ],
    });
}
