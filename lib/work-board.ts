import type { WorkIssue } from "@/lib/db/queries";

export type Track = "all" | "internal" | "external";

export function trackOf(issue: WorkIssue): "internal" | "external" | null {
  if (issue.labels.includes("track:external")) return "external";
  if (issue.labels.includes("track:internal")) return "internal";
  return null;
}

export function phaseOf(issue: WorkIssue): string | null {
  return issue.labels.find((l) => l.startsWith("phase:")) ?? null;
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
