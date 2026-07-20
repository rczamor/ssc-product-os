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

  return (
    <div
      className={`rounded-xl border bg-white p-4 shadow-sm ${
        trippedCount > 0 ? "border-amber-300" : "border-slate-200"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-xs font-medium text-slate-400">#{metric.id}</div>
          <h3 className="text-sm font-semibold text-slate-900">{metric.name}</h3>
        </div>
        {trippedCount > 0 && (
          <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
            {trippedCount} tripped
          </span>
        )}
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="text-2xl font-semibold text-slate-900">
          {currentValue === null ? "—" : formatValue(currentValue, metric.unit)}
        </div>
        <Sparkline
          values={series}
          strokeClassName={trippedCount > 0 ? "stroke-amber-500" : "stroke-indigo-500"}
        />
      </div>
      <div className="mt-1 text-[11px] text-slate-400">{metric.vizType} · {metric.cadence}</div>

      {trippedExamples.length > 0 && (
        <ul className="mt-3 space-y-1">
          {trippedExamples.map((ex) => (
            <li key={ex.featureKey} className="rounded bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
              <span className="font-medium">{ex.featureName}:</span> {ex.triggerText}
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="mt-3 text-xs text-indigo-600 hover:underline"
      >
        {open ? "hide details" : "show details"}
      </button>

      {open && (
        <div className="mt-2 space-y-2 border-t border-slate-100 pt-2 text-xs text-slate-500">
          <p>{metric.definition}</p>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
            <dt className="text-slate-400">Source</dt>
            <dd>{metric.source} <span className="text-slate-400">(target integration — data shown is a generated sample)</span></dd>
            <dt className="text-slate-400">Owner</dt>
            <dd>{metric.owner}</dd>
            <dt className="text-slate-400">Action trigger</dt>
            <dd className="col-span-2">{metric.actionTrigger}</dd>
          </dl>
          {linkedFeatures.length > 0 && (
            <div>
              <div className="text-slate-400">Linked features</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {linkedFeatures.map((f) => (
                  <span key={f.key} className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">
                    {f.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
