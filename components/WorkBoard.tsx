"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { WorkIssue } from "@/lib/db/queries";
import type { FridayUpdate as FridayUpdateData } from "@/lib/schemas/friday";
import {
  TRACK_LABELS,
  TRACK_NOUNS,
  TIMELINE_BUCKETS,
  bucketOf,
  buildTimelineBuckets,
  personasOf,
  trackOf,
  verdictOf,
  type Track,
} from "@/lib/work-board";
import { PERSONA_COLORS, PERSONA_SHORT } from "@/lib/persona-colors";
import FridayUpdate from "@/components/FridayUpdate";

type View = "timeline" | "kanban";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Jul 12" from an ISO string (UTC-deterministic to avoid hydration drift). */
function fmtMonthDay(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** "synced 2m ago" from lastSyncedAt (client-time; span is hydration-suppressed). */
function relSynced(iso: string | null): string {
  if (!iso) return "not synced yet";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "not synced yet";
  const s = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (s < 60) return "synced just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `synced ${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `synced ${h}h ago`;
  return `synced ${Math.floor(h / 24)}d ago`;
}

/** Priority → label + left-strip / chip color (P1 red, P2 amber, P3 blue, P4 gray). */
const PRIO_COLORS: Record<number, string> = { 1: "#cc3b46", 2: "#b07714", 3: "#2b5bd7", 4: "#98907f" };
function prioMeta(p: number): { label: string; color: string } {
  return { label: p >= 1 && p <= 4 ? `P${p}` : "—", color: PRIO_COLORS[p] ?? "#98907f" };
}

/** Origin label + color from an `origin:<x>` label (matrix blue, os-build stone, role-plan violet). */
const ORIGIN_COLORS: Record<string, string> = { matrix: "#2b5bd7", "os-build": "#7c7568", "role-plan": "#6d4bd0" };
function originOf(issue: WorkIssue): { label: string; color: string } | null {
  const raw = issue.labels.find((l) => l.startsWith("origin:"))?.slice("origin:".length);
  if (!raw) return null;
  return { label: raw, color: ORIGIN_COLORS[raw] ?? "#98907f" };
}

/** Recommendation verdict chrome (Kill/Fix/Double Down). */
const VERDICT_META: Record<string, { label: string; color: string; bg: string; bd: string }> = {
  kill: { label: "Kill", color: "#cc3b46", bg: "rgba(204,59,70,0.09)", bd: "rgba(204,59,70,0.3)" },
  fix: { label: "Fix", color: "#b07714", bg: "rgba(176,119,20,0.1)", bd: "rgba(176,119,20,0.32)" },
  double_down: { label: "Double Down", color: "#1f9d63", bg: "rgba(31,157,99,0.1)", bd: "rgba(31,157,99,0.3)" },
};

/** State-dot color derived from a Linear stateType (A-checklist mapping). */
function stateTypeColor(stateType: string): string {
  switch (stateType) {
    case "completed":
      return "#1f9d63";
    case "canceled":
      return "#cc3b46";
    case "started":
      return "#b07714";
    case "unstarted":
      return "#98907f";
    default:
      return "#98907f"; // backlog / unknown
  }
}

/** The five fixed Kanban columns (labels + dot colors from the mockup). */
const KANBAN_COLUMNS: Array<{ label: string; color: string; accepts: (i: WorkIssue) => boolean }> = [
  { label: "Backlog", color: "#98907f", accepts: (i) => i.stateType === "backlog" },
  { label: "Todo", color: "#6b6152", accepts: (i) => i.stateType === "unstarted" },
  {
    label: "In Progress",
    color: "#2b5bd7",
    accepts: (i) => i.stateType === "started" && !/review/i.test(i.stateName),
  },
  {
    label: "In Review",
    color: "#b07714",
    accepts: (i) => i.stateType === "started" && /review/i.test(i.stateName),
  },
  { label: "Done", color: "#1f9d63", accepts: (i) => i.stateType === "completed" || i.stateType === "canceled" },
];

/** Persona dot descriptors (solid color + short label) for an issue. */
function personaDots(issue: WorkIssue): Array<{ color: string; label: string }> {
  return personasOf(issue).map((slug) => ({ color: PERSONA_COLORS[slug].color, label: PERSONA_SHORT[slug] }));
}

export default function WorkBoard({
  issues,
  lastSyncedAt,
  fridayUpdate,
  now: nowIso,
}: {
  issues: WorkIssue[];
  lastSyncedAt: string | null;
  fridayUpdate: FridayUpdateData | null;
  /** Server render-time timestamp (ISO). Threaded from the server so the
   *  time-relative timeline buckets are identical on SSR and hydration — a
   *  client-side `new Date()` would diverge from the server near a day
   *  boundary and trip a hydration mismatch. */
  now: string;
}) {
  const router = useRouter();
  const [track, setTrack] = useState<Track>("internal");
  const [view, setView] = useState<View>("timeline");
  const [openTicketId, setOpenTicketId] = useState<string | null>(null);
  const [fridayOpen, setFridayOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  // Pull the latest issues from the SSC-ProductOS Linear project into the cache,
  // then re-read the board. 503 (no LINEAR_API_KEY) degrades to a message rather
  // than an error — the board just keeps showing whatever was last cached.
  async function syncBoard() {
    if (syncing) return;
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await fetch("/api/linear/sync", { method: "POST" });
      if (res.status === 503) {
        setSyncMsg("Linear key not set");
      } else if (!res.ok) {
        setSyncMsg("sync failed");
      } else {
        // Refresh the board from the freshly-synced cache. Don't set a sticky
        // message — router.refresh() updates lastSyncedAt so the live "synced
        // just now" label takes over rather than freezing on a fixed count.
        router.refresh();
      }
    } catch {
      setSyncMsg("sync failed");
    } finally {
      setSyncing(false);
    }
  }

  const now = useMemo(() => new Date(nowIso), [nowIso]);

  // Top-level issues per track (the toggle counts + all board views count top-level only).
  const topLevel = useMemo(() => issues.filter((i) => !i.parentId), [issues]);
  const intCount = useMemo(() => topLevel.filter((i) => trackOf(i) === "internal").length, [topLevel]);
  const extCount = useMemo(() => topLevel.filter((i) => trackOf(i) === "external").length, [topLevel]);

  // Gate: the SSC Platform track shows the empty state until the matrix is pushed.
  const gated = track === "external" && extCount === 0;

  const buckets = useMemo(() => buildTimelineBuckets(issues, track, now), [issues, track, now]);

  const childCountOf = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of issues) if (i.parentId) m.set(i.parentId, (m.get(i.parentId) ?? 0) + 1);
    return m;
  }, [issues]);

  const kanbanCols = useMemo(() => {
    const vis = topLevel.filter((i) => trackOf(i) === track);
    return KANBAN_COLUMNS.map((c) => ({ ...c, tickets: vis.filter(c.accepts) }));
  }, [topLevel, track]);

  const openTicket = useMemo(
    () => (openTicketId ? issues.find((i) => i.id === openTicketId) ?? null : null),
    [openTicketId, issues],
  );

  return (
    <div className="mx-auto max-w-[1300px] px-6 pt-[26px] pb-[28px] animate-fadeup">
      {/* Header */}
      <div className="mb-[18px] flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="m-0 text-[27px] font-bold tracking-[-0.02em] text-ink">Work</h1>
          <p className="mt-2 max-w-[660px] text-[13.5px] leading-[1.5] text-ink-4">
            Live from the <span className="font-mono text-ink-3">SSC-ProductOS</span> Linear board. SSC
            Platform = the approved matrix pushed as epics &amp; a CCB kill; ProductOS = the product-OS
            build plus the 30-day role operating plan.
          </p>
        </div>
        <div className="flex items-center gap-[10px]">
          <div className="flex items-center gap-[7px] font-mono text-[11px] text-ink-5">
            <span className="h-[6px] w-[6px] rounded-full bg-green" />
            <span suppressHydrationWarning>{syncMsg ?? relSynced(lastSyncedAt)}</span>
          </div>
          <button
            onClick={syncBoard}
            disabled={syncing}
            title="Pull the latest issues from the SSC-ProductOS Linear project"
            className="flex cursor-pointer items-center gap-[6px] rounded-[8px] border border-line-3 bg-card px-[12px] py-2 text-[12.5px] font-semibold text-ink-2 hover:border-ink-7 disabled:cursor-default disabled:opacity-60"
          >
            <span className={syncing ? "inline-block animate-spin" : "inline-block"}>⟳</span>
            {syncing ? "Syncing…" : "Sync"}
          </button>
          <button
            onClick={() => setFridayOpen(true)}
            className="flex cursor-pointer items-center gap-[7px] rounded-[8px] border border-line-3 bg-card px-[13px] py-2 text-[12.5px] font-semibold text-ink-2 hover:border-ink-7"
          >
            📄 Generate Update
          </button>
        </div>
      </div>

      {/* Toggles */}
      <div className="mb-[18px] flex flex-wrap items-center gap-[14px]">
        <div className="inline-flex rounded-[9px] border border-line bg-card p-[3px]">
          <TrackButton
            active={track === "internal"}
            label={TRACK_LABELS.internal}
            count={intCount}
            onClick={() => setTrack("internal")}
          />
          <TrackButton
            active={track === "external"}
            label={TRACK_LABELS.external}
            count={extCount}
            onClick={() => setTrack("external")}
          />
        </div>
        <span className="text-[11.5px] text-ink-6">track: {TRACK_NOUNS[track === "external" ? "external" : "internal"]}</span>
        <div className="ml-auto inline-flex rounded-[9px] border border-line bg-card p-[3px]">
          <ViewButton active={view === "timeline"} label="Timeline" onClick={() => setView("timeline")} />
          <ViewButton active={view === "kanban"} label="Kanban" onClick={() => setView("kanban")} />
        </div>
      </div>

      {/* Body */}
      {gated ? (
        <GatedEmpty onApprove={() => router.push("/")} />
      ) : view === "timeline" ? (
        <div className="rounded-[12px] border border-line bg-card pt-[6px] pb-[14px]">
          {/* Axis */}
          <div className="flex items-center border-b border-line-2 px-[18px] pt-3 pb-[14px]">
            <span className="font-mono text-[11px] text-ink-6">Now</span>
            <div
              className="relative mx-[10px] h-[2px] flex-1 rounded-[2px]"
              style={{ background: "linear-gradient(90deg,var(--accent-bd),#eee7dc)" }}
            >
              <span className="absolute left-1/2 top-[-3px] h-[8px] w-px bg-line-3" />
            </div>
            <span className="font-mono text-[11px] text-ink-6">This quarter</span>
          </div>
          {/* Lanes */}
          {buckets.map((b) => {
            const isShipped = b.key === "shipped";
            return (
              <div
                key={b.key}
                className={`grid grid-cols-[150px_1fr] border-b border-line-2 px-[18px] py-[13px] last:border-b-0 ${
                  isShipped ? "mt-[6px] border-t border-line bg-card-subtle" : ""
                }`}
              >
                <div className="pr-[14px]">
                  {isShipped ? (
                    <>
                      <div className="text-[12.5px] font-semibold text-green-dark">{b.label}</div>
                      <div className="text-[10.5px] text-ink-6">{b.sublabel}</div>
                    </>
                  ) : (
                    <div className="flex items-center gap-[7px]">
                      <span className="text-[12.5px] font-semibold text-ink">{b.label}</span>
                      <span className="font-mono text-[10px] text-ink-6">{b.issues.length}</span>
                    </div>
                  )}
                </div>
                <div className="flex min-h-[26px] flex-wrap gap-[7px]">
                  {b.issues.map((issue) =>
                    isShipped ? (
                      <ShippedChip key={issue.id} issue={issue} onClick={() => setOpenTicketId(issue.id)} />
                    ) : (
                      <TimelineChip key={issue.id} issue={issue} onClick={() => setOpenTicketId(issue.id)} />
                    ),
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-5 items-start gap-[11px]">
          {kanbanCols.map((c) => (
            <div key={c.label} className="min-h-[90px] rounded-[11px] border border-line-2 bg-card-alt">
              <div className="flex items-center gap-[7px] border-b border-line-2 px-3 py-[11px]">
                <span className="h-[7px] w-[7px] rounded-full" style={{ background: c.color }} />
                <span className="text-[12px] font-semibold text-ink-2">{c.label}</span>
                <span className="ml-auto font-mono text-[11px] text-ink-6">{c.tickets.length}</span>
              </div>
              <div className="flex flex-col gap-2 p-2">
                {c.tickets.map((issue) => (
                  <KanbanCard
                    key={issue.id}
                    issue={issue}
                    subs={childCountOf.get(issue.id) ?? 0}
                    onClick={() => setOpenTicketId(issue.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Ticket slide-over */}
      {openTicket && (
        <TicketPanel
          issue={openTicket}
          allIssues={issues}
          now={now}
          onClose={() => setOpenTicketId(null)}
        />
      )}

      {/* Friday Update slide-over */}
      <FridayUpdate
        open={fridayOpen}
        onClose={() => setFridayOpen(false)}
        update={fridayUpdate}
        boardLastSyncedAt={lastSyncedAt}
      />
    </div>
  );
}

/* ---------------------------------- toggles --------------------------------- */

function TrackButton({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex cursor-pointer items-center gap-[7px] rounded-[6px] border px-[13px] py-[6px] text-[12.5px] font-semibold"
      style={{
        background: active ? "var(--accent-bg)" : "transparent",
        color: active ? "var(--accent)" : "#6b6152",
        borderColor: active ? "var(--accent-bd)" : "#e5e0d6",
      }}
    >
      {label} <span className="font-mono text-[11px] opacity-70">{count}</span>
    </button>
  );
}

function ViewButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="cursor-pointer rounded-[6px] border-none px-[14px] py-[6px] text-[12.5px] font-semibold"
      style={{ background: active ? "#f2ede4" : "transparent", color: active ? "#262019" : "#6b6152" }}
    >
      {label}
    </button>
  );
}

/* ----------------------------------- chips ---------------------------------- */

function ShippedChip({ issue, onClick }: { issue: WorkIssue; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="flex cursor-pointer items-center gap-[7px] rounded-[6px] border border-line-2 bg-card-alt px-[10px] py-[6px] hover:border-line-4"
      style={{ borderLeft: "2px solid #1f9d63" }}
    >
      <span className="font-mono text-[10px] text-ink-5">{issue.identifier}</span>
      <span className="text-[11.5px] text-ink-2">{issue.title}</span>
      {issue.completedAt && (
        <span className="font-mono text-[10px] text-green-mid">{fmtMonthDay(issue.completedAt)}</span>
      )}
    </div>
  );
}

function TimelineChip({ issue, onClick }: { issue: WorkIssue; onClick: () => void }) {
  const prio = prioMeta(issue.priority);
  const origin = originOf(issue);
  const dots = personaDots(issue);
  return (
    <div
      onClick={onClick}
      className="flex cursor-pointer items-center gap-[7px] rounded-[6px] border border-line-2 bg-card-alt px-[10px] py-[6px] hover:border-line-4"
      style={{ borderLeft: `2px solid ${prio.color}` }}
    >
      <span className="font-mono text-[10px] text-ink-5">{issue.identifier}</span>
      <span className="text-[11.5px] text-ink-2">{issue.title}</span>
      {origin && (
        <span
          className="rounded-[3px] border border-line-2 bg-card px-[5px] text-[9.5px] font-medium"
          style={{ color: origin.color }}
        >
          {origin.label}
        </span>
      )}
      {dots.length > 0 && (
        <div className="flex gap-[3px]">
          {dots.map((d, i) => (
            <span key={i} title={d.label} className="h-[8px] w-[8px] rounded-[2px]" style={{ background: d.color }} />
          ))}
        </div>
      )}
    </div>
  );
}

function KanbanCard({ issue, subs, onClick }: { issue: WorkIssue; subs: number; onClick: () => void }) {
  const prio = prioMeta(issue.priority);
  const origin = originOf(issue);
  const dots = personaDots(issue);
  const verdictKey = verdictOf(issue);
  const verdict = verdictKey ? VERDICT_META[verdictKey] : null;
  return (
    <div
      onClick={onClick}
      className="cursor-pointer rounded-[7px] border border-line bg-card p-[10px] hover:border-line-4"
      style={{ borderLeft: `2px solid ${prio.color}` }}
    >
      <div className="mb-[6px] flex items-center gap-[6px]">
        <span className="font-mono text-[10.5px] text-ink-5">{issue.identifier}</span>
        <span
          className="rounded-[3px] bg-card-subtle px-[5px] py-px text-[9px] font-semibold"
          style={{ color: prio.color }}
        >
          {prio.label}
        </span>
        {verdict && (
          <span
            className="ml-auto rounded-[3px] bg-card-alt px-[6px] py-px text-[9px] font-semibold uppercase"
            style={{ color: verdict.color }}
          >
            {verdict.label}
          </span>
        )}
      </div>
      <div className="text-[12.5px] font-medium leading-[1.35] text-ink">{issue.title}</div>
      <div className="mt-2 flex items-center gap-2">
        {origin && (
          <span
            className="rounded-[4px] border border-line-2 bg-card-alt px-[6px] py-px text-[9.5px] font-medium"
            style={{ color: origin.color }}
          >
            {origin.label}
          </span>
        )}
        {subs > 0 && <span className="font-mono text-[10px] text-ink-6">{subs} subs</span>}
        {dots.length > 0 && (
          <div className="ml-auto flex gap-[3px]">
            {dots.map((d, i) => (
              <span key={i} title={d.label} className="h-[8px] w-[8px] rounded-[2px]" style={{ background: d.color }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------- gated empty -------------------------------- */

function GatedEmpty({ onApprove }: { onApprove: () => void }) {
  return (
    <div className="flex flex-col items-center gap-[14px] rounded-[12px] border border-dashed border-line-3 bg-card px-6 py-[56px] text-center">
      <div className="flex h-[44px] w-[44px] items-center justify-center rounded-[10px] bg-[rgba(176,119,20,0.1)]">
        <span className="h-[14px] w-[14px] rounded-[4px] border-2 border-amber" />
      </div>
      <div>
        <div className="text-[15px] font-semibold text-ink">Matrix not approved — 0 issues pushed</div>
        <div className="mt-[5px] max-w-[460px] text-[12.5px] leading-[1.5] text-ink-4">
          Drafting is agentic and already done (<span className="font-mono text-ink-3">tickets.json</span>{" "}
          validated). The deterministic push only fires on a human approval event — the hard gate.
        </div>
      </div>
      <button
        onClick={onApprove}
        className="cursor-pointer rounded-[8px] border-none bg-accent px-4 py-[9px] text-[12.5px] font-semibold text-white hover:brightness-[1.08]"
      >
        ← Approve on Planning to push
      </button>
    </div>
  );
}

/* ------------------------------- ticket panel ------------------------------- */

function TicketPanel({
  issue,
  allIssues,
  now,
  onClose,
}: {
  issue: WorkIssue;
  allIssues: WorkIssue[];
  now: Date;
  onClose: () => void;
}) {
  const prio = prioMeta(issue.priority);
  const origin = originOf(issue);
  const track = trackOf(issue);
  const verdictKey = verdictOf(issue);
  const verdict = verdictKey ? VERDICT_META[verdictKey] : null;
  const dots = personaDots(issue);
  const children = allIssues.filter((i) => i.parentId === issue.id);
  const bucketKey = bucketOf(issue, now);
  const phaseLabel = TIMELINE_BUCKETS.find((b) => b.key === bucketKey)?.label ?? "";

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[41] flex justify-end bg-[rgba(38,32,25,0.4)] backdrop-blur-[2px]"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="h-full w-[520px] max-w-[92vw] overflow-y-auto border-l border-line bg-card shadow-panel animate-fadeup-fast"
      >
        {/* Sticky header */}
        <div className="sticky top-0 flex items-start justify-between gap-3 border-b border-line-2 bg-card px-5 py-4">
          <div className="min-w-0">
            <div className="mb-[5px] flex items-center gap-2">
              <span className="font-mono text-[11px] text-ink-5">{issue.identifier}</span>
              <span
                className="inline-flex items-center gap-[5px] text-[11px] font-semibold"
                style={{ color: stateTypeColor(issue.stateType) }}
              >
                <span className="h-[7px] w-[7px] rounded-full" style={{ background: stateTypeColor(issue.stateType) }} />
                {issue.stateName}
              </span>
              <span
                className="rounded-[4px] bg-card-subtle px-[6px] py-px text-[10px] font-semibold"
                style={{ color: prio.color }}
              >
                {prio.label}
              </span>
            </div>
            <h2 className="m-0 text-[16px] font-bold leading-[1.3] text-ink text-pretty">{issue.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-[26px] w-[26px] flex-none cursor-pointer items-center justify-center rounded-[6px] border border-line bg-card-alt text-[14px] text-ink-4"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="px-5 pt-4 pb-[40px]">
          <div className="mb-[18px] flex flex-wrap gap-[6px]">
            {track && (
              <span className="rounded-[5px] border border-line bg-card-alt px-2 py-[2px] text-[10.5px] text-ink-4">
                {TRACK_LABELS[track]}
              </span>
            )}
            {origin && (
              <span
                className="rounded-[5px] border border-line bg-card-alt px-2 py-[2px] text-[10.5px]"
                style={{ color: origin.color }}
              >
                origin: {origin.label}
              </span>
            )}
            {verdict && (
              <span
                className="rounded-[5px] border px-2 py-[2px] text-[10px] font-bold uppercase"
                style={{ color: verdict.color, background: verdict.bg, borderColor: verdict.bd }}
              >
                {verdict.label}
              </span>
            )}
            {phaseLabel && (
              <span className="rounded-[5px] border border-line bg-card-alt px-2 py-[2px] text-[10.5px] text-ink-4">
                ⏱ {phaseLabel}
              </span>
            )}
            {dots.map((d, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded-[5px] border border-line bg-card-alt px-2 py-[2px] text-[10.5px] text-ink-4"
              >
                <span className="h-[6px] w-[6px] rounded-full" style={{ background: d.color }} />
                {d.label}
              </span>
            ))}
          </div>

          {issue.description && (
            <>
              <div className="mb-[6px] text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-6">
                Description
              </div>
              <div className="prose prose-sm mb-[18px] max-w-none text-[12.5px] leading-[1.6] text-ink-2 prose-p:my-1 prose-headings:my-1">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{issue.description}</ReactMarkdown>
              </div>
            </>
          )}

          {children.length > 0 && (
            <>
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-6">
                Sub-issues <span className="font-mono text-ink-7">{children.length}</span>
              </div>
              <div className="mb-[18px] overflow-hidden rounded-[8px] border border-line-2">
                {children.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-start gap-[9px] border-b border-line-2 bg-card px-3 py-[9px] last:border-b-0"
                  >
                    <span className="mt-px h-[13px] w-[13px] flex-none rounded-[3px] border-[1.5px] border-line-4" />
                    <span className="text-[12px] leading-[1.4] text-ink-2">{c.title}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {issue.url ? (
            <a
              href={issue.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-[6px] text-[12px] font-semibold text-accent"
            >
              Open in Linear ↗
            </a>
          ) : (
            <span className="inline-flex items-center gap-[6px] text-[12px] font-semibold text-ink-6">
              Open in Linear ↗
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
