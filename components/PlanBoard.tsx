"use client";

import Link from "next/link";
import { useState } from "react";
import type { Accuracy } from "@/lib/reviews";
import AccuracyStrip from "@/components/AccuracyStrip";
import AddHumanFinding from "@/components/AddHumanFinding";
import ApproveMatrix from "@/components/ApproveMatrix";
import ReviewControls from "@/components/ReviewControls";
import type { PersonaSlug } from "@/lib/schemas/findings";

export interface PersonaChip {
  slug: PersonaSlug;
  label: string;
  color: string;
  soft: string;
  bd: string;
  count: number;
}

export interface FindingRow {
  id: string;
  key: string;
  persona: PersonaSlug;
  personaLabel: string;
  personaColor: string;
  kind: "like" | "dislike";
  origin: string;
  originLabel: string;
  originColor: string;
  originBg: string;
  originBd: string;
  title: string;
  quote: string;
  quoteColor: string;
  rootLabel: string | null;
  effort: string | null;
  firstAction: string | null;
  detail: string;
  jtbd: string | null;
  spec: string;
  action: string;
  verdictLabel: string;
  verdictColor: string;
  verdictBg: string;
  verdictBd: string;
  humanVote: "up" | "down" | null;
  selectedForTicket: boolean;
}

/**
 * The interactive core of the Plan screen: the persona filter row plus the
 * "Themes" matrix (raw findings grouped work / don't-work, with per-finding
 * detail toggles, human votes, the add-a-theme form, and the approval-gate
 * footer). Filtering is client-side and mirrored to `?persona=` so the persona
 * detail page's "Filter matrix to this persona →" deep link lands here.
 */
/** Origin filter values — who authored the finding. */
type OriginFilter = "all" | "agent" | "human";
const ORIGIN_FILTERS: Array<{ key: OriginFilter; label: string; color: string }> = [
  { key: "all", label: "All", color: "#262019" },
  { key: "agent", label: "Agent", color: "#2b5bd7" },
  { key: "human", label: "Human", color: "#6d4bd0" },
];

