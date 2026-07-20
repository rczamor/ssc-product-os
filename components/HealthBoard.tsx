import { HEALTH_STATE_LABELS } from "@/lib/schemas/metrics";
import type { HealthBoard as HealthBoardData } from "@/lib/metrics";

const STATE_STYLES: Record<string, string> = {
  "strategic-growing": "border-green/30 bg-green/10 text-green-dark",
  "valuable-but-hidden": "border-accent/30 bg-accent/10 text-accent",
  "critical-to-few": "border-violet/30 bg-violet/10 text-violet",
  "shipped-not-adopted": "border-amber/30 bg-amber/10 text-amber-dark",
  "legacy-kill": "border-red/30 bg-red/10 text-red-dark",
};

/** Metric 14 (Feature Portfolio Health) — a categorical board, not a time series. */
export default function HealthBoard({ board }: { board: HealthBoardData }) {
  return (
    <div className="rounded-[11px] border border-line bg-card p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-mono text-xs text-ink-5">#14</div>
          <h3 className="text-sm font-semibold text-ink">Feature Portfolio Health</h3>
        </div>
        <span className="font-mono text-xs text-ink-5">{board.totalFeatures} features</span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {board.entries.map((e) => (
          <div key={e.state} className={`rounded-lg border px-2 py-2 text-center ${STATE_STYLES[e.state]}`}>
            <div className="font-mono text-xl font-semibold">{e.count}</div>
            <div className="text-[10px] font-medium leading-tight">{HEALTH_STATE_LABELS[e.state]}</div>
          </div>
        ))}
      </div>

      <div className="mt-3 border-t border-line-2 pt-2">
        <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-5">Movers</div>
        {board.movers.length === 0 ? (
          <p className="mt-1 text-xs text-ink-5">No reclassifications since the last snapshot.</p>
        ) : (
          <ul className="mt-1 space-y-1">
            {board.movers.map((m) => (
              <li key={m.feature.key} className="text-xs text-ink-3">
                <span className="font-medium text-ink-2">{m.feature.name}</span>:{" "}
                {HEALTH_STATE_LABELS[m.from]} → {HEALTH_STATE_LABELS[m.to]}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
