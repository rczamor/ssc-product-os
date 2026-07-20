import { HEALTH_STATE_LABELS } from "@/lib/schemas/metrics";
import type { HealthBoard as HealthBoardData } from "@/lib/metrics";

const STATE_STYLES: Record<string, string> = {
  "strategic-growing": "border-emerald-200 bg-emerald-50 text-emerald-800",
  "valuable-but-hidden": "border-sky-200 bg-sky-50 text-sky-800",
  "critical-to-few": "border-violet-200 bg-violet-50 text-violet-800",
  "shipped-not-adopted": "border-amber-200 bg-amber-50 text-amber-800",
  "legacy-kill": "border-red-200 bg-red-50 text-red-800",
};

/** Metric 14 (Feature Portfolio Health) — a categorical board, not a time series. */
export default function HealthBoard({ board }: { board: HealthBoardData }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-xs font-medium text-slate-400">#14</div>
          <h3 className="text-sm font-semibold text-slate-900">Feature Portfolio Health</h3>
        </div>
        <span className="text-xs text-slate-400">{board.totalFeatures} features</span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {board.entries.map((e) => (
          <div key={e.state} className={`rounded-lg border px-2 py-2 text-center ${STATE_STYLES[e.state]}`}>
            <div className="text-xl font-semibold">{e.count}</div>
            <div className="text-[10px] font-medium leading-tight">{HEALTH_STATE_LABELS[e.state]}</div>
          </div>
        ))}
      </div>

      <div className="mt-3 border-t border-slate-100 pt-2">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Movers</div>
        {board.movers.length === 0 ? (
          <p className="mt-1 text-xs text-slate-400">No reclassifications since the last snapshot.</p>
        ) : (
          <ul className="mt-1 space-y-1">
            {board.movers.map((m) => (
              <li key={m.feature.key} className="text-xs text-slate-600">
                <span className="font-medium">{m.feature.name}</span>:{" "}
                {HEALTH_STATE_LABELS[m.from]} → {HEALTH_STATE_LABELS[m.to]}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
