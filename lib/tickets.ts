import { TICKET_PRIORITY, type Ticket, type TicketDraft } from "@/lib/schemas/ticket";
import type { KfdRow, PersonaSlug } from "@/lib/schemas/findings";
import { clip } from "@/lib/validation";

/** Lowercase slug from arbitrary text, bounded, with a fallback. */
function slugify(text: string, fallback = "item"): string {
  const s = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return s.length >= 3 ? s : fallback;
}

/** Effort → the 30-day phase a matrix ticket lands in (for the timeline view). */
function phaseForEffort(effort: string): string {
  if (effort === "S") return "phase:week-1";
  if (effort === "L") return "phase:week-3";
  return "phase:week-2";
}

// `ensureTicketDraft` reads a run's kfdTable via a raw cast (it's already-
// published, previously-validated deliverable JSON, not re-validated against
// KfdRowSchema on read), and that schema's text fields have no upper bound.
// Rather than trust upstream length, every title/description this module
// builds is clip()'d at the exact point of return so the produced Ticket
// always satisfies TicketSchema's bounds regardless of source text length.

/**
 * Deterministically map an approved Kill/Fix/Double-Down matrix into Linear
 * tickets. This is intentionally a pure, predictable transform (not an LLM):
 * the human already approved the matrix, so the draft must be reproducible and
 * idempotent. Fix/Double-Down rows become epics (firstAction is the first
 * sub-issue, plus a define-acceptance and an instrument-metric sub-issue); Kill
 * rows become single CCB decision issues. All carry track:external + origin:matrix.
 */
export function draftTicketsFromDeliverable(
  kfd: KfdRow[],
  opts: { runId?: string; generatedAt?: string } = {},
): TicketDraft {
  const seenKeys = new Set<string>();
  const uniqueKey = (base: string): string => {
    let key = base;
    let n = 2;
    while (seenKeys.has(key)) key = `${base}-${n++}`.slice(0, 80);
    seenKeys.add(key);
    return key;
  };

  const tickets: Ticket[] = kfd.map((row) => {
    const personas = row.personas as PersonaSlug[];
    const baseLabels = ["track:external", "origin:matrix"];
    const item = clip(row.item, 140); // leaves headroom for a title prefix within the 200 cap
    const customerPain = clip(row.customerPain, 2000);
    const firstAction = clip(row.firstAction, 300);
    const sourceFindingKeys = (row.sourceFindingKeys ?? []).slice(0, 10);

    if (row.verdict === "kill") {
      const key = uniqueKey(`kill-${slugify(row.item)}`);
      const phase = "phase:week-1";
      return {
        type: "decision",
        key,
        title: clip(`CCB decision: kill "${item}"`, 200),
        description: clip(
          `**Proposed for kill** from the approved platform-review matrix.\n\n` +
            `**Customer pain:** ${customerPain}\n\n` +
            `**Personas affected:** ${personas.join(", ")}\n\n` +
            `Bring to the Change Control Board for a kill/keep decision with the ` +
            `account-impact and adoption evidence. Source findings: ` +
            `${sourceFindingKeys.join(", ") || "n/a"}.`,
          6000,
        ),
        personas,
        labels: [...baseLabels, phase],
        priority: TICKET_PRIORITY.medium,
        phase,
      };
    }

    // Fix / Double-Down → epic
    const key = uniqueKey(`${row.verdict === "double_down" ? "dd" : "fix"}-${slugify(row.item)}`);
    const phase = phaseForEffort(row.effort);
    const priority =
      row.verdict === "double_down" ? TICKET_PRIORITY.high : TICKET_PRIORITY.medium;
    return {
      type: "epic",
      key,
      title: clip(row.verdict === "double_down" ? `Double down: ${item}` : `Fix: ${item}`, 200),
      description: clip(
        `**From the approved platform-review matrix (${row.verdict.replace("_", "-")}).**\n\n` +
          `**Customer pain:** ${customerPain}\n\n` +
          `**Root cause:** ${row.rootCause} · **Effort:** ${row.effort} · ` +
          `**Personas:** ${personas.join(", ")}\n\n` +
          `Source findings: ${sourceFindingKeys.join(", ") || "n/a"}.`,
        6000,
      ),
      customerPain,
      rootCause: row.rootCause,
      effort: row.effort,
      personas,
      labels: [...baseLabels, phase],
      priority,
      phase,
      subIssues: [
        {
          title: clip(firstAction, 200),
          description: clip(`First action this week (from the matrix): ${firstAction}`, 2000),
        },
        {
          title: clip(`Define acceptance criteria and owner for "${item}"`, 200),
          description:
            `Write the acceptance criteria, name the owning PM, and size the work so ` +
            `this epic can enter a pod's cycle.`,
        },
        {
          title: clip(`Instrument the success metric for "${item}"`, 200),
          description:
            `Pick the adoption/quality metric this change should move and wire it into ` +
            `the weekly metrics dashboard so impact is measurable.`,
        },
      ],
    };
  });

  return { runId: opts.runId, generatedAt: opts.generatedAt, tickets };
}
