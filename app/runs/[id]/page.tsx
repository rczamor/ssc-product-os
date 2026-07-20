import Link from "next/link";
import { notFound } from "next/navigation";
import { getRunDetail } from "@/lib/db/queries";
import { computeAccuracy } from "@/lib/reviews";
import { PERSONA_LABELS, type PersonaSlug } from "@/lib/schemas/findings";
import { formatTimestamp, isUuid } from "@/lib/validation";
import { PersonaBadge, RootCauseBadge, StatusBadge, VerdictBadge } from "@/components/Badges";
import AccuracyStrip from "@/components/AccuracyStrip";
import ApproveMatrix from "@/components/ApproveMatrix";
import PushToLinear from "@/components/PushToLinear";
import ReviewControls from "@/components/ReviewControls";
import AddHumanFinding from "@/components/AddHumanFinding";

export const dynamic = "force-dynamic";

interface DeliverableItem {
  title: string;
  detail: string;
  personas: PersonaSlug[];
  customerPain?: string;
  rootCause?: string;
  effort?: string;
  firstAction?: string;
}

interface KfdRowShape {
  item: string;
  verdict: string;
  customerPain: string;
  personas: PersonaSlug[];
  rootCause: string;
  effort: string;
  firstAction: string;
}

export default async function RunDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const detail = await getRunDetail(id);
  if (!detail) notFound();
  const {
    run,
    personaEvaluations: evals,
    findings: findingRows,
    deliverable,
    screenshots: shots,
    reviews: reviewRows,
    approval,
  } = detail;

  // Human vote lookup keyed by persona:key, and the accuracy-strip math.
  const humanReviews = new Map(
    reviewRows
      .filter((r) => r.reviewerType === "human")
      .map((r) => [`${r.persona}:${r.findingKey}`, r]),
  );
  const accuracy = computeAccuracy(
    findingRows.map((f) => ({
      key: f.key,
      persona: f.persona,
      origin: f.origin,
      specificityScore: f.specificityScore,
      actionabilityScore: f.actionabilityScore,
    })),
    reviewRows.map((r) => ({
      findingKey: r.findingKey,
      persona: r.persona,
      reviewerType: r.reviewerType,
      verdict: r.verdict,
    })),
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/" className="text-sm text-ink-5 hover:text-ink-3">
          ← runs
        </Link>
        <h1 className="text-lg font-semibold text-ink">Run {run.id.slice(0, 8)}</h1>
        <StatusBadge status={run.status} />
        <span className="text-sm text-ink-4">
          {formatTimestamp(run.startedAt)} · trigger: {run.trigger}
        </span>
        {run.langfuseTraceId && (
          <span className="rounded-md border border-line bg-card-alt px-2 py-0.5 font-mono text-xs text-ink-4">
            langfuse trace: {run.langfuseTraceId}
          </span>
        )}
        {run.error && <span className="text-sm text-red">{run.error}</span>}
      </div>

      <AccuracyStrip accuracy={accuracy} />

      {deliverable && (
        <section className="rounded-[11px] border border-line bg-card p-6 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-ink">Prompt-1 Deliverable</h2>
          </div>
          <div className="mt-4">
            <ApproveMatrix
              runId={run.id}
              approved={Boolean(approval)}
              approvedBy={approval?.approvedBy ?? null}
              approvedAt={approval ? approval.approvedAt?.toString() ?? null : null}
            />
            <PushToLinear runId={run.id} approved={Boolean(approval)} />
          </div>

          <div className="mt-4 grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold text-green-dark">3 things we like</h3>
              <ol className="mt-2 space-y-3">
                {(deliverable.likes as DeliverableItem[]).map((item, i) => (
                  <li key={i} className="rounded-lg border border-green/25 bg-green/[0.04] p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-ink-2">{item.title}</p>
                      <span className="flex shrink-0 gap-1">
                        {item.personas.map((p) => (
                          <PersonaBadge key={p} persona={p} />
                        ))}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-ink-3">{item.detail}</p>
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-red">5 things we do not like</h3>
              <ol className="mt-2 space-y-3">
                {(deliverable.dislikes as DeliverableItem[]).map((item, i) => (
                  <li key={i} className="rounded-lg border border-red/20 bg-red/[0.03] p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-ink-2">{item.title}</p>
                      <span className="flex shrink-0 gap-1">
                        {item.personas.map((p) => (
                          <PersonaBadge key={p} persona={p} />
                        ))}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-ink-3">{item.detail}</p>
                    {item.customerPain && (
                      <p className="mt-1 text-sm italic text-ink-4">“{item.customerPain}”</p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-4">
                      <RootCauseBadge rootCause={item.rootCause ?? null} />
                      {item.effort && <span>Effort: {item.effort}</span>}
                      {item.firstAction && <span>First action: {item.firstAction}</span>}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          <h3 className="mt-8 text-sm font-semibold text-ink">Kill / Fix / Double Down</h3>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="text-[10px] uppercase tracking-[0.08em] text-ink-5">
                <tr className="border-b border-line">
                  <th className="py-2 pr-3 font-semibold">Item</th>
                  <th className="py-2 pr-3 font-semibold">Verdict</th>
                  <th className="py-2 pr-3 font-semibold">Customer pain</th>
                  <th className="py-2 pr-3 font-semibold">Personas</th>
                  <th className="py-2 pr-3 font-semibold">Root cause</th>
                  <th className="py-2 pr-3 font-semibold">Effort</th>
                  <th className="py-2 font-semibold">First action this week</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-2 align-top">
                {(deliverable.kfdTable as KfdRowShape[]).map((row, i) => (
                  <tr key={i}>
                    <td className="py-3 pr-3 font-medium text-ink-2">{row.item}</td>
                    <td className="py-3 pr-3">
                      <VerdictBadge verdict={row.verdict} />
                    </td>
                    <td className="py-3 pr-3 text-ink-3">{row.customerPain}</td>
                    <td className="py-3 pr-3">
                      <span className="flex flex-wrap gap-1">
                        {row.personas.map((p) => (
                          <PersonaBadge key={p} persona={p} />
                        ))}
                      </span>
                    </td>
                    <td className="py-3 pr-3">
                      <RootCauseBadge rootCause={row.rootCause} />
                    </td>
                    <td className="py-3 pr-3 text-ink-3">{row.effort}</td>
                    <td className="py-3 text-ink-3">{row.firstAction}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {(Object.keys(PERSONA_LABELS) as PersonaSlug[]).map((persona) => {
        const evaluation = evals.find((e) => e.persona === persona);
        const personaFindings = findingRows.filter((f) => f.persona === persona);
        const personaShots = shots.filter((s) => s.persona === persona);
        if (!evaluation && personaFindings.length === 0) return null;
        return (
          <section
            key={persona}
            className="rounded-[11px] border border-line bg-card p-6 shadow-card"
          >
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-base font-semibold text-ink">{PERSONA_LABELS[persona]}</h2>
              {evaluation && <StatusBadge status={evaluation.status} />}
              <Link
                href={`/personas#${persona}`}
                className="text-xs text-accent hover:underline"
              >
                persona profile →
              </Link>
            </div>
            {evaluation?.summary && (
              <p className="mt-2 max-w-3xl text-sm text-ink-3">{evaluation.summary}</p>
            )}

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {personaFindings.map((f) => (
                <article
                  key={f.id}
                  className={`rounded-lg border p-4 ${
                    f.kind === "like" ? "border-green/20 bg-green/[0.03]" : "border-red/15 bg-red/[0.02]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-medium text-ink-2">{f.title}</h3>
                    <span className="flex shrink-0 items-center gap-1">
                      <span
                        className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${
                          f.origin === "human"
                            ? "border-accent/28 bg-accent/[0.07] text-accent"
                            : "border-line text-ink-5"
                        }`}
                        title={f.origin === "human" ? "Added by a human reviewer" : "Produced by an agent"}
                      >
                        {f.origin === "human" ? "Human" : "Agent"}
                      </span>
                      <span
                        className={`rounded-md border px-2 py-0.5 text-xs font-semibold ${
                          f.kind === "like" ? "verdict-double_down" : "verdict-kill"
                        }`}
                      >
                        {f.kind}
                        {f.severity ? ` · S${f.severity}` : ""}
                      </span>
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-ink-3">{f.detail}</p>
                  {f.customerPain && (
                    <p className="mt-1 text-sm italic text-ink-4">“{f.customerPain}”</p>
                  )}
                  {f.jtbd && (
                    <p className="mt-1 text-xs text-ink-5">JTBD: {f.jtbd}</p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-4">
                    <RootCauseBadge rootCause={f.rootCause} />
                    {f.effort && <span>Effort: {f.effort}</span>}
                    {f.firstAction && <span>First action: {f.firstAction}</span>}
                    {f.specificityScore != null && (
                      <span className="rounded-md border border-line bg-card-alt px-1.5 py-0.5 font-mono">
                        judge: spec {f.specificityScore} · act {f.actionabilityScore}
                      </span>
                    )}
                  </div>
                  <ReviewControls
                    runId={run.id}
                    findingKey={f.key}
                    persona={f.persona}
                    initialVerdict={
                      (humanReviews.get(`${f.persona}:${f.key}`)?.verdict as
                        | "up"
                        | "down"
                        | undefined) ?? null
                    }
                    initialComment={humanReviews.get(`${f.persona}:${f.key}`)?.comment ?? null}
                  />
                </article>
              ))}
            </div>

            <div className="mt-4">
              <AddHumanFinding runId={run.id} fixedPersona={persona} />
            </div>

            {personaShots.length > 0 && (
              <div className="mt-5">
                <h3 className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-5">
                  Screenshots ({personaShots.length})
                </h3>
                <div className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-4">
                  {personaShots.map((s) => (
                    <a
                      key={s.id}
                      href={`/api/screenshots/${s.id}`}
                      target="_blank"
                      className="group"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/api/screenshots/${s.id}`}
                        alt={s.label}
                        className="aspect-video w-full rounded-lg border border-line object-cover object-top group-hover:border-accent/50"
                        loading="lazy"
                      />
                      <p className="mt-1 truncate text-xs text-ink-4">{s.label}</p>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
