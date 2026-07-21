"use client";

import { useState } from "react";
import Sparkline from "@/components/Sparkline";
import type { MetricCard as MetricCardData } from "@/lib/metrics";
import type { MetricDefinition } from "@/lib/schemas/metrics";

/**
 * Format by the metric's explicit `unit` — never inferred from the value's
 * magnitude. A card's `currentValue` is a MEAN across features, so a count
 * metric (e.g. Churn Risk Watchlist averaging to 0.83 accounts) can land in
 * the same numeric range as a genuine 0-1 ratio; guessing from the value alone
 * previously misrendered it as "83%".
 */
export function formatValue(value: number, unit: MetricDefinition["unit"]): string {
  switch (unit) {
    case "ratio":
      return `${(value * 100).toFixed(0)}%`;
    case "percent":
      return `${value.toFixed(0)}%`;
    case "days":
      return `${value.toFixed(1)}d`;
    case "minutes":
      return `${value.toFixed(1)}m`;
    case "count":
      return String(Math.round(value));
    case "points":
      return value > 0 ? `+${value.toFixed(1)}` : value.toFixed(1);
    case "index":
    default:
      return value.toFixed(1);
  }
}

export default function MetricCard({ card }: { card: MetricCardData }) {
  const [open, setOpen] = useState(false);
  const { metric, currentValue, series, trippedCount, trippedExamples, linkedFeatures } = card;

  const tripped = trippedCount > 0;
  // Metric 3 (Usage Frequency) is judged against a rhythm baseline band; when it
  // is not tripped it reads as "in band" (green). Everything else is neutral ink
  // unless a trigger fired (red). Amber is reserved for the health board only.
  const inBand = !tripped && metric.vizType === "baseline band";
  const valueClass = tripped ? "text-red" : inBand ? "text-green" : "text-ink";
  const sparkColor = tripped ? "#cc3b46" : inBand ? "#1f9d63" : "#262019";

  const trippedTrigger =
    trippedExamples.find((e) => e.triggerText)?.triggerText ?? metric.actionTrigger;
  const relatedFeatures = linkedFeatures.map((f) => f.name).join(" · ") || "—";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => setOpen((o) => !o)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setOpen((o) => !o);
        }
      }}
      className={`cursor-pointer overflow-hidden rounded-[10px] border bg-card hover:border-line-4 ${
        tripped ? "border-[rgba(204,59,70,0.3)]" : "border-line"
      }`}
    >
      <div className="px-[14px] py-[13px]">
        <div className="mb-[9px] flex items-center gap-[7px]">
          <span className="font-mono text-[10px] text-ink-7">{metric.id}</span>
          <span className="text-[12.5px] font-semibold text-ink">{metric.name}</span>
          {tripped && (
            <span className="ml-auto rounded-[4px] border border-[rgba(204,59,70,0.28)] bg-[rgba(204,59,70,0.1)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.04em] text-red-dark">
              triggered
            </span>
          )}
        </div>

        <div className="flex items-end justify-between gap-[10px]">
          <div>
            <div className="flex items-baseline gap-[5px]">
              <span
                className={`font-mono text-[26px] font-bold leading-none tracking-[-0.02em] ${valueClass}`}
              >
                {currentValue === null
                  ? "—"
                  : inBand
                    ? "in band"
                    : formatValue(currentValue, metric.unit)}
              </span>
            </div>
            {/* Clamp the on-card definition to a few lines so one metric with a
                long definition (e.g. Engagement) can't tower over its row-mates;
                the full text is shown in the expand panel below. */}
            <div className="mt-0.5 line-clamp-3 text-[10.5px] leading-[1.4] text-ink-6">
              {metric.definition}
            </div>
          </div>
          {series.length >= 2 && (
            <Sparkline values={series} width={116} height={28} strokeWidth={1.5} opacity={0.9} color={sparkColor} />
          )}
        </div>

        <div className="mt-[9px] font-mono text-[9.5px] text-ink-7">{metric.vizType}</div>
      </div>

      {tripped && (
        <div className="border-t border-[rgba(204,59,70,0.14)] bg-[rgba(204,59,70,0.04)] px-[14px] py-[9px] text-[11px] leading-[1.45] text-red-strip">
          {trippedTrigger}
        </div>
      )}

      {open && (
        <div className="border-t border-line-2 bg-card-alt px-[14px] py-[13px]">
          <div className="mb-[11px] text-[11.5px] leading-[1.5] text-ink-4">{metric.definition}</div>
          <div className="mb-[11px] grid grid-cols-2 gap-x-[12px] gap-y-[8px]">
            <div>
              <div className="text-[9px] uppercase tracking-[0.06em] text-ink-7">Source</div>
              <div className="text-[11.5px] text-ink-2">{metric.source}</div>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-[0.06em] text-ink-7">Owner</div>
              <div className="text-[11.5px] text-ink-2">{metric.owner}</div>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-[0.06em] text-ink-7">Cadence</div>
              <div className="text-[11.5px] text-ink-2">{metric.cadence}</div>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-[0.06em] text-ink-7">Related features</div>
              <div className="text-[11.5px] text-ink-2">{relatedFeatures}</div>
            </div>
          </div>
          <div className="rounded-[6px] border border-line-2 bg-card px-[11px] py-[9px]">
            <div className="mb-[3px] text-[9px] uppercase tracking-[0.06em] text-ink-7">Action trigger</div>
            <div className="text-[11.5px] leading-[1.45] text-ink-3">{metric.actionTrigger}</div>
          </div>
          <div className="mt-[9px] text-[10.5px] leading-[1.45] text-ink-6">
            {metric.source} is a target integration; the values shown are a generated 12-week sample.
          </div>
        </div>
      )}

      <div className="flex items-center justify-center gap-2 border-t border-line-2 bg-card-alt py-[10px] text-[11.5px] font-semibold text-accent">
        <span>{open ? "Collapse" : "Expand details"}</span>
        <span
          className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-[5px] border text-[11px] leading-none"
          style={{ background: "var(--accent-bg)", borderColor: "var(--accent-bd)" }}
        >
          {open ? "▾" : "▸"}
        </span>
      </div>
    </div>
  );
}
