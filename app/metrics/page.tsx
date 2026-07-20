import { getMetricObservations } from "@/lib/db/queries";
import { buildHealthBoard, buildMetricCards, loadFeatureTaxonomy, loadMetricsRegistry } from "@/lib/metrics";
import MetricCard from "@/components/MetricCard";
import HealthBoard from "@/components/HealthBoard";

export const dynamic = "force-dynamic";

export default async function MetricsPage() {
  const features = loadFeatureTaxonomy();
  const registry = loadMetricsRegistry();
  const observations = await getMetricObservations();
  const cards = buildMetricCards(observations, registry, features);
  const healthBoard = buildHealthBoard(features);
  const totalTripped = cards.reduce((sum, c) => sum + c.trippedCount, 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-ink">Measure</h1>
        <p className="mt-1 text-sm text-ink-4">
          The weekly product-ops KPI dashboard (spec Appendix A). Sources shown (Pendo, Heap,
          Snowflake, FullStory, Jira, Gainsight) are the target integrations — current values are
          a generated, rhythm-aware sample dataset (
          <code>runner/seed-metrics.ts</code>), not live telemetry.
        </p>
      </div>

      {observations.length === 0 ? (
        <div className="rounded-[11px] border border-dashed border-line-3 bg-card-alt px-5 py-8 text-center text-sm text-ink-4">
          No metric data yet. Run <code>node bin/run.mjs npx tsx runner/seed-metrics.ts</code> to
          generate the sample dataset.
        </div>
      ) : (
        <>
          {totalTripped > 0 && (
            <div className="rounded-lg border border-amber/30 bg-amber/10 px-4 py-2 text-sm text-amber-dark">
              <strong>{totalTripped}</strong> feature×metric trigger{totalTripped === 1 ? "" : "s"}{" "}
              currently tripped this week — see the amber cards below.
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {cards.map((c) => (
              <MetricCard key={c.metric.id} card={c} />
            ))}
            <HealthBoard board={healthBoard} />
          </div>
        </>
      )}
    </div>
  );
}
