/**
 * Cookie-session auth for the admin UI. Edge-safe (Web Crypto only) so the
 * middleware can verify tokens. The token is HMAC-SHA256(SESSION_SECRET,
 * fixed context string) — a bearer proof that the holder passed the password
 * gate; there is one shared admin identity.
 */

export const AUTH_COOKIE = "ssc_admin";
const TOKEN_CONTEXT = "ssc-admin-v1";

async function hmacHex(secret: string, value: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(value));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Constant-time string comparison. */
export function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  // Length is not secret here (fixed-length tokens / password length leaks
  // nothing an attacker can use beyond what a normal comparison leaks).
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

// The session token is HMAC(secret, fixed context) — a deterministic value,
// so cache it per secret rather than recomputing importKey+sign on every
// middleware invocation (every page, API call, and inline screenshot).
const tokenCache = new Map<string, string>();

export async function makeSessionToken(secret: string): Promise<string> {
  const cached = tokenCache.get(secret);
  if (cached) return cached;
  const token = await hmacHex(secret, TOKEN_CONTEXT);
  tokenCache.set(secret, token);
  return token;
}

export async function verifySessionToken(
  token: string | undefined,
  secret: string | undefined,
): Promise<boolean> {
  if (!token || !secret) return false;
  const expected = await makeSessionToken(secret);
  return timingSafeEqual(token, expected);
}
