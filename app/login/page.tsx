"use client";

import { useState } from "react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setBusy(false);
    if (res.ok) {
      // Hard navigation: the router's prefetch cache was populated while
      // unauthenticated (login redirects), so a client-side push would
      // replay the redirect instead of loading the dashboard.
      window.location.assign("/");
    } else {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "login failed");
    }
  }

  return (
    <div className="mx-auto mt-24 max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
      <h1 className="text-lg font-semibold">SSC Product OS</h1>
      <p className="mt-1 text-sm text-slate-500">
        Enter the admin password to view persona evaluation runs.
      </p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Admin password"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={busy || password.length === 0}
          className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {busy ? "Checking…" : "Log in"}
        </button>
      </form>
    </div>
  );
}
