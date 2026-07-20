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
 * Relative-time timeline buckets (A15) — the mockup's Now→This quarter lanes,
 * with the completed "Shipped" lane pinned to the BOTTOM so already-delivered
 * work sits below the forward-looking pipeline rather than above it.
 */
export const TIMELINE_BUCKETS = [
  { key: "today", label: "Today" },
  { key: "next-3-days", label: "Next 3 days" },
  { key: "this-week", label: "This week" },
  { key: "next-week", label: "Next week" },
  { key: "this-month", label: "This month" },
  { key: "next-month", label: "Next month" },
  { key: "this-quarter", label: "This quarter" },
  { key: "shipped", label: "Shipped", sublabel: "os-build · pre day-0" },
] as const;
export type TimelineBucketKey = (typeof TIMELINE_BUCKETS)[number]["key"];

/** Deterministic phase→bucket fallback for issues without a due date. */
const PHASE_BUCKET: Record<string, TimelineBucketKey> = {
  "phase:48h": "next-3-days",
  "phase:week-1": "this-week",
  "phase:week-2": "next-week",
  "phase:week-3": "this-month",
  "phase:day-30": "this-quarter",
};

function startOfDayMs(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Which timeline bucket an issue lands in, relative to `now`. */
export function bucketOf(issue: WorkIssue, now: Date): TimelineBucketKey {
  if (issue.stateType === "completed" || issue.completedAt) return "shipped";
  if (issue.dueDate) {
    const due = new Date(`${issue.dueDate}T00:00:00`);
    const days = Math.floor((startOfDayMs(due) - startOfDayMs(now)) / 86_400_000);
    if (days <= 0) return "today";
    if (days <= 3) return "next-3-days";
    if (days <= 7) return "this-week";
    if (days <= 14) return "next-week";
    if (days <= 31) return "this-month";
    if (days <= 62) return "next-month";
    return "this-quarter";
  }
  return PHASE_BUCKET[phaseOf(issue) ?? ""] ?? "this-quarter";
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
