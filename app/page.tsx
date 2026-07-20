import { getIngestionSummary, getPersonaFindingCounts, getPushSummary, getRunDetail, listRunsWithCounts } from "@/lib/db/queries";
import { clusterThemes } from "@/lib/feedback-themes";
import { computeAccuracy } from "@/lib/reviews";
import { PERSONAS, ROOT_CAUSE_LABELS, type PersonaSlug, type RootCause } from "@/lib/schemas/findings";
import { PERSONA_COLORS, PERSONA_SHORT } from "@/lib/persona-colors";
import FeedbackSources, { type FeedbackSourceChip } from "@/components/IngestionPanel";
import PlanBoard, { type FindingRow, type PersonaChip } from "@/components/PlanBoard";

export const dynamic = "force-dynamic";

const VERDICT_META: Record<
  "kill" | "fix" | "double_down",
  { label: string; color: string; bg: string; bd: string }
> = {
  kill: { label: "Kill", color: "#cc3b46", bg: "rgba(204,59,70,0.09)", bd: "rgba(204,59,70,0.3)" },
  fix: { label: "Fix", color: "#b07714", bg: "rgba(176,119,20,0.1)", bd: "rgba(176,119,20,0.32)" },
  double_down: { label: "Double Down", color: "#1f9d63", bg: "rgba(31,157,99,0.1)", bd: "rgba(31,157,99,0.3)" },
};

const ORIGIN_META: Record<string, { label: string; color: string; bg: string; bd: string }> = {
  human: { label: "Human", color: "#6d4bd0", bg: "rgba(109,75,208,0.09)", bd: "rgba(109,75,208,0.3)" },
  agent: { label: "Agent", color: "#2b5bd7", bg: "rgba(43,91,215,0.08)", bd: "rgba(43,91,215,0.3)" },
};

const STATUS_PILL: Record<string, { bg: string; color: string; bd: string; dot: string }> = {
  completed: { bg: "rgba(31,157,99,0.1)", color: "#1f7d51", bd: "rgba(31,157,99,0.28)", dot: "#1f9d63" },
  running: { bg: "rgba(43,91,215,0.1)", color: "#2b5bd7", bd: "rgba(43,91,215,0.28)", dot: "#2b5bd7" },
  claimed: { bg: "rgba(43,91,215,0.1)", color: "#2b5bd7", bd: "rgba(43,91,215,0.28)", dot: "#2b5bd7" },
  failed: { bg: "rgba(204,59,70,0.09)", color: "#b6353f", bd: "rgba(204,59,70,0.3)", dot: "#cc3b46" },
};
const STATUS_FALLBACK = { bg: "#f2ede4", color: "#6b6152", bd: "#e5e0d6", dot: "#98907f" };

function fmtDate(value: Date | string | null): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function fmtUpdated(value: Date | null): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const day = d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return `${day} ${d.toISOString().slice(11, 16)}`;
}

