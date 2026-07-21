import { z } from "zod";
import { EffortSchema, PersonaSlugSchema, RootCauseSchema } from "./findings";

/** Linear priority ints (0 none, 1 urgent, 2 high, 3 medium, 4 low). */
export const TICKET_PRIORITY = { urgent: 1, high: 2, medium: 3, low: 4 } as const;

const TicketKey = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]{2,79}$/, "key must be a lowercase slug, 3-80 chars");

const TicketSubIssue = z.object({
  title: z.string().min(6).max(200),
  description: z.string().min(10).max(2000),
});
export type TicketSubIssue = z.infer<typeof TicketSubIssue>;

const TicketBase = z.object({
  key: TicketKey,
  title: z.string().min(6).max(200),
  description: z.string().min(20).max(6000),
  personas: z.array(PersonaSlugSchema).min(1),
  /** Linear label names to apply (e.g. track:external, origin:matrix). */
  labels: z.array(z.string().min(1)).min(1),
  priority: z.number().int().min(1).max(4),
  /** Phase label name for the timeline grouping (e.g. "phase:week-2"), or null. */
  phase: z.string().nullish(),
  /** The matrix finding(s) this ticket was drafted from, as "persona/key" (or a
   *  bare key for legacy KFD-derived drafts). Structurally records the ticket→
   *  finding link so a push can archive exactly the findings it converted,
   *  independent of the live "Add to ticket" flags (which can drift after the
   *  draft is frozen). Bounded and defaulted so older drafts still validate. */
  sourceFindingKeys: z.array(z.string().min(1)).max(20).default([]),
});

/** A Fix / Double-Down row → an epic with firstAction + 1-3 more sub-issues. */
export const TicketEpicSchema = TicketBase.extend({
  type: z.literal("epic"),
  customerPain: z.string().min(10).max(2000),
  rootCause: RootCauseSchema,
  effort: EffortSchema,
  subIssues: z.array(TicketSubIssue).min(1).max(4),
});
export type TicketEpic = z.infer<typeof TicketEpicSchema>;

/** A Kill row → a single CCB decision issue. */
export const TicketDecisionSchema = TicketBase.extend({
  type: z.literal("decision"),
});
export type TicketDecision = z.infer<typeof TicketDecisionSchema>;

export const TicketSchema = z.discriminatedUnion("type", [
  TicketEpicSchema,
  TicketDecisionSchema,
]);
export type Ticket = z.infer<typeof TicketSchema>;

/** The file the drafter writes to runs/<id>/tickets.json. */
export const TicketDraftSchema = z.object({
  runId: z.string().nullish(),
  generatedAt: z.string().nullish(),
  // Bounded so a degenerate/oversized deliverable can't push an unbounded
  // number of real Linear-issue creations in one push.
  tickets: z.array(TicketSchema).min(1).max(60),
});
export type TicketDraft = z.infer<typeof TicketDraftSchema>;

/**
 * A seed ticket for the os-build backfill / role-plan (Appendix B) — created
 * directly (no approval gate). Simpler than a matrix ticket: a state to land in,
 * optional due-date offset from day-0, and its own sub-issues.
 */
export const SeedTicketSchema = z.object({
  key: TicketKey,
  title: z.string().min(6).max(200),
  description: z.string().min(10).max(8000),
  labels: z.array(z.string().min(1)).min(1),
  priority: z.number().int().min(1).max(4),
  /** Workflow state to create the issue in (e.g. "Done" for backfill). */
  state: z.string().min(1),
  /** Days from day-0 for the due date, or null. */
  dueDayOffset: z.number().int().nullish(),
  subIssues: z.array(z.string().min(3).max(200)).default([]),
});
export type SeedTicket = z.infer<typeof SeedTicketSchema>;

export const SeedTicketsFileSchema = z.object({
  osBuild: z.array(SeedTicketSchema),
  rolePlan: z.array(SeedTicketSchema),
});
export type SeedTicketsFile = z.infer<typeof SeedTicketsFileSchema>;
