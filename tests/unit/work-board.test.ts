import { describe, expect, it } from "vitest";
import { bucketOf, buildTimeline, buildTimelineBuckets, phaseOf, trackOf, TIMELINE_BUCKETS } from "@/lib/work-board";
import type { WorkIssue } from "@/lib/db/queries";

const PHASES = [{ label: "phase:week-1" }, { label: "phase:week-2" }];

const issue = (over: Partial<WorkIssue>): WorkIssue => ({
  id: "id",
  identifier: "TRZ-1",
  title: "title",
  description: null,
  stateName: "Todo",
  stateType: "unstarted",
  priority: 0,
  labels: [],
  parentId: null,
  url: null,
  dueDate: null,
  completedAt: null,
  ...over,
});

describe("trackOf / phaseOf", () => {
  it("reads track and phase from labels", () => {
    const i = issue({ labels: ["track:external", "phase:week-1", "origin:matrix"] });
    expect(trackOf(i)).toBe("external");
    expect(phaseOf(i)).toBe("phase:week-1");
  });

  it("returns null when no matching label is present", () => {
    const i = issue({ labels: ["origin:matrix"] });
    expect(trackOf(i)).toBeNull();
    expect(phaseOf(i)).toBeNull();
  });
});

describe("buildTimeline", () => {
  it("a sub-issue follows its epic through the track filter even when its own labels differ", () => {
    // The epic is internal (a role-plan item); a human relabeled just the
    // sub-issue to track:external in Linear. Filtering by "internal" must still
    // show the sub-issue under its epic — the epic's track decides inclusion,
    // not the child's own labels.
    const epic = issue({
      id: "epic-1",
      title: "Role-plan epic",
      labels: ["track:internal", "phase:week-1"],
    });
    const child = issue({
      id: "child-1",
      parentId: "epic-1",
      title: "Relabeled sub-issue",
      labels: ["track:external"],
    });

    const timeline = buildTimeline([epic, child], "internal", PHASES);
    expect(timeline.groups).toHaveLength(1);
    expect(timeline.groups[0].epics).toHaveLength(1);
    expect(timeline.groups[0].epics[0].epic.id).toBe("epic-1");
    // The child must still be present — this is the exact case that regressed
    // when children were filtered independently of their epic.
    expect(timeline.groups[0].epics[0].children.map((c) => c.id)).toEqual(["child-1"]);
  });

  it("excludes an epic (and its children) whose own track doesn't match the filter", () => {
    const epic = issue({ id: "e", labels: ["track:internal", "phase:week-1"] });
    const child = issue({ id: "c", parentId: "e", labels: ["track:internal"] });
    const timeline = buildTimeline([epic, child], "external", PHASES);
    expect(timeline.groups).toHaveLength(0);
  });

  it("groups epics by phase label and buckets unlabeled epics as unscheduled", () => {
    const a = issue({ id: "a", labels: ["phase:week-1"] });
    const b = issue({ id: "b", labels: ["phase:week-2"] });
    const c = issue({ id: "c", labels: [] });
    const timeline = buildTimeline([a, b, c], "all", PHASES);
    expect(timeline.groups.map((g) => g.phase)).toEqual(["phase:week-1", "phase:week-2"]);
    expect(timeline.unscheduled.map((i) => i.id)).toEqual(["c"]);
  });

  it("never shows a sub-issue as a top-level unscheduled item", () => {
    const epic = issue({ id: "e", labels: [] }); // unscheduled epic (no phase)
    const child = issue({ id: "c", parentId: "e", labels: [] });
    const timeline = buildTimeline([epic, child], "all", PHASES);
    expect(timeline.unscheduled.map((i) => i.id)).toEqual(["e"]);
  });
});

describe("buildTimelineBuckets", () => {
  const now = new Date("2026-07-20T12:00:00Z");

  it("pins the Shipped lane to the BOTTOM and routes completed issues into it", () => {
    const done = issue({
      id: "done",
      stateType: "completed",
      completedAt: "2026-07-10T00:00:00.000Z",
    });
    const today = issue({ id: "today", dueDate: "2026-07-20" });

    const buckets = buildTimelineBuckets([done, today], "all", now);

    // Shipped is the last lane (below the forward-looking pipeline), and Today
    // is the first — the reorder that moved completed work to the bottom.
    expect(buckets[buckets.length - 1].key).toBe("shipped");
    expect(buckets[0].key).toBe("today");

    expect(buckets.find((b) => b.key === "shipped")!.issues.map((i) => i.id)).toEqual(["done"]);
    expect(buckets.find((b) => b.key === "today")!.issues.map((i) => i.id)).toEqual(["today"]);
  });
});

describe("bucketOf — calendar-aware, due-date driven", () => {
  // now is Monday 2026-07-20 (so the current calendar week is Mon 07-20 … Sun 07-26).
  const now = new Date("2026-07-20T12:00:00Z");
  const at = (dueDate: string) => bucketOf(issue({ dueDate }), now);

  it("the second lane is 'Next 48 hours' with the expected label", () => {
    expect(TIMELINE_BUCKETS[1].key).toBe("next-48h");
    expect(TIMELINE_BUCKETS[1].label).toBe("Next 48 hours");
  });

  it("Today covers due-today and overdue", () => {
    expect(at("2026-07-20")).toBe("today"); // today
    expect(at("2026-07-18")).toBe("today"); // overdue
  });

  it("Next 48 hours is the following two days", () => {
    expect(at("2026-07-21")).toBe("next-48h"); // +1
    expect(at("2026-07-22")).toBe("next-48h"); // +2
  });

  it("This week is the remainder of the current calendar week after those 3 days", () => {
    expect(at("2026-07-23")).toBe("this-week"); // Thu, still this calendar week
    expect(at("2026-07-26")).toBe("this-week"); // Sun, last day of this calendar week
  });

  it("Next week / months follow the calendar, not a rolling window", () => {
    expect(at("2026-07-27")).toBe("next-week"); // next Monday
    expect(at("2026-08-02")).toBe("next-week"); // next Sunday
    // The current calendar month (July) is fully consumed by the lanes above,
    // so August dues land in Next month, and September+ in This quarter.
    expect(at("2026-08-03")).toBe("next-month");
    expect(at("2026-08-31")).toBe("next-month");
    expect(at("2026-09-15")).toBe("this-quarter");
  });

  it("empties This week once the first three days reach the weekend (a Friday now)", () => {
    const friday = new Date("2026-07-24T12:00:00Z");
    // Fri + the next 48h (Sat, Sun) already spans the rest of the calendar week,
    // so there is no 'this week' remainder — Sun is still within the 48h window.
    expect(bucketOf(issue({ dueDate: "2026-07-26" }), friday)).toBe("next-48h");
    expect(bucketOf(issue({ dueDate: "2026-07-27" }), friday)).toBe("next-week");
  });

  it("falls back to the phase label when an issue has no due date", () => {
    expect(bucketOf(issue({ dueDate: null, labels: ["phase:48h"] }), now)).toBe("next-48h");
    expect(bucketOf(issue({ dueDate: null, labels: ["phase:week-1"] }), now)).toBe("this-week");
    expect(bucketOf(issue({ dueDate: null, labels: [] }), now)).toBe("this-quarter");
  });
});
