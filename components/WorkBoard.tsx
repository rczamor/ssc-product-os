"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { formatTimestamp } from "@/lib/validation";
import type { WorkIssue } from "@/lib/db/queries";
import { buildTimeline, trackOf, type Track } from "@/lib/work-board";

/** Column order for the Kanban; unknown states fall to the end. */
const STATE_ORDER = ["Backlog", "Todo", "In Progress", "In Review", "Done", "Canceled"];
/** Phase label order for the timeline. */
const PHASES = [
  { label: "phase:48h", title: "First 48 hours" },
  { label: "phase:week-1", title: "Week 1" },
  { label: "phase:week-2", title: "Week 2" },
  { label: "phase:week-3", title: "Week 3" },
  { label: "phase:day-30", title: "Day 30" },
];
const PHASE_TITLES: Record<string, string> = Object.fromEntries(
  PHASES.map((p) => [p.label, p.title]),
);

type View = "kanban" | "timeline";

const PRIORITY_LABEL: Record<number, string> = { 1: "P1", 2: "P2", 3: "P3", 4: "P4" };
/** P1=red, P2=amber, P3=blue, P4=gray — matches the mockup's priority palette. */
const PRIORITY_COLOR: Record<number, string> = {
  1: "border-l-red text-red",
  2: "border-l-amber text-amber-dark",
  3: "border-l-accent text-accent",
  4: "border-l-ink-6 text-ink-5",
};

/**
 * Expandable so a ticket's full description — e.g. the role-plan PM-assessment
 * ticket's complete Prompt-5 "how" (spec 5.2) — is readable in this app, not
 * only by following the external Linear link.
 */
