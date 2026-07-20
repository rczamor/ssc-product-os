import type { Accuracy } from "@/lib/reviews";

function Stat({
  value,
  valueClass,
  label,
  detail,
}: {
  value: string;
  valueClass: string;
  label: string;
  detail?: string;
}) {
  return (
    <span>
      <span className={`font-mono font-semibold ${valueClass}`}>{value}</span> {label}
      {detail && <span className="text-ink-5"> ({detail})</span>}
    </span>
  );
}

/**
 * The "what the AI got right / how we caught what it didn't" evidence strip
 * (Prompt-4 material). Human agree-rate on agent findings, the judge's mean
 * specificity/actionability, and the schema-gate guarantee — computed from real
 * run data (lib/reviews.computeAccuracy).
 *
 * Two presentations share the same numbers:
 *  - `variant="card"` (default, run-detail page) — a standalone rounded card.
 *  - `variant="strip"` (Plan matrix) — a borderless inline band that slots
 *    between the matrix header and body, with the run's retries-caught count.
 */
export default function AccuracyStrip({
  accuracy,
  variant = "card",
  retriesCaught = 0,
}: {
  accuracy: Accuracy;
  variant?: "card" | "strip";
  retriesCaught?: number;
}) {
  const agree = accuracy.agreeRate === null ? "—" : `${Math.round(accuracy.agreeRate * 100)}%`;
  const spec = accuracy.meanSpecificity === null ? "—" : accuracy.meanSpecificity.toFixed(1);
  const act = accuracy.meanActionability === null ? "—" : accuracy.meanActionability.toFixed(1);

  if (variant === "strip") {
    return (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line-2 bg-card-alt px-5 py-[10px] text-[11.5px] text-ink-4">
        <span className="inline-flex items-center gap-[6px] font-semibold text-ink-3">
          <span className="h-[6px] w-[6px] rounded-full bg-accent" />
          AI accuracy &amp; oversight
        </span>
        <span>
          <span className="font-mono font-semibold text-green-dark">{agree}</span> human agree-rate
        </span>
        <span>
          <span className="font-mono font-semibold text-ink-3">
            {spec} / {act}
          </span>{" "}
          judge spec/action
        </span>
        <span>
          <span className="font-mono font-semibold text-ink-3">100%</span> schema-valid on write
        </span>
        <span className="ml-auto text-ink-6">
          {accuracy.agentFindings} agent · {accuracy.humanFindings} human findings ·{" "}
          {retriesCaught} retries caught
        </span>
      </div>
    );
  }

  return (
    <section className="rounded-[11px] border border-line bg-card-subtle px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink">AI accuracy &amp; oversight</h2>
        <span className="font-mono text-xs text-ink-5">
          {accuracy.agentFindings} agent · {accuracy.humanFindings} human findings
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-ink-3">
        <Stat
          value={agree}
          valueClass="text-green-dark"
          label="human agree-rate"
          detail={
            accuracy.humanVotesOnAgent === 0
              ? "no human votes yet"
              : `${accuracy.agreeCount}/${accuracy.humanVotesOnAgent} votes · ${accuracy.agentFindingsReviewed} reviewed`
          }
        />
        <Stat
          value={`${spec} / ${act}`}
          valueClass="text-ink-3"
          label="judge spec/action"
          detail={`${accuracy.judgedCount} findings scored 1-5, LLM-as-judge`}
        />
        <Stat
          value="100%"
          valueClass="text-ink-3"
          label="schema-valid on write"
          detail="zod gate blocks invalid agent output before it persists"
        />
      </div>
    </section>
  );
}
