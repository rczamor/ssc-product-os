import { NextResponse } from "next/server";
import { AUTH_COOKIE } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** POST — clear the admin session cookie. Requires an existing session (middleware). */
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
