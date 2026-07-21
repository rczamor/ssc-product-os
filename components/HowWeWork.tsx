/**
 * "How We Work" — a static visualization of the Product/Engineering Operating
 * System (take-home Prompt 3). Renders at the bottom of the Work page, below the
 * live board, so the cadence that PRODUCES the board is legible next to it.
 *
 * The operating principle: maximize pod autonomy and time spent shipping quality
 * product, and minimize meetings by moving status/reporting to async + AI agents.
 * Work cascades quarter → month → week; the weekly rhythm is a light Mon/Wed/Fri
 * loop (pod-level, with a short pod-leads roll-up); everything slower than a week
 * (roadmap, learning, business review) runs on its own infrequent cadence; and
 * inbound requests are routed by agents through a portal instead of a meeting.
 * Server component — no interactivity.
 */

interface Ritual {
  text: string;
  /** "pod" = pod-level ceremony · "lead" = the pod-leads roll-up. */
  level?: "pod" | "lead";
}
interface Day {
  abbr: string;
  accent: string;
  headline: string;
  when: string;
  rituals: Ritual[];
}

/** Quarter → month → week: how the work narrows down before planning. */
const CASCADE: Array<{ tag: string; title: string; body: string; accent: string }> = [
  {
    tag: "Quarterly",
    title: "Big Bets",
    body: "A small set of company-level big bets — the outcomes we're willing to concentrate the quarter on.",
    accent: "#2b5bd7",
  },
  {
    tag: "Monthly",
    title: "Priorities",
    body: "Each bet is broken into monthly priorities and epics, to the best of what we know today — revised as we learn.",
    accent: "#6d4bd0",
  },
  {
    tag: "Weekly",
    title: "Planning",
    body: "Pods plan against those priorities and epics — every week's work ladders up to a bet.",
    accent: "#1f9d63",
  },
];

const WEEK: Day[] = [
  {
    abbr: "Mon",
    accent: "#2b5bd7",
    headline: "Plan the week",
    when: "all done before noon",
    rituals: [
      { text: "Pods meet in the morning to plan the week against their epics.", level: "pod" },
      { text: "Pod-leads sync to align on the week's priorities.", level: "lead" },
      { text: "R/Y/G roll-up: every milestone lands Red, Yellow, or Green.", level: "lead" },
      { text: "Blockers addressed, conflicts resolved.", level: "lead" },
      {
        text: "Operational asks raised — what metrics, reporting, and system integrations do we need to build?",
        level: "lead",
      },
    ],
  },
  {
    abbr: "Tue",
    accent: "#98907f",
    headline: "Heads-down build",
    when: "no standing meeting",
    rituals: [{ text: "Pods own delivery. No ceremony — autonomy is the default.", level: "pod" }],
  },
  {
    abbr: "Wed",
    accent: "#1f9d63",
    headline: "Midweek check-in",
    when: "pod + 30-min roll-up",
    rituals: [
      { text: "Pod check-in: a midweek progress report against what we set for the week.", level: "pod" },
      { text: "Call what's going to slip while there's still time to react.", level: "pod" },
      { text: "Pod-leads roll-up — 30 minutes.", level: "lead" },
    ],
  },
  {
    abbr: "Thu",
    accent: "#98907f",
    headline: "Heads-down build",
    when: "no standing meeting",
    rituals: [{ text: "Pods own delivery. Protect the maker time.", level: "pod" }],
  },
  {
    abbr: "Fri",
    accent: "#1f7d51",
    headline: "Weekly wrap-up",
    when: "pod + 30-min roll-up",
    rituals: [
      { text: "Pod demos and a retro.", level: "pod" },
      { text: "Prioritize the work for the following Monday.", level: "pod" },
      { text: "Time to prep for Monday planning — so Monday starts ready.", level: "pod" },
      { text: "Pod-leads roll-up — 30 minutes.", level: "lead" },
    ],
  },
];

