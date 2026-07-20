import { z } from "zod";
import { EffortSchema, KfdVerdictSchema, PersonaSlugSchema, RootCauseSchema } from "./findings";

/** A finding review verdict. */
export const ReviewVerdictSchema = z.enum(["up", "down"]);
export type ReviewVerdict = z.infer<typeof ReviewVerdictSchema>;

/** Who authored a review or finding. */
export const ReviewerTypeSchema = z.enum(["human", "agent"]);
export type ReviewerType = z.infer<typeof ReviewerTypeSchema>;

export const FindingOriginSchema = z.enum(["agent", "human"]);
export type FindingOrigin = z.infer<typeof FindingOriginSchema>;

/**
 * Body for POST /api/runs/[id]/reviews — a human up/down vote (+ optional
 * comment) on a finding. Upserts on (run, finding, persona, reviewer): voting
 * again replaces the prior vote rather than stacking.
 */
export const CreateReviewSchema = z.object({
  findingKey: z.string().min(1).max(120),
  persona: PersonaSlugSchema,
  verdict: ReviewVerdictSchema,
  comment: z.string().max(2000).nullish(),
});
export type CreateReview = z.infer<typeof CreateReviewSchema>;

/**
 * Body for POST /api/runs/[id]/findings — a human-authored finding. Holds a
 * human finding to the same core content contract as the agent finding schema:
 * the same min-length guards on title/detail and a required jtbd (as agent
 * likes/dislikes require), and dislikes additionally require customerPain/
 * rootCause/effort/firstAction/severity. Every free-text field is also capped so
 * an oversized body can't bloat storage. The server derives the slug key and
 * stamps origin='human'.
 */
export const CreateHumanFindingSchema = z
  .object({
    persona: PersonaSlugSchema,
    kind: z.enum(["like", "dislike"]),
    title: z.string().min(8).max(160),
    detail: z.string().min(40).max(4000),
    jtbd: z.string().min(5).max(300),
    customerPain: z.string().min(20).max(2000).nullish(),
    rootCause: RootCauseSchema.nullish(),
    effort: EffortSchema.nullish(),
    firstAction: z.string().min(10).max(500).nullish(),
    severity: z.number().int().min(1).max(5).nullish(),
    /** Recommend verdict (kill/fix/double_down) chosen in the Add-a-theme form.
     *  Optional: when absent the query layer derives it (likes→double_down,
     *  dislikes→the KFD row that cites them). */
    verdict: KfdVerdictSchema.nullish(),
  })
  .superRefine((v, ctx) => {
    if (v.kind !== "dislike") return;
    const required = ["customerPain", "rootCause", "effort", "firstAction", "severity"] as const;
    for (const field of required) {
      if (v[field] === null || v[field] === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [field],
          message: `${field} is required for a dislike`,
        });
      }
    }
  });
export type CreateHumanFinding = z.infer<typeof CreateHumanFindingSchema>;

/** Body for POST /api/runs/[id]/approve — approval carries no fields today. */
export const ApproveSchema = z.object({}).nullish();
