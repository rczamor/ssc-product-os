/**
 * "How We Work" — a static visualization of the Product/Engineering Operating
 * System (take-home Prompt 3). Renders at the bottom of the Work page, below the
 * live board, so the cadence that PRODUCES the board is legible next to it.
 *
 * Grounded in the SSC role + culture material: ~120-person org, weekly
 * re-prioritization, the "do it in five days" mantra, and the existing forums
 * (Product Court, Bar Raisers, CCB / release-train sign-off, the monthly
 * product-org meeting, the Friday update). Server component — no interactivity.
 */

interface Ritual {
  text: string;
  key?: string;
}
interface Day {
  abbr: string;
  name: string;
  accent: string;
  headline: string;
  rituals: Ritual[];
}

const WEEK: Day[] = [
  {
    abbr: "Mon",
    name: "Monday",
    accent: "#2b5bd7",
    headline: "Set the week",
    rituals: [
      { text: "Weekly re-prioritization — pods commit the week against the live roadmap", key: "plan" },
      { text: "R/Y/G roll-up: every milestone lands Green, Yellow, or Red before noon" },
      { text: "Friction Index top-3 each get a named owner + first action at standup" },
    ],
  },
  {
    abbr: "Tue",
    name: "Tuesday",
    accent: "#6d4bd0",
    headline: "Build + triage",
    rituals: [
      { text: "Product Court — GTM ↔ Product roadmap triage (bi-weekly)", key: "court" },
      { text: "Blocker sweep opens: anything Yellow gets a recovery plan or escalates" },
    ],
  },
  {
    abbr: "Wed",
    name: "Wednesday",
    accent: "#1f9d63",
    headline: "Quality + adoption",
    rituals: [
      { text: "Bar Raisers — spec + launch quality review, customer evidence required", key: "bar" },
      { text: "Adoption check on last week's ships against their rhythm-class baseline" },
    ],
  },
  {
    abbr: "Thu",
    name: "Thursday",
    accent: "#b07714",
    headline: "Decide + sign off",
    rituals: [
      { text: "Change Control Board — release-train sign-off + scope changes", key: "ccb" },
      { text: "Forced kill/invest calls on shipped-not-adopted + legacy candidates" },
    ],
  },
  {
    abbr: "Fri",
    name: "Friday",
    accent: "#1f7d51",
    headline: "Show progress",
    rituals: [
      { text: "Friday Product & Engineering Update ships (auto-drafted — ↑ Generate Update)", key: "friday" },
      { text: "One win celebrated; risks named before they become Monday's reds" },
    ],
  },
];

const KEEP: Array<{ name: string; why: string }> = [
  { name: "Monday planning + R/Y/G", why: "the one forum that sets the week and surfaces risk early" },
  { name: "Product Court", why: "GTM/Product roadmap triage — keeps the roadmap honest to the market" },
  { name: "Bar Raisers", why: "work-quality bar; no spec ships without customer evidence" },
  { name: "CCB / release sign-off", why: "one decision gate for scope + release, minutes captured" },
  { name: "Monthly product-org meeting", why: "narrative, strategy, and wins for the whole org" },
  { name: "Friday Update (async)", why: "written, not a meeting — read in 3 minutes, no room needed" },
];

const KILL: Array<{ name: string; why: string }> = [
  { name: "Status meetings a dashboard replaces", why: "the Metrics tab + R/Y/G roll-up already answer 'where are we'" },
  { name: "Agenda-less standing 1:1s", why: "keep the ones with a decision or a coaching goal; drop the rest" },
  { name: "Live read-out all-hands", why: "pre-read async, spend the room on debate and decisions" },
  { name: "Duplicate roadmap reviews", why: "Product Court is the single triage forum" },
  { name: "Any meeting with no owner or decision", why: "if it can't name an outcome, it's an email" },
];

const RYG: Array<{ dot: string; label: string; rule: string }> = [
  { dot: "#1f9d63", label: "Green", rule: "On track — no action; keep shipping." },
  { dot: "#b07714", label: "Yellow", rule: "At risk — owner + recovery plan named same day. No silent yellows." },
  { dot: "#cc3b46", label: "Red", rule: "Slipped or blocked — escalated the day it turns, not at the next meeting." },
];

const ESCALATION: Array<{ step: string; sla: string }> = [
  { step: "Pod raises the blocker", sla: "on sight" },
  { step: "PM owns + attempts unblock", sla: "same day" },
  { step: "Product Ops pulls the lever (resourcing, dependency, decision)", sla: "within 24h" },
  { step: "CCB / Sam — cross-team call or trade-off", sla: "within 48h" },
];

