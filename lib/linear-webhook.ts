import crypto from "crypto";

/**
 * Verify a Linear webhook's signature. Linear signs the raw request body with
 * HMAC-SHA256 using the webhook secret and sends the hex digest in the
 * `Linear-Signature` header. We recompute it over the exact raw body and compare
 * in constant time. Returns false on any mismatch, or when the secret or the
 * signature header is missing (fail closed — an unverifiable request is rejected,
 * never processed).
 */
export function verifyLinearSignature(
  rawBody: string,
  signature: string | null | undefined,
  secret: string | undefined,
): boolean {
  if (!secret || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const a = Buffer.from(signature, "utf8");
  const b = Buffer.from(expected, "utf8");
  // timingSafeEqual throws on unequal lengths, so length-check first (a length
  // mismatch is already a definitive non-match).
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/** The subset of a Linear webhook payload the cache sync needs. */
export interface LinearWebhookEvent {
  /** create | update | remove */
  action?: string;
  /** Issue | Comment | Project | … — we only act on "Issue". */
  type?: string;
  data?: { id?: string; projectId?: string };
  webhookTimestamp?: number;
}
