import { formatTimestamp } from "@/lib/validation";
import { PERSONA_LABELS, type PersonaSlug } from "@/lib/schemas/findings";
import type { IngestionSummary } from "@/lib/db/queries";
import type { Theme } from "@/lib/feedback-themes";

export interface PersonaKnowledgeBase {
  slug: string;
  name: string;
  title: string;
  created: string | null;
  jtbdCount: number;
  corpusCount: number;
  feedbackCount: number;
}

function personaLabel(slug: string | null): string {
  if (!slug) return "Unmapped";
  return PERSONA_LABELS[slug as PersonaSlug] ?? slug;
}

/**
 * Planning-screen ingestion panel. Shows connected feedback sources (with counts
 * + last-updated) alongside available-but-not-connected connector targets, the
 * persona knowledge bases and when they were established, and keyword-clustered
 * themes presented strictly as PROPOSED persona updates pending human approval.
 */
export default function IngestionPanel({
  summary,
  themes,
  personas,
}: {
  summary: IngestionSummary;
  themes: Theme[];
  personas: PersonaKnowledgeBase[];
}) {
  const connected = summary.sources.filter((s) => s.connected);
  const available = summary.sources.filter((s) => !s.connected);

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
        <h2 className="text-sm font-semibold">Customer feedback ingestion</h2>
        <span className="text-xs text-slate-400">
          {summary.totalItems} item{summary.totalItems === 1 ? "" : "s"} ·{" "}
          {connected.length} source{connected.length === 1 ? "" : "s"} connected
        </span>
      </div>

      {summary.totalItems === 0 ? (
        <p className="px-5 py-4 text-sm text-slate-500">
          No feedback ingested yet. Run{" "}
          <code>node bin/run.mjs npx tsx runner/publish-feedback.ts</code> to load the demo
          corpus, or <code>runner/scrape-reviews.ts</code> for a live scrape.
        </p>
      ) : (
        <div className="space-y-6 px-5 py-4">
          {/* Sources */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {connected.map((s) => (
              <div
                key={s.source}
                className="rounded-lg border border-emerald-200 bg-emerald-50/40 px-4 py-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-800">{s.label}</span>
                  <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200">
                    {s.kind === "scraped" ? "scraped" : "connected"}
                  </span>
                </div>
                <div className="mt-1 text-2xl font-semibold text-slate-900">{s.count}</div>
                <div className="text-xs text-slate-500">
                  updated {formatTimestamp(s.lastUpdated) || "—"}
                </div>
              </div>
            ))}
            {available.map((s) => (
              <div
                key={s.source}
                className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-500">{s.label}</span>
                  <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500 ring-1 ring-slate-200">
                    available
                  </span>
                </div>
                <div className="mt-1 text-xs text-slate-400">{s.note}</div>
                <div className="mt-2 text-[11px] uppercase tracking-wide text-slate-400">
                  connector target — not connected
                </div>
              </div>
            ))}
          </div>

          {/* Persona knowledge bases */}
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Persona knowledge bases
            </h3>
            <div className="grid gap-3 sm:grid-cols-3">
              {personas.map((p) => (
                <div key={p.slug} className="rounded-lg border border-slate-200 px-4 py-3">
                  <div className="text-sm font-medium text-slate-800">{p.name}</div>
                  <div className="truncate text-xs text-slate-500" title={p.title}>
                    {p.title}
                  </div>
                  <dl className="mt-2 space-y-0.5 text-xs text-slate-500">
                    <div className="flex justify-between">
                      <dt>Created</dt>
                      <dd className="text-slate-700">{p.created ?? "—"}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>Corpus docs</dt>
                      <dd className="text-slate-700">{p.corpusCount}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>Mapped feedback</dt>
                      <dd className="text-slate-700">{p.feedbackCount}</dd>
                    </div>
                  </dl>
                </div>
              ))}
            </div>
          </div>

          {/* Proposed themes */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Emerging themes
              </h3>
              <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-amber-200">
                proposed persona updates · pending approval
              </span>
            </div>
            <p className="mb-3 text-xs text-slate-500">
              Keyword-clustered from ingested feedback. These are suggestions only — persona
              docs stay the human-curated source of truth and are never auto-updated.
            </p>
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {themes.map((t) => (
                <li key={t.key} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
                  <span className="text-sm font-medium text-slate-800">{t.label}</span>
                  {t.personaAffinity && (
                    <span className="inline-flex rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 ring-1 ring-indigo-200">
                      → {personaLabel(t.personaAffinity)}
                    </span>
                  )}
                  <span className="ml-auto flex items-center gap-3 text-xs text-slate-500">
                    <span>{t.count} mentions</span>
                    {t.avgRating !== null && <span>avg {t.avgRating.toFixed(1)}★</span>}
                  </span>
                  <p className="w-full text-xs text-slate-500">{t.description}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}
