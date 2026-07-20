import { getMetricObservations } from "@/lib/db/queries";
import {
  buildHealthBoard,
  buildMetricCards,
  latestTrippedFeatureKeys,
  loadFeatureTaxonomy,
  loadMetricsRegistry,
} from "@/lib/metrics";
import MetricCard from "@/components/MetricCard";
import HealthBoard from "@/components/HealthBoard";

export const dynamic = "force-dynamic";

export default async function MetricsPage() {
  const features = loadFeatureTaxonomy();
  const registry = loadMetricsRegistry();
  const observations = await getMetricObservations();
  const cards = buildMetricCards(observations, registry, features);
  const healthBoard = buildHealthBoard(features, latestTrippedFeatureKeys(observations));

  // "Tripped this week" is counted per METRIC (a card with any tripped feature),
  // not per feature×metric pair — this drives both the header count and queue.
  const trippedCards = cards.filter((c) => c.trippedCount > 0);
  const trippedMetricCount = trippedCards.length;

  return (
    <div className="mx-auto max-w-[1300px] animate-fadeup px-6 pb-[80px] pt-[26px]">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="m-0 text-[27px] font-bold tracking-[-0.02em] text-ink">Measure</h1>
          <p className="mt-2 max-w-[680px] text-[13.5px] leading-[1.5] text-ink-4">
            14 rhythm-aware metrics judged against each feature&rsquo;s own class baseline &mdash; not
            a universal weekly bar. Sources shown (Pendo, Heap, Snowflake, FullStory, Jira,
            Gainsight) are the target integrations; the data below is a generated 12-week sample.
          </p>
        </div>
        <div className="flex items-center gap-[9px] rounded-[10px] border border-[rgba(204,59,70,0.28)] bg-[rgba(204,59,70,0.05)] px-[14px] py-[10px]">
          <span className="font-mono text-[24px] font-bold text-red">{trippedMetricCount}</span>
          <div className="leading-[1.2]">
            <div className="text-[12px] font-semibold text-ink">action triggers</div>
            <div className="text-[11px] text-ink-4">tripped this week</div>
          </div>
        </div>
      </div>

      {trippedCards.length > 0 && (
        <section className="mb-[22px] overflow-hidden rounded-[12px] border border-line bg-card">
          <div className="flex items-center gap-[10px] border-b border-line-2 bg-[rgba(204,59,70,0.03)] px-[18px] py-[13px]">
            <span className="h-[7px] w-[7px] rounded-full bg-red" />
            <h2 className="text-[15px] font-bold text-ink">Action queue</h2>
            <span className="text-[11px] text-ink-5">
              the triggers that fired this week &mdash; each routes to an owner or workflow, not just
              a chart
            </span>
            <span className="ml-auto font-mono text-[11px] text-red-dark">
              {trippedMetricCount} firing
            </span>
          </div>
          {trippedCards.map((c) => {
            const triggerText =
              c.trippedExamples.find((e) => e.triggerText)?.triggerText ?? c.metric.actionTrigger;
            const route = c.metric.route ?? c.metric.owner;
            return (
              <div
                key={c.metric.id}
                className="grid grid-cols-[224px_1fr_188px] items-center gap-[14px] border-b border-card-subtle px-[18px] py-[12px]"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-red" />
                  <span className="font-mono text-[9.5px] text-ink-7">M{c.metric.id}</span>
                  <span className="text-[12.5px] font-semibold text-ink">{c.metric.name}</span>
                </div>
                <div className="text-[11.5px] leading-[1.4] text-ink-4">{triggerText}</div>
                <div className="flex items-center justify-end gap-[7px]">
                  <span className="text-[12px] text-ink-7">&rarr;</span>
                  <span className="rounded-[6px] border border-[rgba(204,59,70,0.22)] bg-[rgba(204,59,70,0.07)] px-[9px] py-[3px] text-[11px] font-semibold text-red-dark">
                    {route}
                  </span>
                </div>
              </div>
            );
          })}
        </section>
      )}

      <div className="mb-3 flex items-center gap-[9px]">
        <h2 className="text-[15px] font-bold text-ink">Metrics registry</h2>
        <span className="text-[11px] text-ink-5">
          the catalog &mdash; all 14 metrics with definition, source, owner, cadence &amp; trigger.
          Click any card to expand.
        </span>
      </div>

      {observations.length === 0 && (
        <div className="mb-[11px] rounded-[10px] border border-dashed border-line-3 bg-card-alt px-5 py-4 text-center text-[12px] text-ink-4">
          No generated observations yet &mdash; values show as &ldquo;&mdash;&rdquo;. Run{" "}
          <code className="font-mono">node bin/run.mjs npx tsx runner/seed-metrics.ts</code> to
          populate the 12-week sample.
        </div>
      )}

      <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-[11px]">
        {cards.map((c) => (
          <MetricCard key={c.metric.id} card={c} />
        ))}
      </div>

      <HealthBoard board={healthBoard} />
    </div>
  );
}
