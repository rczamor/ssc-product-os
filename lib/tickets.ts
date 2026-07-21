import { TICKET_PRIORITY, type Ticket, type TicketDraft } from "@/lib/schemas/ticket";
import type { Effort, KfdRow, KfdVerdict, PersonaSlug, RootCause } from "@/lib/schemas/findings";
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
            `### Requirements\n` +
            `- Assemble account-impact and adoption evidence for "${item}" (reach %, top-decile ARR exposure).\n` +
            `- Identify every persona and dependent workflow that touches it before removing it.\n` +
            `- Draft the kill / keep recommendation with a migration path for affected accounts.\n\n` +
            `### Acceptance criteria\n` +
            `- [ ] CCB reviews the recommendation with adoption + ARR-impact data attached.\n` +
            `- [ ] A decision (kill / keep / defer) is recorded with its rationale.\n` +
            `- [ ] If killed, a deprecation + customer-migration plan is linked to this issue.\n\n` +
            `Bring to the Change Control Board for the decision. Source findings: ` +
            `${sourceFindingKeys.join(", ") || "n/a"}.`,
          6000,
        ),
        personas,
        labels: [...baseLabels, phase],
        priority: TICKET_PRIORITY.medium,
        phase,
        sourceFindingKeys,
      };
    }

    // Fix / Double-Down → epic
    const key = uniqueKey(`${row.verdict === "double_down" ? "dd" : "fix"}-${slugify(row.item)}`);
    const phase = phaseForEffort(row.effort);
    const priority =
      row.verdict === "double_down" ? TICKET_PRIORITY.high : TICKET_PRIORITY.medium;
    const isDoubleDown = row.verdict === "double_down";
    const personaList = personas.join(", ");
    // Requirements + acceptance criteria are written INTO the ticket so an
    // engineer/PM picking it up has the spec, not just the theme title. Both are
    // derived deterministically from the matrix row (root cause, personas, first
    // action) — same pure-transform contract as the rest of this module.
    const requirements = isDoubleDown
      ? `- Extend what already works in "${item}" for ${personaList} without regressing it.\n` +
        `- Remove the friction that caps adoption (root cause: ${row.rootCause}).\n` +
        `- Ship the first action: ${firstAction}\n`
      : `- Resolve the root cause (${row.rootCause}) behind "${item}", not just the surface symptom.\n` +
        `- Preserve the workflow ${personaList} rely on while fixing it.\n` +
        `- Ship the first action: ${firstAction}\n`;
    const acceptance = isDoubleDown
      ? `- [ ] The improvement to "${item}" is live for ${personaList} with no regression.\n` +
        `- [ ] The first action is complete and verified.\n` +
        `- [ ] An adoption metric is instrumented and moving up.\n` +
        `- [ ] Owning PM has signed off and the change is documented.\n`
      : `- [ ] "${item}" resolves the described customer pain for ${personaList}.\n` +
        `- [ ] The first action is complete and verified against the pain above.\n` +
        `- [ ] A success metric is instrumented and trending the right way.\n` +
        `- [ ] Owning PM has signed off and the change is documented.\n`;
    return {
      type: "epic",
      key,
      title: clip(row.verdict === "double_down" ? `Double down: ${item}` : `Fix: ${item}`, 200),
      description: clip(
        `**From the approved platform-review matrix (${row.verdict.replace("_", "-")}).**\n\n` +
          `**Customer pain:** ${customerPain}\n\n` +
          `**Root cause:** ${row.rootCause} · **Effort:** ${row.effort} · ` +
          `**Personas:** ${personaList}\n\n` +
          `### Requirements\n${requirements}\n` +
          `### Acceptance criteria\n${acceptance}\n` +
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
      sourceFindingKeys,
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

/** A matrix finding the human flagged to convert to a ticket, with its verdict
 *  already resolved (dislikes carry kill/fix/double_down; likes → double_down). */
export interface FindingForTicket {
  key: string;
  persona: string;
  kind: "like" | "dislike";
  title: string;
  customerPain: string | null;
  rootCause: string | null;
  effort: string | null;
  firstAction: string | null;
  detail: string;
  verdict: KfdVerdict;
}

/**
 * Draft tickets from a HUMAN-CURATED subset of matrix findings (the "Add to
 * ticket" selection), rather than the whole deliverable. Each finding is mapped
 * into a KfdRow and run through the same deterministic transform as
 * draftTicketsFromDeliverable, so the ticket shape is identical — this just lets
 * the human pick which themes convert AND lets human-authored findings (which
 * never enter the synthesized KFD table) become tickets. Likes carry no
 * customer-pain/root-cause/effort/first-action, so a "double down on what works"
 * selection falls back to sensible defaults.
 */
export function draftTicketsFromFindings(
  findings: FindingForTicket[],
  opts: { runId?: string; generatedAt?: string } = {},
): TicketDraft {
  const rows: KfdRow[] = findings.map((f) => ({
    item: f.title,
    verdict: f.verdict,
    customerPain: f.customerPain ?? f.detail,
    personas: [f.persona as PersonaSlug],
    rootCause: (f.rootCause ?? "strategy") as RootCause,
    effort: (f.effort ?? "M") as Effort,
    // Item-specific default so double-down/like findings (which carry no
    // firstAction) don't all collapse to one identical sub-issue title — that
    // made N epics look like duplicate tickets in Linear.
    firstAction: f.firstAction ?? `Protect & extend "${f.title}" — guard against regressions and widen adoption.`,
    sourceFindingKeys: [`${f.persona}/${f.key}`],
  }));
  return draftTicketsFromDeliverable(rows, opts);
}