const SPINE: Array<{ system: string; feeds: string; accent: string }> = [
  { system: "Jira (PRODF)", feeds: "delivery cadence, R/Y/G milestones, cycle time", accent: "#2b5bd7" },
  { system: "GitHub", feeds: "throughput + AI-code ratio (Span/DORA)", accent: "#6b6152" },
  { system: "Pendo / Heap", feeds: "feature adoption + Listen feedback themes", accent: "#6d4bd0" },
  { system: "Snowflake", feeds: "customer-insights layer — pains, quotes, persona match", accent: "#1f9d63" },
  { system: "Slack", feeds: "blocker signal + where the Friday Update posts", accent: "#b07714" },
];

function Card({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[12px] border border-line bg-card p-[16px]">
      <div className="mb-[13px] flex flex-wrap items-baseline gap-[9px]">
        <h3 className="text-[14px] font-bold text-ink">{title}</h3>
        {hint && <span className="text-[11px] text-ink-5">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

export default function HowWeWork() {
  return (
    <section className="mx-auto mt-[26px] max-w-[1300px] px-6 pb-[80px]">
      {/* Section header */}
      <div className="mb-[18px] border-t border-line-2 pt-[26px]">
        <div className="flex flex-wrap items-baseline gap-[10px]">
          <h2 className="m-0 text-[20px] font-bold tracking-[-0.02em] text-ink">How We Work</h2>
          <span className="font-mono text-[11px] text-ink-6">the Product / Engineering operating system</span>
        </div>
        <p className="mt-2 max-w-[720px] text-[13px] leading-[1.55] text-ink-4">
          ~120 people have to show meaningful progress <em>every week</em> without flying blind. This
          is the rhythm that makes the board above move: what runs on which day, the forums we keep vs.
          kill, how status and blockers escalate, the systems that feed it, and the rule that a feature
          isn&rsquo;t done when it ships &mdash; it&rsquo;s done when it&rsquo;s adopted.
        </p>
      </div>

      {/* Panel 1 — the weekly rhythm */}
      <Card title="The weekly rhythm" hint="one five-day loop, tuned to the &lsquo;do it in five days&rsquo; mantra">
        <div className="grid grid-cols-1 gap-[10px] sm:grid-cols-2 lg:grid-cols-5">
          {WEEK.map((d) => (
            <div key={d.abbr} className="rounded-[10px] border border-line-2 bg-card-alt p-[12px]">
              <div className="mb-[9px] flex items-center gap-[7px]">
                <span
                  className="flex h-[22px] w-[30px] items-center justify-center rounded-[5px] font-mono text-[11px] font-bold text-white"
                  style={{ background: d.accent }}
                >
                  {d.abbr}
                </span>
                <span className="text-[12px] font-semibold text-ink-2">{d.headline}</span>
              </div>
              <ul className="flex flex-col gap-[8px]">
                {d.rituals.map((r, i) => (
                  <li key={i} className="flex gap-[7px] text-[11.5px] leading-[1.4] text-ink-4">
                    <span
                      className="mt-[5px] h-[5px] w-[5px] flex-none rounded-full"
                      style={{ background: r.key ? d.accent : "#c8c1b2" }}
                    />
                    <span>{r.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>

      {/* Panels 2 + 3 — forums, R/Y/G + escalation */}
      <div className="mt-[14px] grid grid-cols-1 gap-[14px] lg:grid-cols-2">
        <Card title="Forums we keep · meetings we kill" hint="fewer rooms, more decisions">
          <div className="grid grid-cols-1 gap-[14px] sm:grid-cols-2">
            <div>
              <div className="mb-[9px] flex items-center gap-[6px] text-[10px] font-semibold uppercase tracking-[0.08em] text-green-dark">
                <span className="h-[6px] w-[6px] rounded-full bg-green" /> Keep
              </div>
              <ul className="flex flex-col gap-[9px]">
                {KEEP.map((k) => (
                  <li key={k.name} className="leading-[1.35]">
                    <div className="text-[12px] font-semibold text-ink-2">{k.name}</div>
                    <div className="text-[11px] text-ink-5">{k.why}</div>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="mb-[9px] flex items-center gap-[6px] text-[10px] font-semibold uppercase tracking-[0.08em] text-red-dark">
                <span className="h-[6px] w-[6px] rounded-full bg-red" /> Kill
              </div>
              <ul className="flex flex-col gap-[9px]">
                {KILL.map((k) => (
                  <li key={k.name} className="leading-[1.35]">
                    <div className="text-[12px] font-semibold text-ink-2 line-through decoration-red/40 decoration-1">
                      {k.name}
                    </div>
                    <div className="text-[11px] text-ink-5">{k.why}</div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>

        <Card title="Status & blocker escalation" hint="no silent yellows; blockers are timeboxed">
          <div className="mb-[14px] flex flex-col gap-[8px]">
            {RYG.map((r) => (
              <div key={r.label} className="flex items-start gap-[9px]">
                <span className="mt-[3px] h-[9px] w-[9px] flex-none rounded-full" style={{ background: r.dot }} />
                <div className="text-[11.5px] leading-[1.4]">
                  <span className="font-semibold text-ink-2">{r.label}</span>{" "}
                  <span className="text-ink-4">&mdash; {r.rule}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="mb-[8px] text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-6">
            When something turns red
          </div>
          <div className="flex flex-col gap-0">
            {ESCALATION.map((e, i) => (
              <div key={i} className="flex items-center gap-[10px]">
                <div className="flex flex-col items-center self-stretch">
                  <span
                    className="flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full font-mono text-[10px] font-bold"
                    style={{ background: "var(--accent-bg)", color: "var(--accent)" }}
                  >
                    {i + 1}
                  </span>
                  {i < ESCALATION.length - 1 && <span className="w-px flex-1 bg-line-3" />}
                </div>
                <div className="flex flex-1 flex-wrap items-baseline justify-between gap-x-3 gap-y-0 pb-[12px]">
                  <span className="text-[12px] text-ink-3">{e.step}</span>
                  <span className="font-mono text-[10.5px] text-ink-6">{e.sla}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Panels 4 + 5 — the data spine + shipped≠done */}
      <div className="mt-[14px] grid grid-cols-1 gap-[14px] lg:grid-cols-[1.35fr_1fr]">
        <Card title="The data spine" hint="every ceremony reads from the same instrumented systems">
          <div className="flex flex-col divide-y divide-line-2">
            {SPINE.map((s) => (
              <div key={s.system} className="flex items-center gap-[12px] py-[9px] first:pt-0 last:pb-0">
                <span
                  className="w-[104px] flex-none rounded-[5px] border border-line bg-card-alt px-[8px] py-[3px] text-center font-mono text-[11px] font-semibold"
                  style={{ color: s.accent }}
                >
                  {s.system}
                </span>
                <span className="text-[12px] text-ink-6">&rarr;</span>
                <span className="text-[12px] leading-[1.4] text-ink-3">{s.feeds}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Shipped ≠ done" hint="released is not the finish line">
          <p className="mb-[14px] text-[12px] leading-[1.5] text-ink-4">
            A feature is &ldquo;done&rdquo; only when it clears its adoption threshold for its rhythm
            class &mdash; not the day it merges. Anything that stalls short flows straight to the CCB
            kill/invest call on Thursday.
          </p>
          <div className="flex items-center gap-[8px]">
            {["Released", "Adopted", "Retained"].map((stage, i) => (
              <div key={stage} className="flex items-center gap-[8px]">
                <span
                  className="rounded-[6px] border px-[10px] py-[6px] text-[11.5px] font-semibold"
                  style={
                    i === 0
                      ? { color: "#6b6152", borderColor: "#e5e0d6", background: "#faf7f1" }
                      : i === 1
                        ? { color: "var(--accent)", borderColor: "var(--accent-bd)", background: "var(--accent-bg)" }
                        : { color: "#1f7d51", borderColor: "rgba(31,157,99,0.3)", background: "rgba(31,157,99,0.1)" }
                  }
                >
                  {stage}
                </span>
                {i < 2 && <span className="font-mono text-[12px] text-ink-6">&rarr;</span>}
              </div>
            ))}
          </div>
          <div className="mt-[12px] rounded-[8px] border border-[rgba(204,59,70,0.22)] bg-[rgba(204,59,70,0.05)] px-[11px] py-[8px] text-[11px] leading-[1.45] text-red-strip">
            Trigger: shipped-not-adopted (&lt;25% D30 reach) or legacy &lt;2% with no tier-1
            dependency &rarr; forced CCB kill/invest decision. Wired into the Measure tab.
          </div>
        </Card>
      </div>
    </section>
  );
}
