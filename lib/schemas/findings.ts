import { z } from "zod";

/**
 * Contracts between the persona agents (LLM output) and everything downstream
 * (publish, DB, admin UI). `runner/publish.ts --validate-only` parses agent
 * output with these schemas and rejects anything vague or malformed — the
 * min-length guards are deliberate: they force specific, observable findings.
 */

export const PERSONAS = ["ciso", "vrm", "gtm_cs"] as const;
export const PersonaSlugSchema = z.enum(PERSONAS);
export type PersonaSlug = z.infer<typeof PersonaSlugSchema>;

export const PERSONA_LABELS: Record<PersonaSlug, string> = {
  ciso: "CISO",
  vrm: "Vendor Risk Manager",
  gtm_cs: "GTM / Customer Success",
};

export const RootCauseSchema = z.enum(["ux", "data", "workflow", "packaging", "strategy"]);
export type RootCause = z.infer<typeof RootCauseSchema>;

export const ROOT_CAUSE_LABELS: Record<RootCause, string> = {
  ux: "UX",
  data: "Data",
  workflow: "Workflow",
  packaging: "Packaging",
  strategy: "Strategy",
};

export const EffortSchema = z.enum(["S", "M", "L"]);
export type Effort = z.infer<typeof EffortSchema>;

export const KfdVerdictSchema = z.enum(["kill", "fix", "double_down"]);
export type KfdVerdict = z.infer<typeof KfdVerdictSchema>;

export const VERDICT_LABELS: Record<KfdVerdict, string> = {
  kill: "Kill",
  fix: "Fix",
  double_down: "Double Down",
};

const FindingKey = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]{2,63}$/, "key must be a lowercase slug, 3-64 chars");

const FindingBase = z.object({
  /** Stable slug, unique within the persona's output (e.g. "score-factor-drilldown"). */
  key: FindingKey,
  title: z.string().min(8).max(160),
  /** What was observed, where in the product, and why it matters. Be concrete. */
  detail: z.string().min(40),
  /** Labels of screenshots (from the journey or ad-hoc captures) that evidence this. */
  screenshotLabels: z.array(z.string()).default([]),
});

export const LikeSchema = FindingBase.extend({
  kind: z.literal("like"),
  /** Why this works for the persona, in their own terms. */
  whyItWorks: z.string().min(20),
  /** The persona JTBD or KPI this supports (quote from personas/<p>/persona.md). */
  jtbd: z.string().min(5),
});
export type Like = z.infer<typeof LikeSchema>;

export const DislikeSchema = FindingBase.extend({
  kind: z.literal("dislike"),
  /** The customer pain, phrased as the persona would say it. */
  customerPain: z.string().min(20),
  /** The persona JTBD or KPI this blocks (quote from personas/<p>/persona.md). */
  jtbd: z.string().min(5),
  rootCause: RootCauseSchema,
  effort: EffortSchema,
  /** First action this week — something a team could actually start Monday. */
  firstAction: z.string().min(10),
  severity: z.number().int().min(1).max(5),
});
export type Dislike = z.infer<typeof DislikeSchema>;

export const FindingSchema = z.discriminatedUnion("kind", [LikeSchema, DislikeSchema]);
export type Finding = z.infer<typeof FindingSchema>;

export const JourneyStopNoteSchema = z.object({
  label: z.string(),
  url: z.string(),
  note: z.string().optional(),
});

/** The file each persona agent writes to runs/<id>/<persona>/findings.json */
export const PersonaOutputSchema = z
  .object({
    persona: PersonaSlugSchema,
    /** Overall impression through the persona lens. */
    summary: z.string().min(80),
    likes: z.array(LikeSchema).min(2),
    dislikes: z.array(DislikeSchema).min(3),
    journeyNotes: z.array(JourneyStopNoteSchema).default([]),
  })
  .superRefine((out, ctx) => {
    const keys = [...out.likes, ...out.dislikes].map((f) => f.key);
    const dupes = keys.filter((k, i) => keys.indexOf(k) !== i);
    if (dupes.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `duplicate finding keys: ${[...new Set(dupes)].join(", ")}`,
      });
    }
  });
export type PersonaOutput = z.infer<typeof PersonaOutputSchema>;

export const DeliverableLikeSchema = z.object({
  title: z.string().min(8),
  detail: z.string().min(40),
  personas: z.array(PersonaSlugSchema).min(1),
  sourceFindingKeys: z.array(z.string()).default([]),
});

export const DeliverableDislikeSchema = DeliverableLikeSchema.extend({
  customerPain: z.string().min(20),
  rootCause: RootCauseSchema,
  effort: EffortSchema,
  firstAction: z.string().min(10),
});

export const KfdRowSchema = z.object({
  item: z.string().min(5),
  verdict: KfdVerdictSchema,
  customerPain: z.string().min(20),
  personas: z.array(PersonaSlugSchema).min(1),
  rootCause: RootCauseSchema,
  effort: EffortSchema,
  firstAction: z.string().min(10),
  sourceFindingKeys: z.array(z.string()).default([]),
});
export type KfdRow = z.infer<typeof KfdRowSchema>;

/**
 * The synthesized Prompt-1 deliverable: exactly 3 likes, exactly 5 dislikes,
 * and a Kill / Fix / Double-Down table with at least 5 rows.
 * Written by the synthesizer agent to runs/<id>/deliverable.json.
 */
export const DeliverableSchema = z.object({
  likes: z.array(DeliverableLikeSchema).length(3),
  dislikes: z.array(DeliverableDislikeSchema).length(5),
  kfd: z.array(KfdRowSchema).min(5),
});
export type Deliverable = z.infer<typeof DeliverableSchema>;

/** The file the judge agent writes to runs/<id>/scores.json */
export const JudgeScoreSchema = z.object({
  persona: PersonaSlugSchema,
  key: z.string(),
  specificity: z.number().min(1).max(5),
  actionability: z.number().min(1).max(5),
  comment: z.string().optional(),
});
export const ScoresFileSchema = z.object({
  scores: z.array(JudgeScoreSchema).min(1),
});
export type ScoresFile = z.infer<typeof ScoresFileSchema>;
