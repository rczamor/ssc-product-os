import { z } from "zod";
import { PersonaSlugSchema } from "./findings";

/** Feedback sources. The scraped ones are review sites; the rest are future connectors. */
export const FEEDBACK_SOURCES = [
  "capterra",
  "g2",
  "trustradius",
  "pendo",
  "gong",
  "gainsight",
] as const;
export const FeedbackSourceSchema = z.enum(FEEDBACK_SOURCES);
export type FeedbackSource = z.infer<typeof FeedbackSourceSchema>;

export const FEEDBACK_SOURCE_LABELS: Record<FeedbackSource, string> = {
  capterra: "Capterra",
  g2: "G2",
  trustradius: "TrustRadius",
  pendo: "Pendo",
  gong: "Gong",
  gainsight: "Gainsight",
};

/**
 * Ingestion source catalog for the Planning panel. `scraped` sources connect
 * via runner/scrape-reviews.ts; `connector` sources are rendered as
 * available-but-not-connected stubs (the target integrations).
 */
export const INGESTION_SOURCES: Array<{
  source: FeedbackSource | "snowflake";
  kind: "scraped" | "connector";
  note: string;
}> = [
  { source: "capterra", kind: "scraped", note: "Public review site (scraped)" },
  { source: "g2", kind: "scraped", note: "Public review site (scraped)" },
  { source: "trustradius", kind: "scraped", note: "Public review site (scraped)" },
  { source: "pendo", kind: "connector", note: "Product analytics + NPS (Pendo Listen)" },
  { source: "gong", kind: "connector", note: "Call transcripts → pain points" },
  { source: "gainsight", kind: "connector", note: "Customer health + CS notes" },
  { source: "snowflake", kind: "connector", note: "Customer Insights data layer" },
];

/** One ingested feedback item (the scraper emits an array of these). */
export const FeedbackItemSchema = z.object({
  source: FeedbackSourceSchema,
  sourceUrl: z.string().url().nullish(),
  reviewDate: z.string().max(64).nullish(),
  rating: z.number().min(0).max(5).nullish(),
  title: z.string().max(500).nullish(),
  // Capped so an oversized publish file can't stuff an unbounded text column.
  body: z.string().min(1).max(20_000),
  reviewerRoleRaw: z.string().max(300).nullish(),
  personaGuess: PersonaSlugSchema.nullish(),
});
export type FeedbackItem = z.infer<typeof FeedbackItemSchema>;

/** The file the scraper writes to runs/feedback/<source>.json */
export const ScrapedFeedbackSchema = z.object({
  source: FeedbackSourceSchema,
  scrapedAt: z.string().nullish(),
  /** Which sources were attempted and their outcome, for the ingestion panel. */
  attempts: z
    .array(
      z.object({
        source: FeedbackSourceSchema,
        outcome: z.enum(["ok", "blocked", "empty", "error"]),
        count: z.number().int().min(0).default(0),
        note: z.string().nullish(),
      }),
    )
    .nullish(),
  items: z.array(FeedbackItemSchema).min(1).max(5_000),
});
export type ScrapedFeedback = z.infer<typeof ScrapedFeedbackSchema>;

/**
 * The publisher accepts either the scraper's output (runs/feedback/<source>.json,
 * a ScrapedFeedback) or the committed demo seed (data/feedback-seed.json). Both
 * carry an `items` array; everything else is optional. `.passthrough()` keeps
 * the seed's human `_note` field without failing validation.
 */
export const FeedbackFileSchema = z
  .object({
    source: FeedbackSourceSchema.optional(),
    scrapedAt: z.string().nullish(),
    attempts: ScrapedFeedbackSchema.shape.attempts,
    items: z.array(FeedbackItemSchema).min(1).max(5_000),
  })
  .passthrough();
export type FeedbackFile = z.infer<typeof FeedbackFileSchema>;

/**
 * Map a raw reviewer role string to a persona guess. Best-effort keyword match
 * against the three personas' vocabularies; returns null when uncertain.
 */
export function guessPersona(role: string | null | undefined): "ciso" | "vrm" | "gtm_cs" | null {
  if (!role) return null;
  const r = role.toLowerCase();
  // CISO/security-leadership first: "security compliance"/"cyber risk" roles are
  // security-office, not vendor-risk, so they must win over the vrm "compliance"
  // keyword below.
  if (
    /ciso|chief (information )?security|chief security|vp .*security|head of security|security (officer|compliance|architect)|cyber risk|deputy ciso|information security (officer|manager|director)/.test(
      r,
    )
  ) {
    return "ciso";
  }
  if (/vendor|third.?party|tprm|risk manager|grc|compliance|procurement|supplier/.test(r)) {
    return "vrm";
  }
  if (/sales|account|customer success|csm|solutions engineer|pre.?sales|marketing|gtm|revenue/.test(r)) {
    return "gtm_cs";
  }
  // Generic security-analyst roles lean CISO-adjacent but stay null unless clearer.
  return null;
}

/**
 * Stable idempotency key for a feedback item. Prefers a per-review source URL
 * (the canonical identifier); otherwise a content hash. The hash basis folds in
 * rating + title + a wider body slice so two distinct reviews are very unlikely
 * to collide on a shared prefix. Note: when a scraper can only recover a shared
 * (non-per-review) permalink, distinct reviews under it would collapse — the
 * scraper drops such URLs to null and falls back to this content hash.
 */
export function feedbackDedupeKey(item: FeedbackItem): string {
  if (item.sourceUrl) return item.sourceUrl;
  const basis = `${item.source}|${item.rating ?? ""}|${item.title ?? ""}|${item.body.slice(0, 500)}`;
  // Small, dependency-free FNV-1a hash — enough to dedupe scraped rows.
  let h = 0x811c9dc5;
  for (let i = 0; i < basis.length; i++) {
    h ^= basis.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `${item.source}:${(h >>> 0).toString(16)}`;
}
