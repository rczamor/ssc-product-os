"use client";

import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        // Hard navigation: the router's prefetch cache was populated while
        // unauthenticated (login redirects), so a client-side push would
        // replay the redirect instead of loading the dashboard.
        window.location.assign("/");
        return; // keep the button disabled through the navigation
      }
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "login failed");
      setBusy(false);
    } catch {
      setError("Network error — could not reach the server. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto mt-24 max-w-sm rounded-[11px] border border-line bg-card p-8 shadow-card">
      <div className="flex items-center gap-[11px]">
        <div className="flex h-[26px] w-[26px] items-center justify-center rounded-[7px] bg-accent">
          <div className="h-2.5 w-2.5 rotate-45 rounded-sm border-2 border-white" />
        </div>
        <h1 className="text-lg font-semibold text-ink">SSC Product OS</h1>
      </div>
      <p className="mt-2 text-sm text-ink-4">Sign in with your admin email and password.</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <input
          type="email"
          autoFocus
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Admin email"
          className="w-full rounded-lg border border-line-3 bg-card-alt px-3 py-2 text-sm text-ink-2 focus:border-accent focus:outline-none"
        />
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Admin password"
          className="w-full rounded-lg border border-line-3 bg-card-alt px-3 py-2 text-sm text-ink-2 focus:border-accent focus:outline-none"
        />
        {error && <p className="text-sm text-red">{error}</p>}
        <button
          type="submit"
          disabled={busy || email.length === 0 || password.length === 0}
          className="w-full rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white shadow-accent hover:brightness-105 disabled:opacity-50"
        >
          {busy ? "Checking…" : "Log in"}
        </button>
      </form>
    </div>
  );
}
