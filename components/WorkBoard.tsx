"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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

const PRIORITY_LABEL: Record<number, string> = { 1: "Urgent", 2: "High", 3: "Medium", 4: "Low" };

function IssueCard({ issue, sub }: { issue: WorkIssue; sub?: boolean }) {
  const track = trackOf(issue);
  return (
    <div
      className={`rounded-lg border bg-white px-3 py-2 text-sm shadow-sm ${
        sub ? "border-slate-100 ml-4" : "border-slate-200"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium text-slate-800">{issue.title}</span>
        {issue.url ? (
          <a
            href={issue.url}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-xs text-indigo-600 hover:underline"
          >
            {issue.identifier}
          </a>
        ) : (
          <span className="shrink-0 text-xs text-slate-400">{issue.identifier}</span>
        )}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
        {issue.priority > 0 && (
          <span className="rounded bg-slate-100 px-1.5 py-0.5">{PRIORITY_LABEL[issue.priority] ?? "—"}</span>
        )}
        {track && (
          <span
            className={`rounded px-1.5 py-0.5 ${
              track === "external"
                ? "bg-sky-50 text-sky-700"
                : "bg-violet-50 text-violet-700"
            }`}
          >
            {track}
          </span>
        )}
        {issue.labels
          .filter((l) => l.startsWith("origin:"))
          .map((l) => (
            <span key={l} className="rounded bg-slate-100 px-1.5 py-0.5">
              {l.replace("origin:", "")}
            </span>
          ))}
        {issue.dueDate && <span className="text-slate-400">due {issue.dueDate}</span>}
      </div>
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
    `px-3 py-1 text-sm ${active ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex overflow-hidden rounded-lg border border-slate-200">
          <button className={seg(view === "kanban")} onClick={() => setView("kanban")}>
            Kanban
          </button>
          <button className={seg(view === "timeline")} onClick={() => setView("timeline")}>
            Timeline
          </button>
        </div>
        <div className="inline-flex overflow-hidden rounded-lg border border-slate-200">
          {(["all", "external", "internal"] as Track[]).map((t) => (
            <button key={t} className={seg(track === t)} onClick={() => setTrack(t)}>
              {t === "all" ? "All" : t === "external" ? "External (product)" : "Internal (OS + role)"}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2 text-xs text-slate-400">
          <span>
            {issueCount} issue{issueCount === 1 ? "" : "s"} ·{" "}
            {lastSyncedAt ? `synced ${formatTimestamp(lastSyncedAt)}` : "never synced"}
          </span>
          <button
            onClick={sync}
            disabled={syncing}
            className="rounded-md border border-slate-300 px-2 py-1 font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            {syncing ? "Syncing…" : "Sync"}
          </button>
        </div>
      </div>
      {syncMsg && <p className="text-xs text-slate-500">{syncMsg}</p>}

      {issues.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center text-sm text-slate-500">
          No Linear issues cached yet. Set <code>LINEAR_API_KEY</code>, seed the board
          (<code>runner/seed-linear.ts</code>) or approve + push a run, then click <b>Sync</b>.
        </div>
      ) : view === "kanban" ? (
        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
          {byState.map(({ state, items }) => (
            <div key={state} className="rounded-xl border border-slate-200 bg-slate-50/60 p-2">
              <div className="mb-2 flex items-center justify-between px-1">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{state}</h3>
                <span className="text-xs text-slate-400">{items.length}</span>
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
            <div key={phase} className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="mb-3 text-sm font-semibold text-slate-800">
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
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="mb-3 text-sm font-semibold text-slate-800">Unscheduled</h3>
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