export default function PlanBoard({
  runId,
  personaChips,
  findings,
  accuracy,
  retriesCaught,
  approved,
  approvedBy,
  approvedAt,
  initialPersona,
  pushed,
  pushedCount,
}: {
  runId: string;
  personaChips: PersonaChip[];
  findings: FindingRow[];
  accuracy: Accuracy;
  retriesCaught: number;
  approved: boolean;
  approvedBy: string | null;
  approvedAt: string | null;
  initialPersona: PersonaSlug | null;
  pushed: boolean;
  pushedCount: number;
}) {
  const [active, setActive] = useState<PersonaSlug | null>(initialPersona);
  const [origin, setOrigin] = useState<OriginFilter>("all");
  const [openDetail, setOpenDetail] = useState<Record<string, boolean>>({});
  // Which themes the human has flagged to convert to Linear tickets. Seeded from
  // the persisted flag; toggling is optimistic (reverts on a failed write).
  const [selected, setSelected] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(findings.map((f) => [f.id, f.selectedForTicket])),
  );
  const selectedCount = Object.values(selected).filter(Boolean).length;

  async function toggleSelect(f: FindingRow) {
    const next = !selected[f.id];
    setSelected((s) => ({ ...s, [f.id]: next }));
    try {
      const res = await fetch(`/api/runs/${runId}/findings/select`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ findingKey: f.key, persona: f.persona, selected: next }),
      });
      if (!res.ok) throw new Error("select failed");
    } catch {
      setSelected((s) => ({ ...s, [f.id]: !next })); // revert
    }
  }

  function setFilter(next: PersonaSlug | null) {
    setActive(next);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", next ? `/?persona=${next}` : "/");
    }
  }

  // Origin counts (agent vs human) drive the source-filter chip labels.
  const agentCount = findings.filter((f) => f.origin !== "human").length;
  const humanCount = findings.filter((f) => f.origin === "human").length;
  const originCount: Record<OriginFilter, number> = {
    all: findings.length,
    agent: agentCount,
    human: humanCount,
  };

  const shown = findings.filter(
    (f) =>
      (active ? f.persona === active : true) &&
      (origin === "all" ? true : origin === "human" ? f.origin === "human" : f.origin !== "human"),
  );
  const likes = shown.filter((f) => f.kind === "like");
  const dislikes = shown.filter((f) => f.kind === "dislike");
  const activeChip = personaChips.find((c) => c.slug === active);

  const row = (f: FindingRow) => {
    const open = Boolean(openDetail[f.id]);
    return (
      <div key={f.id} className="rounded-lg border border-line-2 bg-card-alt px-[15px] py-[13px]">
        <div className="flex items-start gap-3">
          {/* Left column */}
          <div className="min-w-0 flex-1">
            <div className="mb-[7px] flex flex-wrap items-center gap-[6px]">
              <span
                className="inline-flex items-center gap-1 rounded border px-[6px] py-[2px] text-[9.5px] font-semibold uppercase tracking-[0.03em]"
                style={{ background: f.originBg, color: f.originColor, borderColor: f.originBd }}
              >
                <span className="h-[5px] w-[5px] rounded-full" style={{ background: f.originColor }} />
                {f.originLabel}
              </span>
              <span className="inline-flex items-center gap-1 rounded border border-line bg-card px-[6px] py-[1px] text-[10px] font-medium text-ink-4">
                <span className="h-[5px] w-[5px] rounded-full" style={{ background: f.personaColor }} />
                {f.personaLabel}
              </span>
            </div>

            <div className="mb-2 text-pretty text-[14px] font-semibold text-ink">{f.title}</div>

            <div
              className="mb-[10px] rounded-md border border-line-2 bg-card px-[11px] py-2"
              style={{ borderLeft: `2px solid ${f.quoteColor}` }}
            >
              <span className="text-[12px] italic leading-[1.45] text-ink-3">{f.quote}</span>
            </div>

            {(f.rootLabel || f.effort) && (
              <div className="mb-2 flex flex-wrap items-center gap-[6px]">
                {f.rootLabel && (
                  <span className="inline-flex items-baseline gap-1 whitespace-nowrap rounded-[5px] border border-line bg-card px-2 py-[2px] text-[10px]">
                    <span className="text-ink-5">root cause</span>{" "}
                    <span className="font-semibold text-ink-2">{f.rootLabel}</span>
                  </span>
                )}
                {f.effort && (
                  <span className="inline-flex items-baseline gap-1 whitespace-nowrap rounded-[5px] border border-line bg-card px-2 py-[2px] text-[10px]">
                    <span className="text-ink-5">effort</span>{" "}
                    <span className="font-mono font-semibold text-ink-2">{f.effort}</span>
                  </span>
                )}
              </div>
            )}

            {f.firstAction && (
              <div className="flex items-baseline gap-[7px] text-[11.5px] leading-[1.45]">
                <span className="flex-none font-semibold text-ink-5">First action</span>
                <span className="text-ink-2">{f.firstAction}</span>
              </div>
            )}

            {open && (
              <div className="mt-[10px] border-t border-line-2 pt-[10px] text-[12px] leading-[1.55] text-ink-4">
                {f.detail}
                {f.kind === "like" && f.jtbd && <span className="text-ink-5"> · JTBD: {f.jtbd}</span>}
              </div>
            )}

            <button
              type="button"
              onClick={() => setOpenDetail((s) => ({ ...s, [f.id]: !s[f.id] }))}
              className="mt-2 cursor-pointer border-none bg-transparent p-0 text-[11px] font-semibold text-accent hover:text-accent-hover"
            >
              {open ? "Hide detail ▲" : "Show detail ▼"}
            </button>
          </div>

          {/* Right rail */}
          <div className="flex w-[126px] flex-none flex-col gap-2 border-l border-line-2 pl-[13px]">
            <div className="flex gap-[10px]">
              <div className="text-center">
                <div className="font-mono text-[15px] font-bold text-ink-3">{f.spec}</div>
                <div className="text-[9px] text-ink-6">spec.</div>
              </div>
              <div className="text-center">
                <div className="font-mono text-[15px] font-bold text-ink-3">{f.action}</div>
                <div className="text-[9px] text-ink-6">action.</div>
              </div>
            </div>

            <div
              className="rounded-[7px] px-2 py-[7px] text-center"
              style={{ background: f.verdictBg, border: `1px solid ${f.verdictBd}` }}
            >
              <div className="mb-[1px] text-[8px] font-semibold uppercase tracking-[0.08em] text-ink-5">
                Recommend
              </div>
              <div className="text-[13px] font-bold leading-[1.1]" style={{ color: f.verdictColor }}>
                {f.verdictLabel}
              </div>
            </div>

            <ReviewControls
              runId={runId}
              findingKey={f.key}
              persona={f.persona}
              initialVerdict={f.humanVote}
            />

            <button
              type="button"
              onClick={() => toggleSelect(f)}
              aria-pressed={Boolean(selected[f.id])}
              title="Include this theme when the approved matrix is pushed to Linear"
              className="mt-[2px] flex items-center justify-center gap-[5px] rounded-[6px] border px-2 py-[5px] text-[10.5px] font-semibold"
              style={
                selected[f.id]
                  ? { background: "var(--accent-bg)", color: "var(--accent)", borderColor: "var(--accent-bd)" }
                  : { background: "#fff", color: "#6b6152", borderColor: "#e5e0d6" }
              }
            >
              {selected[f.id] ? "✓ In tickets" : "+ Add to ticket"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* PERSONAS filter row */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-6">
          Personas
        </span>
        <button
          type="button"
          onClick={() => setFilter(null)}
          className="cursor-pointer whitespace-nowrap rounded-lg border px-[11px] py-[6px] text-[12px] font-semibold"
          style={
            active
              ? { background: "#fff", color: "#403829", borderColor: "#e5e0d6" }
              : { background: "#262019", color: "#fff", borderColor: "#262019" }
          }
        >
          All
        </button>
        {personaChips.map((c) => {
          const on = active === c.slug;
          return (
            <div
              key={c.slug}
              className="inline-flex items-center gap-[7px] rounded-lg border py-[6px] pl-[11px] pr-[7px]"
              style={{ background: on ? c.soft : "#fff", borderColor: on ? c.color : "#e5e0d6" }}
            >
              <button
                type="button"
                onClick={() => setFilter(on ? null : c.slug)}
                className="inline-flex cursor-pointer items-center gap-[7px]"
              >
                <span className="h-2 w-2 rounded-sm" style={{ background: c.color }} />
                <span
                  className="whitespace-nowrap text-[12px] font-semibold"
                  style={{ color: on ? "#262019" : "#403829" }}
                >
                  {c.label}
                </span>
                <span className="font-mono text-[10.5px] font-medium text-ink-6">{c.count}</span>
              </button>
              <Link
                href={`/personas/${c.slug}`}
                title="View persona detail"
                className="rounded-[5px] px-[7px] py-[2px] text-[10.5px] font-semibold text-accent"
                style={{ background: "var(--accent-bg)" }}
              >
                View↗
              </Link>
            </div>
          );
        })}
        {activeChip && (
          <span className="whitespace-nowrap text-[11.5px] text-ink-5">
            → <span className="font-semibold text-ink-3">{activeChip.label}</span>
          </span>
        )}
      </div>

      {/* SOURCE filter row — agent-generated vs human-authored findings */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-6">
          Source
        </span>
        <div className="inline-flex rounded-lg border border-line bg-card p-[3px]">
          {ORIGIN_FILTERS.map((o) => {
            const on = origin === o.key;
            return (
              <button
                key={o.key}
                type="button"
                onClick={() => setOrigin(o.key)}
                className="flex cursor-pointer items-center gap-[7px] rounded-[6px] px-[11px] py-[5px] text-[12px] font-semibold"
                style={{
                  background: on ? "var(--accent-bg)" : "transparent",
                  color: on ? "var(--accent)" : "#6b6152",
                }}
              >
                {o.key !== "all" && (
                  <span className="h-2 w-2 rounded-sm" style={{ background: o.color }} />
                )}
                {o.label}
                <span className="font-mono text-[10.5px] font-medium text-ink-6">
                  {originCount[o.key]}
                </span>
              </button>
            );
          })}
        </div>
        <span className="whitespace-nowrap text-[11px] text-ink-5">
          agent = persona subagents · human = reviewer-authored
        </span>
      </div>

      {/* THEMES matrix hero */}
      <section className="mb-[18px] overflow-hidden rounded-xl border border-line bg-card shadow-card">
        <div className="flex flex-wrap items-center gap-[11px] border-b border-line-2 px-5 py-[15px]">
          <h2 className="text-base font-bold text-ink">Themes</h2>
          <span className="text-[11.5px] text-ink-5">synthesized deliverable · schema-gated</span>
          <div className="ml-auto flex gap-[6px] font-mono text-[10.5px]">
            <span
              className="rounded-[5px] px-2 py-[2px] text-green-dark"
              style={{ background: "rgba(31,157,99,0.1)" }}
            >
              {likes.length} likes
            </span>
            <span
              className="rounded-[5px] px-2 py-[2px] text-red-dark"
              style={{ background: "rgba(204,59,70,0.09)" }}
            >
              {dislikes.length} dislikes
            </span>
          </div>
        </div>

        <AccuracyStrip accuracy={accuracy} variant="strip" retriesCaught={retriesCaught} />

        <div className="px-5 py-[18px]">
          <div className="mb-[18px]">
            <AddHumanFinding runId={runId} />
          </div>

          <div className="mb-[11px] text-[10.5px] font-semibold uppercase tracking-[0.1em] text-green-dark">
            Things that work
          </div>
          {likes.length === 0 ? (
            <p className="mb-6 text-[12px] text-ink-5">No likes for this filter yet.</p>
          ) : (
            <div className="mb-6 flex flex-col gap-[10px]">{likes.map(row)}</div>
          )}

          <div className="mb-[11px] text-[10.5px] font-semibold uppercase tracking-[0.1em] text-red-dark">
            Things that don&apos;t — with a first action for Monday
          </div>
          {dislikes.length === 0 ? (
            <p className="mb-2 text-[12px] text-ink-5">No dislikes for this filter yet.</p>
          ) : (
            <div className="mb-2 flex flex-col gap-[10px]">{dislikes.map(row)}</div>
          )}
        </div>

        <ApproveMatrix
          runId={runId}
          approved={approved}
          approvedBy={approvedBy}
          approvedAt={approvedAt}
          selectedCount={selectedCount}
          pushed={pushed}
          pushedCount={pushedCount}
        />
      </section>
    </>
  );
}
