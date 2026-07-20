import { HEALTH_STATES, HEALTH_STATE_LABELS, type HealthState } from "@/lib/schemas/metrics";
import type { HealthBoard as HealthBoardData, HealthFeature } from "@/lib/metrics";

/** Column accent per health state (mockup swatch colors). Amber is used here and
 *  only here — it is the "shipped-not-adopted" state, never a tripped signal. */
const STATE_COLOR: Record<HealthState, string> = {
  "strategic-growing": "#1f9d63",
  "valuable-but-hidden": "#2b5bd7",
  "critical-to-few": "#6d4bd0",
  "shipped-not-adopted": "#b07714",
  "legacy-kill": "#cc3b46",
};

/** ↑ when a feature reclassified to a healthier state, ↓ when it declined.
 *  HEALTH_STATES is ordered best→worst, so a lower index is an improvement. */
function moverArrow(f: HealthFeature["feature"]): "↑" | "↓" | null {
  if (!f.previousHealthState || f.previousHealthState === f.health_state) return null;
  return HEALTH_STATES.indexOf(f.health_state) < HEALTH_STATES.indexOf(f.previousHealthState)
    ? "↑"
    : "↓";
}

/** Metric 14 (Feature Portfolio Health) — a categorical board, not a time series. */
export default function HealthBoard({ board }: { board: HealthBoardData }) {
  return (
    <section className="mt-[22px] overflow-hidden rounded-[12px] border border-line bg-card">
      <div className="flex items-center gap-[10px] border-b border-line-2 px-[18px] py-[15px]">
        <h2 className="text-[15px] font-bold text-ink">Feature Portfolio Health</h2>
        <span className="text-[11px] text-ink-5">
          metric 14 · feature taxonomy · <span className="font-mono">data/feature-taxonomy.json</span>
        </span>
        <span className="ml-auto text-[11px] text-ink-6">
          {board.totalFeatures} features · reclassified monthly, movers weekly
        </span>
      </div>

      <div className="grid grid-cols-5">
        {board.entries.map((entry) => {
          const color = STATE_COLOR[entry.state];
          return (
            <div key={entry.state} className="border-r border-card-subtle px-[13px] py-[14px]">
              <div className="mb-[11px] flex items-center gap-[7px]">
                <span
                  className="h-2 w-2 rounded-[2px]"
                  style={{ background: color }}
                />
                <span className="text-[11.5px] font-semibold leading-[1.2] text-ink">
                  {HEALTH_STATE_LABELS[entry.state]}
                </span>
              </div>
              <div className="flex flex-col gap-[7px]">
                {entry.features.map(({ feature, tripped }) => {
                  const mover = moverArrow(feature);
                  return (
                    <div
                      key={feature.key}
                      className="rounded-[6px] border border-line-2 bg-card-alt px-[9px] py-[8px]"
                    >
                      <div className="flex items-start gap-[5px]">
                        <span className="text-[11.5px] font-medium leading-[1.3] text-ink-2">
                          {feature.name}
                        </span>
                        {mover && (
                          <span
                            className="ml-auto text-[11px] font-bold"
                            style={{ color }}
                          >
                            {mover}
                          </span>
                        )}
                      </div>
                      <div className="mt-[5px] flex items-center gap-[5px]">
                        <span className="rounded-[3px] border border-line-2 bg-card px-[5px] py-[1px] font-mono text-[9px] text-ink-5">
                          {feature.rhythm_class}
                        </span>
                        <span className="text-[9px] text-ink-6">
                          {feature.value_role.replace(/-driver$/, "")}
                        </span>
                        {tripped && (
                          <span className="ml-auto h-[5px] w-[5px] rounded-full bg-red" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-[14px] border-t border-line-2 px-[18px] py-[11px] text-[10.5px] text-ink-6">
        <span>
          <span className="text-ink-4">rhythm</span> daily-ops · weekly-review · monthly-reporting ·
          quarterly-assessment · event-driven
        </span>
        <span>
          <span className="text-ink-4">value role</span> retention · expansion · table-stakes
        </span>
        <span className="inline-flex items-center gap-[5px]">
          <span className="h-[5px] w-[5px] rounded-full bg-red" />
          tripped a trigger
        </span>
      </div>
    </section>
  );
}