/** Everything slower than a week — deliberately infrequent. */
const CADENCES: Array<{ tag: string; name: string; body: string; bullets?: string[] }> = [
  {
    tag: "Monthly",
    name: "Roadmap sync",
    body: "The quarter is already set — we sync on the roadmap only at month boundaries or on a major change, never on a standing biweekly triage. Progress updates flow async in between.",
  },
  {
    tag: "Weekly / biweekly",
    name: "Learning share",
    body: "The team gets together to share what we're learning:",
    bullets: [
      "Experiments we ran and what they taught us",
      "The market — customer conversations + competitive analysis",
      "Our industry and cybersecurity",
      "Other product orgs and the craft of product",
    ],
  },
  {
    tag: "Quarterly / monthly",
    name: "Business review",
    body: "The PM org presents to company leadership: the progress we're making on the product and how it's driving revenue.",
  },
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

/** A tiny pod / pod-leads tag on each weekly ritual. */
function LevelTag({ level }: { level?: "pod" | "lead" }) {
  if (level === "lead")
    return (
      <span
        className="mt-[1px] flex-none rounded-[4px] px-[5px] py-[1px] text-[8.5px] font-semibold uppercase tracking-[0.05em]"
        style={{ background: "var(--accent-bg)", color: "var(--accent)" }}
      >
        pod-leads
      </span>
    );
  return (
    <span className="mt-[1px] flex-none rounded-[4px] border border-line bg-card-alt px-[5px] py-[1px] text-[8.5px] font-semibold uppercase tracking-[0.05em] text-ink-5">
      pod
    </span>
  );
}

/** A left → right chip flow (used for the request portal + reporting pipelines). */
function Flow({ steps }: { steps: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-[8px]">
      {steps.map((s, i) => (
        <div key={s} className="flex items-center gap-[8px]">
          <span
            className="rounded-[6px] border px-[10px] py-[6px] text-[11.5px] font-semibold"
            style={{ color: "var(--accent)", borderColor: "var(--accent-bd)", background: "var(--accent-bg)" }}
          >
            {s}
          </span>
          {i < steps.length - 1 && <span className="font-mono text-[12px] text-ink-6">&rarr;</span>}
        </div>
      ))}
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
        <p className="mt-2 max-w-[760px] text-[13px] leading-[1.55] text-ink-4">
          The rhythm that makes the board above move &mdash; built to maximize pod autonomy and time
          spent shipping quality product, and to minimize meetings. Work cascades from quarterly big
          bets down to the week; the week itself is a light Monday / Wednesday / Friday loop; and
          status, requests, and reporting move to async and AI agents so PMs stay with their pods.
        </p>
      </div>

      {/* Panel 1 — the planning cascade */}
      <Card title="From big bets to the week" hint="quarter → month → week; every week ladders up to a bet">
        <div className="flex flex-col items-stretch gap-[10px] lg:flex-row lg:items-center">
          {CASCADE.map((c, i) => (
            <div key={c.tag} className="flex flex-1 items-center gap-[10px]">
              <div className="flex-1 rounded-[10px] border border-line-2 bg-card-alt p-[13px]">
                <div className="mb-[6px] flex items-center gap-[7px]">
                  <span className="h-[7px] w-[7px] flex-none rounded-full" style={{ background: c.accent }} />
                  <span
                    className="text-[9.5px] font-semibold uppercase tracking-[0.08em]"
                    style={{ color: c.accent }}
                  >
                    {c.tag}
                  </span>
                </div>
                <div className="mb-[4px] text-[13px] font-bold text-ink">{c.title}</div>
                <div className="text-[11.5px] leading-[1.45] text-ink-4">{c.body}</div>
              </div>
              {i < CASCADE.length - 1 && (
                <span className="hidden font-mono text-[15px] text-ink-6 lg:inline">&rarr;</span>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Panel 2 — the weekly rhythm */}
      <div className="mt-[14px]">
        <Card title="The weekly rhythm" hint="pod-level by default, with a short pod-leads roll-up on Mon / Wed / Fri">
          <div className="grid grid-cols-1 gap-[10px] sm:grid-cols-2 lg:grid-cols-5">
            {WEEK.map((d) => (
              <div key={d.abbr} className="rounded-[10px] border border-line-2 bg-card-alt p-[12px]">
                <div className="mb-[3px] flex items-center gap-[7px]">
                  <span
                    className="flex h-[22px] w-[32px] items-center justify-center rounded-[5px] font-mono text-[11px] font-bold text-white"
                    style={{ background: d.accent }}
                  >
                    {d.abbr}
                  </span>
                  <span className="text-[12px] font-semibold text-ink-2">{d.headline}</span>
                </div>
                <div className="mb-[9px] pl-[39px] text-[9.5px] italic text-ink-6">{d.when}</div>
                <ul className="flex flex-col gap-[8px]">
                  {d.rituals.map((r, i) => (
                    <li key={i} className="flex gap-[6px] text-[11.5px] leading-[1.4] text-ink-4">
                      <LevelTag level={r.level} />
                      <span>{r.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-[12px] flex flex-wrap items-center gap-x-[16px] gap-y-[4px] text-[10.5px] text-ink-5">
            <span className="flex items-center gap-[6px]">
              <LevelTag level="pod" /> pod-level ceremony
            </span>
            <span className="flex items-center gap-[6px]">
              <LevelTag level="lead" /> pod-leads roll-up
            </span>
            <span className="text-ink-6">
              Tue &amp; Thu are protected build days — no standing meetings.
            </span>
          </div>
        </Card>
      </div>

      {/* Panels 3 + 4 — slower cadences + the request portal */}
      <div className="mt-[14px] grid grid-cols-1 gap-[14px] lg:grid-cols-[1.25fr_1fr]">
        <Card title="Beyond the week" hint="deliberately infrequent — slower than a week runs on its own cadence">
          <div className="flex flex-col divide-y divide-line-2">
            {CADENCES.map((c) => (
              <div key={c.name} className="py-[12px] first:pt-0 last:pb-0">
                <div className="mb-[4px] flex flex-wrap items-baseline gap-[8px]">
                  <span
                    className="rounded-[5px] border border-line bg-card-alt px-[7px] py-[2px] font-mono text-[9.5px] font-semibold text-ink-4"
                  >
                    {c.tag}
                  </span>
                  <span className="text-[12.5px] font-bold text-ink-2">{c.name}</span>
                </div>
                <div className="text-[11.5px] leading-[1.45] text-ink-4">{c.body}</div>
                {c.bullets && (
                  <ul className="mt-[6px] flex flex-col gap-[4px]">
                    {c.bullets.map((b) => (
                      <li key={b} className="flex gap-[7px] text-[11px] leading-[1.4] text-ink-5">
                        <span className="mt-[6px] h-[4px] w-[4px] flex-none rounded-full bg-line-4" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </Card>

        <Card title="Requests, not meetings" hint="agents triage; we don't convene to route work">
          <p className="mb-[14px] text-[12px] leading-[1.5] text-ink-4">
            Sales and CS requests don&rsquo;t get a standing roadmap-triage meeting. They flow through a
            request portal, and AI agents automatically evaluate, triage, and route each one to the
            appropriate pod. We only convene on the roadmap when something major changes.
          </p>
          <Flow steps={["Request portal", "Agent triage", "Routed to pod"]} />
          <div className="mt-[14px] rounded-[8px] border border-line-2 bg-card-alt px-[11px] py-[8px] text-[11px] leading-[1.45] text-ink-5">
            The old roadmap-triage meeting goes away — the portal + agents replace it, and the pod that
            owns the area picks the request up in its own planning.
          </div>
        </Card>
      </div>

      {/* Panels 5 + 6 — autonomy + automated reporting */}
      <div className="mt-[14px] grid grid-cols-1 gap-[14px] lg:grid-cols-2">
        <Card title="Pods run autonomously" hint="own the outcome, not the meeting">
          <p className="mb-[12px] text-[12px] leading-[1.5] text-ink-4">
            Pods operate with a high degree of autonomy. We&rsquo;re deliberately moving away from
            meetings that exist to make people feel comfortable, and asking PMs to own more of the
            delivery.
          </p>
          <ul className="flex flex-col gap-[8px]">
            {[
              "PMs are responsible for the outcomes they own — with real consequences for not delivering.",
              "Decisions happen inside the pod, not in a cross-team room, wherever possible.",
              "Fewer meetings means more of the PM's week goes to shipping quality product with the pod.",
            ].map((t) => (
              <li key={t} className="flex gap-[8px] text-[12px] leading-[1.45] text-ink-3">
                <span className="mt-[6px] h-[5px] w-[5px] flex-none rounded-full bg-accent" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Reporting is automated, not a meeting" hint="programmatic status → weekly exec roll-up">
          <p className="mb-[14px] text-[12px] leading-[1.5] text-ink-4">
            General reporting is programmatic — status updates are generated inside the systems we
            already use for roadmap and project management. Each pod&rsquo;s updates get consolidated
            and rolled up into an executive-level presentation sent out every week. No status meeting
            produces it.
          </p>
          <Flow steps={["Pod updates (auto)", "Consolidated", "Weekly exec deck"]} />
          <div className="mt-[14px] rounded-[8px] border border-line-2 bg-card-alt px-[11px] py-[8px] text-[11px] leading-[1.45] text-ink-5">
            The more we squash unnecessary meetings and move to async + AI-agent reporting, the more
            brain space PMs have to ship quality product.
          </div>
        </Card>
      </div>
    </section>
  );
}