function IssueCard({ issue, sub }: { issue: WorkIssue; sub?: boolean }) {
  const track = trackOf(issue);
  const [open, setOpen] = useState(false);
  const prio = PRIORITY_COLOR[issue.priority] ?? "border-l-line-3 text-ink-5";
  return (
    <div
      className={`rounded-lg border border-l-2 bg-card px-3 py-2 text-sm shadow-card ${prio.split(" ")[0]} ${
        sub ? "ml-4 border-line-2" : "border-line"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium text-ink-2">{issue.title}</span>
        {issue.url ? (
          <a
            href={issue.url}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 font-mono text-xs text-accent hover:underline"
          >
            {issue.identifier}
          </a>
        ) : (
          <span className="shrink-0 font-mono text-xs text-ink-5">{issue.identifier}</span>
        )}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-4">
        {issue.priority > 0 && (
          <span className={`rounded bg-card-subtle px-1.5 py-0.5 font-semibold ${prio.split(" ")[1]}`}>
            {PRIORITY_LABEL[issue.priority] ?? "—"}
          </span>
        )}
        {track && (
          <span
            className={`rounded px-1.5 py-0.5 ${
              track === "external" ? "bg-accent/10 text-accent" : "bg-violet/10 text-violet"
            }`}
          >
            {track}
          </span>
        )}
        {issue.labels
          .filter((l) => l.startsWith("origin:"))
          .map((l) => (
            <span key={l} className="rounded bg-card-subtle px-1.5 py-0.5">
              {l.replace("origin:", "")}
            </span>
          ))}
        {issue.dueDate && <span className="font-mono text-ink-5">due {issue.dueDate}</span>}
        {issue.description && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="ml-auto text-accent hover:underline"
          >
            {open ? "hide details" : "show details"}
          </button>
        )}
      </div>
      {open && issue.description && (
        <div className="prose prose-sm mt-2 max-w-none border-t border-line-2 pt-2 text-xs text-ink-3 prose-p:my-1 prose-headings:my-1">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{issue.description}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}

export default function WorkBoard({
  issues,
  lastSyncedAt,
  issueCount,
}: {
  issues: WorkIssue[];
  lastSyncedAt: string | null;
  issueCount: number;
}) {
  const router = useRouter();
  const [track, setTrack] = useState<Track>("all");
  const [view, setView] = useState<View>("kanban");
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const filtered = useMemo(
    () => (track === "all" ? issues : issues.filter((i) => trackOf(i) === track)),
    [issues, track],
  );

  const byState = useMemo(() => {
    const map = new Map<string, WorkIssue[]>();
    for (const i of filtered) {
      const arr = map.get(i.stateName) ?? [];
      arr.push(i);
      map.set(i.stateName, arr);
    }
    // Known states first in workflow order; unknown states after, in insertion order.
    const ordered = [...map.keys()].sort((a, b) => {
      const ia = STATE_ORDER.indexOf(a);
      const ib = STATE_ORDER.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
    return ordered.map((state) => ({ state, items: map.get(state)! }));
  }, [filtered]);

  // See lib/work-board.ts for why the track filter applies to top-level epics
  // only — a sub-issue always follows its epic regardless of the sub-issue's
  // own labels, or it would silently vanish from the Timeline.
  const timeline = useMemo(() => buildTimeline(issues, track, PHASES), [issues, track]);

  async function sync() {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await fetch("/api/linear/sync", { method: "POST" });
      if (res.ok) {
        const j = await res.json();
        setSyncMsg(
          `Synced ${j.synced} issues.${j.skipped > 0 ? ` (${j.skipped} failed to sync and were skipped.)` : ""}`,
        );
        router.refresh();
      } else {
        const j = await res.json().catch(() => null);
        setSyncMsg(j?.error ?? `Sync failed (${res.status}).`);
      }
    } catch {
      setSyncMsg("Network error during sync.");
    } finally {
      setSyncing(false);
    }
  }

  const seg = (active: boolean) =>
    `px-3 py-1 text-sm font-medium ${active ? "bg-ink text-white" : "bg-card text-ink-3 hover:bg-card-alt"}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex overflow-hidden rounded-lg border border-line">
          <button className={seg(view === "kanban")} onClick={() => setView("kanban")}>
            Kanban
          </button>
          <button className={seg(view === "timeline")} onClick={() => setView("timeline")}>
            Timeline
          </button>
        </div>
        <div className="inline-flex overflow-hidden rounded-lg border border-line">
          {(["all", "external", "internal"] as Track[]).map((t) => (
            <button key={t} className={seg(track === t)} onClick={() => setTrack(t)}>
              {t === "all" ? "All" : t === "external" ? "External (product)" : "Internal (OS + role)"}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2 font-mono text-xs text-ink-5">
          <span>
            {issueCount} issue{issueCount === 1 ? "" : "s"} ·{" "}
            {lastSyncedAt ? `synced ${formatTimestamp(lastSyncedAt)}` : "never synced"}
          </span>
          <button
            onClick={sync}
            disabled={syncing}
            className="rounded-md border border-line-3 bg-card px-2 py-1 font-sans font-medium text-ink-3 hover:bg-card-alt disabled:opacity-50"
          >
            {syncing ? "Syncing…" : "Sync"}
          </button>
        </div>
      </div>
      {syncMsg && <p className="text-xs text-ink-4">{syncMsg}</p>}

      {issues.length === 0 ? (
        <div className="rounded-[11px] border border-dashed border-line-3 bg-card-alt px-5 py-8 text-center text-sm text-ink-4">
          No Linear issues cached yet. Set <code>LINEAR_API_KEY</code>, seed the board
          (<code>runner/seed-linear.ts</code>) or approve + push a run, then click <b>Sync</b>.
        </div>
      ) : view === "kanban" ? (
        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
          {byState.map(({ state, items }) => (
            <div key={state} className="rounded-[11px] border border-line bg-card-subtle p-2">
              <div className="mb-2 flex items-center justify-between px-1">
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-ink-4">{state}</h3>
                <span className="font-mono text-xs text-ink-5">{items.length}</span>
              </div>
              <div className="space-y-2">
                {items.map((i) => (
                  <IssueCard key={i.id} issue={i} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-5">
          {timeline.groups.map(({ phase, epics }) => (
            <div key={phase} className="rounded-[11px] border border-line bg-card p-4 shadow-card">
              <h3 className="mb-3 text-sm font-semibold text-ink-2">
                {PHASE_TITLES[phase] ?? phase}
              </h3>
              <div className="space-y-3">
                {epics.map(({ epic, children }) => (
                  <div key={epic.id}>
                    <IssueCard issue={epic} />
                    {children.length > 0 && (
                      <div className="mt-2 space-y-1.5">
                        {children.map((c) => (
                          <IssueCard key={c.id} issue={c} sub />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
          {timeline.unscheduled.length > 0 && (
            <div className="rounded-[11px] border border-line bg-card p-4 shadow-card">
              <h3 className="mb-3 text-sm font-semibold text-ink-2">Unscheduled</h3>
              <div className="space-y-2">
                {timeline.unscheduled.map((i) => (
                  <IssueCard key={i.id} issue={i} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
