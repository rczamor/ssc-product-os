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
 */
export default function AccuracyStrip({ accuracy }: { accuracy: Accuracy }) {
  const agree = accuracy.agreeRate === null ? "—" : `${Math.round(accuracy.agreeRate * 100)}%`;

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
          value={`${accuracy.meanSpecificity === null ? "—" : accuracy.meanSpecificity.toFixed(1)} / ${
            accuracy.meanActionability === null ? "—" : accuracy.meanActionability.toFixed(1)
          }`}
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
