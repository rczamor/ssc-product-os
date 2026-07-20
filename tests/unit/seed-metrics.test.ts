import { describe, expect, it } from "vitest";
import { getDb } from "@/lib/db";
import { metricObservations } from "@/lib/db/schema";
import { loadFeatureTaxonomy, loadMetricsRegistry } from "@/lib/metrics";
import { generateMetricObservations } from "@/lib/metric-generator";
import { GeneratedObservationsSchema } from "@/lib/schemas/metrics";

/** Mirrors runner/seed-metrics.ts's delete-then-insert reseed exactly. */
async function reseed(observations: ReturnType<typeof generateMetricObservations>) {
  const db = await getDb();
  await db.delete(metricObservations);
  await db.insert(metricObservations).values(observations);
}

describe("metric_observations reseed idempotency", () => {
  it("re-running the seed produces the same row count, not duplicates", async () => {
    const features = loadFeatureTaxonomy();
    const registry = loadMetricsRegistry();
    const observations = GeneratedObservationsSchema.parse({
      observations: generateMetricObservations(features, registry),
    }).observations;

    await reseed(observations);
    const db = await getDb();
    const first = await db.select().from(metricObservations);
    expect(first.length).toBe(observations.length);

    await reseed(observations);
    const second = await db.select().from(metricObservations);
    expect(second.length).toBe(observations.length); // not doubled
  });
});
