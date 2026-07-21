import type { WorkIssue } from "@/lib/db/queries";
import type { KfdVerdict, PersonaSlug } from "@/lib/schemas/findings";

export type Track = "all" | "internal" | "external";

export function trackOf(issue: WorkIssue): "internal" | "external" | null {
  if (issue.labels.includes("track:external")) return "external";
  if (issue.labels.includes("track:internal")) return "internal";
  return null;
}

export function phaseOf(issue: WorkIssue): string | null {
  return issue.labels.find((l) => l.startsWith("phase:")) ?? null;
}

/** The design relabels the two tracks: internal → "ProductOS", external → "SSC Platform". */
export const TRACK_LABELS: Record<"internal" | "external", string> = {
  internal: "ProductOS",
  external: "SSC Platform",
};
export const TRACK_NOUNS: Record<"internal" | "external", string> = {
  internal: "product-OS build + 30-day role plan",
  external: "approved matrix pushed as epics + a CCB kill",
};

/** Personas attached to an issue via `persona:<slug>` labels (A11). */
export function personasOf(issue: WorkIssue): PersonaSlug[] {
  return issue.labels
    .filter((l) => l.startsWith("persona:"))
    .map((l) => l.slice("persona:".length))
    .filter((s): s is PersonaSlug => s === "ciso" || s === "vrm" || s === "gtm_cs");
}

/** Recommend verdict for an external ticket — a `verdict:<x>` label, else the
 *  title prefix the drafter emits ("Fix:", "Double down:", "CCB decision: kill") (A12). */
export function verdictOf(issue: WorkIssue): KfdVerdict | null {
  const label = issue.labels.find((l) => l.startsWith("verdict:"))?.slice("verdict:".length);
  if (label === "kill" || label === "fix" || label === "double_down") return label;
  const t = issue.title.toLowerCase();
  if (/^ccb decision: kill|^kill:/.test(t)) return "kill";
  if (/^double[ -]down/.test(t)) return "double_down";
  if (/^fix:/.test(t)) return "fix";
  return null;
}

/**
 * Timeline lanes, ordered soonest→latest, with the completed "Shipped" lane
 * pinned to the BOTTOM so already-delivered work sits below the forward-looking
 * pipeline. Issues land by DUE DATE (bucketOf), on a calendar-aware scale:
 * "Today" is due-today/overdue, "Next 48 hours" is the following two days, and
 * "This week" is the remainder of the current calendar week after those first
 * three days — so the lanes track the actual week/month, not a rolling window.
 */
export const TIMELINE_BUCKETS = [
  { key: "today", label: "Today" },
  { key: "next-48h", label: "Next 48 hours" },
  { key: "this-week", label: "This week" },
  { key: "next-week", label: "Next week" },
  { key: "this-month", label: "This month" },
  { key: "next-month", label: "Next month" },
  { key: "this-quarter", label: "This quarter" },
  { key: "shipped", label: "Shipped", sublabel: "os-build · pre day-0" },
] as const;
export type TimelineBucketKey = (typeof TIMELINE_BUCKETS)[number]["key"];

/** Deterministic phase→bucket fallback for issues WITHOUT a due date. */
const PHASE_BUCKET: Record<string, TimelineBucketKey> = {
  "phase:48h": "next-48h",
  "phase:week-1": "this-week",
  "phase:week-2": "next-week",
  "phase:week-3": "this-month",
  "phase:day-30": "this-quarter",
};

/** Midnight (UTC) of a date — due dates are date-only, so UTC keeps the day
 *  boundary stable regardless of the server's local zone. */
function utcMidnight(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
function addDaysUTC(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86_400_000);
}
/** Start (Monday 00:00 UTC) of the calendar week AFTER the one containing `d`. */
function startOfNextWeekUTC(d: Date): Date {
  const dow = d.getUTCDay(); // 0=Sun … 6=Sat
  const daysToNextMonday = ((8 - dow) % 7) || 7;
  return addDaysUTC(utcMidnight(d), daysToNextMonday);
}

/**
 * Which timeline lane an issue lands in, by due date relative to `now`:
 *   today       — due today or overdue
 *   next-48h    — due within the next two days
 *   this-week   — due later in the current calendar week (after those 3 days)
 *   next-week   — due in the next calendar week
 *   this-month  — due later in the current calendar month
 *   next-month  — due in the next calendar month
 *   this-quarter— anything further out
 * The upper bounds are computed as a monotonically non-decreasing sequence
 * (each clamped to at least the previous), so the ranges never overlap and a
 * lane simply empties when a calendar boundary has already passed (e.g. a
 * Friday leaves no "this week" days after the first three). Undated issues fall
 * back to their phase label.
 */
