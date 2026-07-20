/**
 * Generates 12 weeks of rhythm-aware sample metric data (spec Phase 4.3) from
 * data/feature-taxonomy.json × data/metrics-registry.json into metric_observations.
 *
 *   npx tsx runner/seed-metrics.ts --validate-only
 *     Validate the generated observations against the schema and print a
 *     summary (feature/metric counts, tripped-trigger count). No DB write.
 *
 *   npx tsx runner/seed-metrics.ts
 *     Delete-then-insert all metric_observations rows (idempotent reseed —
 *     matches lib/linear-sync.ts's syncProjectToCache pattern; re-running
 *     produces the same end state, not duplicate rows).
 */
import { loadEnv } from "./lib/env";
import { hasFlag as hasFlagOf } from "./lib/args";
import { getDb } from "../lib/db";
import { metricObservations } from "../lib/db/schema";
import { loadFeatureTaxonomy, loadMetricsRegistry } from "../lib/metrics";
import { generateMetricObservations } from "../lib/metric-generator";
import { GeneratedObservationsSchema } from "../lib/schemas/metrics";
import { runMain } from "./lib/zod";

loadEnv();
const ARGV = process.argv.slice(2);
const hasFlag = (f: string) => hasFlagOf(ARGV, f);

async function main(): Promise<void> {
  const features = loadFeatureTaxonomy();
  const registry = loadMetricsRegistry();
  const observations = generateMetricObservations(features, registry);
  const validated = GeneratedObservationsSchema.parse({ observations }).observations;

  const tripped = validated.filter((o) => o.tripped);
  const trippedFeatures = new Set(tripped.map((o) => `${o.featureKey}:${o.metricId}`));

  if (hasFlag("--validate-only")) {
    console.log(
      `VALID: ${validated.length} observations across ${features.length} features × ` +
        `${registry.filter((m) => !m.derived).length} metrics, ${tripped.length} tripped ` +
        `(${trippedFeatures.size} distinct feature×metric trips)`,
    );
    return;
  }

  const db = await getDb();
  await db.delete(metricObservations);
  await db.insert(metricObservations).values(validated);

  console.log(
    `seeded ${validated.length} metric observations (${tripped.length} tripped triggers, ` +
      `${trippedFeatures.size} distinct feature×metric trips)`,
  );
}

runMain(main);