function fmtScore(v: number | null): string {
  return v == null ? "—" : v.toFixed(1);
}

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{ persona?: string }>;
}) {
  const sp = await searchParams;
  const initialPersona = (PERSONAS as readonly string[]).includes(sp.persona ?? "")
    ? (sp.persona as PersonaSlug)
    : null;

  const [runs, ingestion] = await Promise.all([listRunsWithCounts(1), getIngestionSummary()]);
  const latest = runs[0] ?? null;

  const [detail, personaCounts, pushSummary] = latest
    ? await Promise.all([
        getRunDetail(latest.id),
        getPersonaFindingCounts(latest.id),
        getPushSummary(latest.id),
      ])
    : [null, {} as Record<string, number>, { pushed: false, count: 0 }];

  // Feedback sources chip row.
  const sourceChips: FeedbackSourceChip[] = ingestion.sources.map((s) => ({
    source: s.source,
    label: s.label,
    kind: s.kind,
    connected: s.connected,
    count: s.count,
  }));
  const lastUpdated = ingestion.sources
    .map((s) => s.lastUpdated)
    .filter((d): d is Date => d instanceof Date)
    .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

  // Emerging themes (keyword-clustered from ingested feedback — proposed only).
  const themes = clusterThemes(ingestion.items).map((t) => ({
    key: t.key,
    label: t.label,
    affinityColor: t.personaAffinity ? PERSONA_COLORS[t.personaAffinity].color : "#98907f",
    affinityLabel: t.personaAffinity ? PERSONA_SHORT[t.personaAffinity] : "General",
    count: t.count,
    rating: t.avgRating == null ? "—" : t.avgRating.toFixed(1),
  }));

  const personaChips: PersonaChip[] = PERSONAS.map((slug) => ({
    slug,
    label: PERSONA_SHORT[slug],
    color: PERSONA_COLORS[slug].color,
    soft: PERSONA_COLORS[slug].soft,
    bd: PERSONA_COLORS[slug].bd,
    count: personaCounts[slug] ?? 0,
  }));

  let findingRows: FindingRow[] = [];
  let accuracy = computeAccuracy([], []);
  let approved = false;
  let approvedBy: string | null = null;
  let approvedAt: string | null = null;
  let retriesCaught = 0;

  if (detail) {
    const humanReviews = new Map(
      detail.reviews
        .filter((r) => r.reviewerType === "human")
        .map((r) => [`${r.persona}:${r.findingKey}`, r.verdict as "up" | "down"]),
    );

    accuracy = computeAccuracy(
      detail.findings.map((f) => ({
        key: f.key,
        persona: f.persona,
        origin: f.origin,
        specificityScore: f.specificityScore,
        actionabilityScore: f.actionabilityScore,
      })),
      detail.reviews.map((r) => ({
        findingKey: r.findingKey,
        persona: r.persona,
        reviewerType: r.reviewerType,
        verdict: r.verdict,
      })),
    );

    retriesCaught = detail.run.retriesCaught ?? 0;
    approved = Boolean(detail.approval);
    approvedBy = detail.approval?.approvedBy ?? null;
    approvedAt = detail.approval ? detail.approval.approvedAt?.toString() ?? null : null;

    findingRows = detail.findings.map((f) => {
      const isLike = f.kind === "like";
      const vk = (f.verdict as "kill" | "fix" | "double_down" | null) ?? (isLike ? "double_down" : "fix");
      const vm = VERDICT_META[vk];
      const om = ORIGIN_META[f.origin] ?? ORIGIN_META.agent;
      const raw = (f.raw ?? {}) as { whyItWorks?: string };
      const slug = f.persona as PersonaSlug;
      return {
        id: f.id,
        key: f.key,
        persona: slug,
        personaLabel: PERSONA_SHORT[slug] ?? f.persona,
        personaColor: PERSONA_COLORS[slug]?.color ?? "#98907f",
        kind: f.kind as "like" | "dislike",
        origin: f.origin,
        originLabel: om.label,
        originColor: om.color,
        originBg: om.bg,
        originBd: om.bd,
        title: f.title,
        quote: isLike ? raw.whyItWorks ?? f.detail : f.customerPain ?? f.detail,
        quoteColor: isLike ? "#1f9d63" : "#cc3b46",
        rootLabel: f.rootCause ? ROOT_CAUSE_LABELS[f.rootCause as RootCause] ?? f.rootCause : null,
        effort: f.effort ?? null,
        firstAction: f.firstAction ?? null,
        detail: f.detail,
        jtbd: f.jtbd ?? null,
        spec: fmtScore(f.specificityScore),
        action: fmtScore(f.actionabilityScore),
        verdictLabel: vm.label,
        verdictColor: vm.color,
        verdictBg: vm.bg,
        verdictBd: vm.bd,
        humanVote: humanReviews.get(`${f.persona}:${f.key}`) ?? null,
        selectedForTicket: Boolean(f.selectedForTicket),
      };
    });
  }

  const status = latest?.status ?? "";
  const pill = STATUS_PILL[status] ?? STATUS_FALLBACK;

  return (
    <div className="mx-auto max-w-[1240px] animate-fadeup px-6 pb-[70px] pt-[26px]">
      {/* 1 — Page header */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="text-[27px] font-bold tracking-[-0.02em] text-ink">Plan</h1>
          <p className="mt-2 max-w-[600px] text-[13.5px] leading-[1.5] text-ink-4">
            Three documented personas drove a live browser through SecurityScorecard. Findings are
            schema-gated, judged, and human-reviewed — the matrix is approved before a single ticket
            ships.
          </p>
        </div>
        <div className="flex flex-col items-end gap-[7px] rounded-[9px] border border-line bg-card px-[13px] py-[10px]">
          <div className="text-right">
            <div className="text-[10.5px] text-ink-5">Last ran</div>
            <div className="text-[12.5px] font-semibold text-ink-3">
              {latest ? fmtDate(latest.startedAt) : "—"}
            </div>
          </div>
          <span
            className="inline-flex items-center gap-[5px] rounded-[5px] border px-[9px] py-[3px] text-[11px] font-semibold"
            style={{ background: pill.bg, color: pill.color, borderColor: pill.bd }}
          >
            <span className="h-[6px] w-[6px] rounded-full" style={{ background: pill.dot }} />
            {status || "no runs"}
          </span>
        </div>
      </div>

      {/* 2 — Feedback sources */}
      <FeedbackSources sources={sourceChips} updatedLabel={fmtUpdated(lastUpdated)} />

      {/* 3–5 — Persona filter + Themes matrix + approval gate */}
      {latest && detail ? (
        <PlanBoard
          runId={latest.id}
          personaChips={personaChips}
          findings={findingRows}
          accuracy={accuracy}
          retriesCaught={retriesCaught}
          approved={approved}
          approvedBy={approvedBy}
          approvedAt={approvedAt}
          initialPersona={initialPersona}
          pushed={pushSummary.pushed}
          pushedCount={pushSummary.count}
        />
      ) : (
        <section className="mb-[18px] rounded-xl border border-line bg-card px-5 py-8 text-center text-sm text-ink-4 shadow-card">
          No evaluation runs yet — run <code>/platform-review</code> in a Claude Code session to
          populate the matrix.
        </section>
      )}

      {/* 6 — Emerging themes */}
      {themes.length > 0 && (
        <section className="mb-4 rounded-[11px] border border-line bg-card">
          <div className="flex items-center gap-[10px] border-b border-line-2 px-[18px] py-[13px]">
            <h3 className="text-[13.5px] font-semibold text-ink">Emerging themes</h3>
            <span className="text-[11px] text-ink-5">keyword-clustered from ingested feedback</span>
            <span
              className="ml-auto rounded-[5px] border px-2 py-[2px] text-[9.5px] font-semibold"
              style={{ background: "rgba(176,119,20,0.1)", color: "#8a5d10", borderColor: "rgba(176,119,20,0.28)" }}
            >
              proposed persona updates · pending approval
            </span>
          </div>
          <div
            className="grid bg-card-subtle"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "1px" }}
          >
            {themes.map((t) => (
              <div key={t.key} className="flex items-center gap-[9px] bg-card px-4 py-[11px]">
                <span className="h-[7px] w-[7px] flex-none rounded-sm" style={{ background: t.affinityColor }} />
                <span className="flex-1 text-[12.5px] text-ink-2">{t.label}</span>
                <span
                  className="rounded border border-line-2 bg-card-alt px-[6px] py-[1px] text-[10px] font-medium"
                  style={{ color: t.affinityColor }}
                >
                  {t.affinityLabel}
                </span>
                <span className="w-[62px] text-right font-mono text-[10.5px] text-ink-5">
                  {t.count} · {t.rating}★
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
