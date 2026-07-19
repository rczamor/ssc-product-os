import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, makeSessionToken, timingSafeEqual } from "@/lib/auth";
import { LoginRequestSchema } from "@/lib/schemas/api";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const sessionSecret = process.env.SESSION_SECRET;
  if (!adminEmail || !adminPassword || !sessionSecret) {
    return NextResponse.json(
      { error: "server not configured (ADMIN_EMAIL / ADMIN_PASSWORD / SESSION_SECRET missing)" },
      { status: 503 },
    );
  }

  const body = LoginRequestSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: "email and password required" }, { status: 400 });
  }

  // Compare both before returning so timing never reveals which field was wrong.
  const emailOk = timingSafeEqual(
    body.data.email.trim().toLowerCase(),
    adminEmail.trim().toLowerCase(),
  );
  const passOk = timingSafeEqual(body.data.password, adminPassword);
  if (!emailOk || !passOk) {
    // Uniform small delay to blunt brute-force timing.
    await new Promise((r) => setTimeout(r, 400));
    return NextResponse.json({ error: "wrong email or password" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, await makeSessionToken(sessionSecret), {
    httpOnly: true,
    // Secure when actually served over https (Vercel); a Secure cookie over
    // http://127.0.0.1 is stored but not resent by Chromium, breaking local/e2e.
    secure: req.nextUrl.protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