export function bucketOf(issue: WorkIssue, now: Date): TimelineBucketKey {
  if (issue.stateType === "completed" || issue.completedAt) return "shipped";
  if (!issue.dueDate) return PHASE_BUCKET[phaseOf(issue) ?? ""] ?? "this-quarter";

  const due = utcMidnight(new Date(`${issue.dueDate}T00:00:00Z`)).getTime();
  const t0 = utcMidnight(now);
  const uToday = addDaysUTC(t0, 1).getTime(); // due < this → today (overdue + today)
  const u48 = addDaysUTC(t0, 3).getTime(); // the two days after today
  const w1 = startOfNextWeekUTC(now).getTime();
  const w2 = addDaysUTC(new Date(w1), 7).getTime();
  const m1 = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);
  const m2 = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 2, 1);

  // Monotone upper bounds: each lane ends no earlier than the previous one.
  const uThisWeek = Math.max(u48, w1);
  const uNextWeek = Math.max(uThisWeek, w2);
  const uThisMonth = Math.max(uNextWeek, m1);
  const uNextMonth = Math.max(uThisMonth, m2);

  if (due < uToday) return "today";
  if (due < u48) return "next-48h";
  if (due < uThisWeek) return "this-week";
  if (due < uNextWeek) return "next-week";
  if (due < uThisMonth) return "this-month";
  if (due < uNextMonth) return "next-month";
  return "this-quarter";
}

export interface TimelineBucket {
  key: TimelineBucketKey;
  label: string;
  sublabel?: string;
  issues: WorkIssue[];
}

/**
 * Group top-level issues (track-filtered) into the relative-time buckets. All
 * eight buckets are always returned (empty ones included) so the timeline shows
 * "Next month · 0" exactly as the mockup does.
 */
export function buildTimelineBuckets(issues: WorkIssue[], track: Track, now: Date): TimelineBucket[] {
  const topLevel = issues.filter(
    (i) => !i.parentId && (track === "all" || trackOf(i) === track),
  );
  const byBucket = new Map<TimelineBucketKey, WorkIssue[]>();
  for (const i of topLevel) {
    const b = bucketOf(i, now);
    const arr = byBucket.get(b) ?? [];
    arr.push(i);
    byBucket.set(b, arr);
  }
  return TIMELINE_BUCKETS.map((b) => ({
    key: b.key,
    label: b.label,
    sublabel: "sublabel" in b ? b.sublabel : undefined,
    issues: byBucket.get(b.key) ?? [],
  }));
}

export interface TimelineEpic {
  epic: WorkIssue;
  children: WorkIssue[];
}

export interface TimelineGroup {
  phase: string;
  epics: TimelineEpic[];
}

export interface Timeline {
  groups: TimelineGroup[];
  unscheduled: WorkIssue[];
}

/**
 * Build the Timeline view's hierarchy: top-level epics filtered by track,
 * grouped by phase label, each carrying its full child list.
 *
 * The track filter applies ONLY to top-level epics, not to their children —
 * hierarchy is built from the FULL issue set. If a child were filtered
 * independently of its epic (e.g. by the child's own labels), an epic that
 * passes the filter could end up with a child that doesn't (a human relabeled
 * just one sub-issue in Linear), and that child would silently vanish from
 * every view instead of following its epic. A sub-issue's relationship to its
 * epic — not its own labels — is what the Timeline is grouping by.
 */
export function buildTimeline(
  issues: WorkIssue[],
  track: Track,
  phases: Array<{ label: string }>,
): Timeline {
  const childrenByParent = new Map<string, WorkIssue[]>();
  for (const i of issues) {
    if (!i.parentId) continue;
    const arr = childrenByParent.get(i.parentId) ?? [];
    arr.push(i);
    childrenByParent.set(i.parentId, arr);
  }

  const topLevel = issues.filter(
    (i) => !i.parentId && (track === "all" || trackOf(i) === track),
  );

  const groups: TimelineGroup[] = [];
  for (const { label } of phases) {
    const epics = topLevel
      .filter((i) => phaseOf(i) === label)
      .map((epic) => ({ epic, children: childrenByParent.get(epic.id) ?? [] }));
    if (epics.length > 0) groups.push({ phase: label, epics });
  }

  const unscheduled = topLevel.filter((i) => !phaseOf(i));
  return { groups, unscheduled };
}
