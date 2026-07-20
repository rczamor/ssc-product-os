import { z } from "zod";

/** One issue that moved to Done inside the reporting window. */
export const FridayShippedItemSchema = z.object({
  identifier: z.string().min(1),
  title: z.string().min(1),
  url: z.string().nullable(),
  completedAt: z.string().min(1),
});
export type FridayShippedItem = z.infer<typeof FridayShippedItemSchema>;

/** One issue past its due date and not yet Done. */
export const FridaySlippedItemSchema = z.object({
  identifier: z.string().min(1),
  title: z.string().min(1),
  url: z.string().nullable(),
  dueDate: z.string().min(1),
  daysLate: z.number().int().min(0),
});
export type FridaySlippedItem = z.infer<typeof FridaySlippedItemSchema>;

export const FridayAiUsageSchema = z.object({
  containmentRatePercent: z.number().nullable(),
  workflowsRunCount: z.number().int().min(0),
  agreeRatePercent: z.number().nullable(),
  narrative: z.string().min(10).max(1000),
});
export type FridayAiUsage = z.infer<typeof FridayAiUsageSchema>;

/**
 * The exact take-home sections (spec 5.1): shipped, slipped, customer impact,
 * adoption, velocity, AI usage, risks, one win to celebrate. Every string
 * section is a deterministic template over real board/metric/finding data
 * (never free-generated text), so it is reproducible and safe to regenerate.
 */
export const FridayUpdateSchema = z.object({
  generatedAt: z.string().min(1),
  windowStart: z.string().min(1),
  windowEnd: z.string().min(1),
  shipped: z.array(FridayShippedItemSchema),
  slipped: z.array(FridaySlippedItemSchema),
  customerImpact: z.string().min(10).max(2000),
  adoption: z.string().min(10).max(2000),
  velocity: z.string().min(10).max(2000),
  aiUsage: FridayAiUsageSchema,
  risks: z.array(z.string().min(5).max(500)).min(1).max(10),
  oneWin: z.string().min(10).max(500),
});
export type FridayUpdate = z.infer<typeof FridayUpdateSchema>;
