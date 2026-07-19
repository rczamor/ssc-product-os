import type { Accuracy } from "@/lib/reviews";

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
      <div className="text-2xl font-semibold text-slate-900">{value}</div>
      <div className="text-xs font-medium text-slate-600">{label}</div>
      {sub && <div className="mt-0.5 text-[11px] text-slate-400">{sub}</div>}
    </div>
  );
}

/**
 * The "what the AI got right / how we caught what it didn't" evidence strip
 * (Prompt-4 material). Human agree-rate on agent findings, the judge's mean
 * specificity/actionability, and the schema-gate guarantee — computed from real
 * run data (lib/reviews.computeAccuracy).
 */
export default function AccuracyStrip({ accuracy }: { accuracy: Accuracy }) {
  const agree =
    accuracy.agreeRate === null
      ? "—"
      : `${Math.round(accuracy.agreeRate * 100)}%`;

  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">AI accuracy &amp; oversight</h2>
        <span className="text-xs text-slate-400">
          {accuracy.agentFindings} agent · {accuracy.humanFindings} human findings
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Human agree-rate on agent findings"
          value={agree}
          sub={
            accuracy.humanVotesOnAgent === 0
              ? "no human votes yet"
              : `${accuracy.agreeCount}/${accuracy.humanVotesOnAgent} votes · ${accuracy.agentFindingsReviewed} reviewed`
          }
        />
        <Stat
          label="Mean judge specificity"
          value={accuracy.meanSpecificity === null ? "—" : accuracy.meanSpecificity.toFixed(2)}
          sub={`${accuracy.judgedCount} findings scored 1–5`}
        />
        <Stat
          label="Mean judge actionability"
          value={accuracy.meanActionability === null ? "—" : accuracy.meanActionability.toFixed(2)}
          sub="LLM-as-judge, per finding"
        />
        <Stat
          label="Schema-valid on write"
          value="100%"
          sub="zod gate blocks invalid agent output before it persists"
        />
      </div>
    </section>
  );
}
