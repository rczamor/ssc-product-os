import Link from "next/link";
import { notFound } from "next/navigation";
import { getRunDetail } from "@/lib/db/queries";
import { PERSONA_LABELS, type PersonaSlug } from "@/lib/schemas/findings";
import { formatTimestamp, isUuid } from "@/lib/validation";
import { PersonaBadge, RootCauseBadge, StatusBadge, VerdictBadge } from "@/components/Badges";

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
  const { run, personaEvaluations: evals, findings: findingRows, deliverable, screenshots: shots } =
    detail;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/" className="text-sm text-slate-400 hover:text-slate-600">
          ← runs
        </Link>
        <h1 className="text-lg font-semibold">Run {run.id.slice(0, 8)}</h1>
        <StatusBadge status={run.status} />
        <span className="text-sm text-slate-500">
          {formatTimestamp(run.startedAt)} · trigger: {run.trigger}
        </span>
        {run.langfuseTraceId && (
          <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-500">
            langfuse trace: {run.langfuseTraceId}
          </span>
        )}
        {run.error && <span className="text-sm text-red-600">{run.error}</span>}
      </div>

      {deliverable && (
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold">Prompt-1 Deliverable</h2>

          <div className="mt-4 grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold text-emerald-700">3 things we like</h3>
              <ol className="mt-2 space-y-3">
                {(deliverable.likes as DeliverableItem[]).map((item, i) => (
                  <li key={i} className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium">{item.title}</p>
                      <span className="flex shrink-0 gap-1">
                        {item.personas.map((p) => (
                          <PersonaBadge key={p} persona={p} />
                        ))}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{item.detail}</p>
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-red-700">5 things we do not like</h3>
              <ol className="mt-2 space-y-3">
                {(deliverable.dislikes as DeliverableItem[]).map((item, i) => (
                  <li key={i} className="rounded-lg border border-red-100 bg-red-50/40 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium">{item.title}</p>
                      <span className="flex shrink-0 gap-1">
                        {item.personas.map((p) => (
                          <PersonaBadge key={p} persona={p} />
                        ))}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{item.detail}</p>
                    {item.customerPain && (
                      <p className="mt-1 text-sm italic text-slate-500">“{item.customerPain}”</p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <RootCauseBadge rootCause={item.rootCause ?? null} />
                      {item.effort && <span>Effort: {item.effort}</span>}
                      {item.firstAction && <span>First action: {item.firstAction}</span>}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          <h3 className="mt-8 text-sm font-semibold">Kill / Fix / Double Down</h3>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-400">
                <tr className="border-b border-slate-200">
                  <th className="py-2 pr-3 font-medium">Item</th>
                  <th className="py-2 pr-3 font-medium">Verdict</th>
                  <th className="py-2 pr-3 font-medium">Customer pain</th>
                  <th className="py-2 pr-3 font-medium">Personas</th>
                  <th className="py-2 pr-3 font-medium">Root cause</th>
                  <th className="py-2 pr-3 font-medium">Effort</th>
                  <th className="py-2 font-medium">First action this week</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 align-top">
                {(deliverable.kfdTable as KfdRowShape[]).map((row, i) => (
                  <tr key={i}>
                    <td className="py-3 pr-3 font-medium">{row.item}</td>
                    <td className="py-3 pr-3">
                      <VerdictBadge verdict={row.verdict} />
                    </td>
                    <td className="py-3 pr-3 text-slate-600">{row.customerPain}</td>
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
                    <td className="py-3 pr-3">{row.effort}</td>
                    <td className="py-3 text-slate-600">{row.firstAction}</td>
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
            className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-base font-semibold">{PERSONA_LABELS[persona]}</h2>
              {evaluation && <StatusBadge status={evaluation.status} />}
              <Link
                href={`/personas#${persona}`}
                className="text-xs text-indigo-600 hover:underline"
              >
                persona profile →
              </Link>
            </div>
            {evaluation?.summary && (
              <p className="mt-2 max-w-3xl text-sm text-slate-600">{evaluation.summary}</p>
            )}

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {personaFindings.map((f) => (
                <article
                  key={f.id}
                  className={`rounded-lg border p-4 ${
                    f.kind === "like"
                      ? "border-emerald-100 bg-emerald-50/40"
                      : "border-red-100 bg-red-50/30"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-medium">{f.title}</h3>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                        f.kind === "like"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {f.kind}
                      {f.severity ? ` · S${f.severity}` : ""}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{f.detail}</p>
                  {f.customerPain && (
                    <p className="mt-1 text-sm italic text-slate-500">“{f.customerPain}”</p>
                  )}
                  {f.jtbd && (
                    <p className="mt-1 text-xs text-slate-400">JTBD: {f.jtbd}</p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <RootCauseBadge rootCause={f.rootCause} />
                    {f.effort && <span>Effort: {f.effort}</span>}
                    {f.firstAction && <span>First action: {f.firstAction}</span>}
                    {f.specificityScore != null && (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5">
                        judge: spec {f.specificityScore} · act {f.actionabilityScore}
                      </span>
                    )}
                  </div>
                </article>
              ))}
            </div>

            {personaShots.length > 0 && (
              <div className="mt-5">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
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
                        className="aspect-video w-full rounded-lg border border-slate-200 object-cover object-top group-hover:border-indigo-300"
                        loading="lazy"
                      />
                      <p className="mt-1 truncate text-xs text-slate-500">{s.label}</p>
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
