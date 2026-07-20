"use client";

import { useEffect, useState } from "react";

interface PushState {
  approved: boolean;
  linearConfigured: boolean;
  draft: { tickets: Array<{ type: string; title: string }> } | null;
  pushedAt: string | null;
  pushedIssueIds: Array<{ identifier?: string; url?: string }>;
}

/**
 * Push the approved matrix to Linear. Only meaningful after approval (the server
 * enforces the gate regardless). Shows the drafted ticket count, whether it has
 * already been pushed (idempotent — re-pushing creates nothing), and degrades to
 * a clear "draft ready, set LINEAR_API_KEY" state when no key is present.
 */
export default function PushToLinear({ runId, approved }: { runId: string; approved: boolean }) {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    try {
      // Materialize (POST — a real mutation, deliberately not a GET side effect)
      // the draft first so the ticket count below reflects it, then read state.
      await fetch(`/api/runs/${runId}/tickets/draft`, { method: "POST" });
      const res = await fetch(`/api/runs/${runId}/tickets/push`);
      if (res.ok) setState(await res.json());
    } catch {
      /* leave state null; the section just won't render detail */
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId, approved]);

  async function push() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/runs/${runId}/tickets/push`, { method: "POST" });
      const j = await res.json().catch(() => null);
      if (res.ok) {
        setMsg(
          j.alreadyPushed
            ? `Already pushed — ${j.count} issue(s), nothing new created.`
            : `Pushed ${j.count} issue(s) to the SSC-ProductOS project.`,
        );
      } else if (res.status === 503) {
        setMsg(`Draft ready (${j?.ticketCount ?? "?"} tickets), but LINEAR_API_KEY is not set.`);
      } else {
        setMsg(j?.error ?? `Push failed (${res.status}).`);
      }
      await load();
    } catch {
      setMsg("Network error during push.");
    } finally {
      setBusy(false);
    }
  }

  if (!approved) return null;
  const draftCount = state?.draft?.tickets.length ?? 0;
  const pushed = Boolean(state?.pushedAt);

  return (
    <div className="mt-3 rounded-lg border border-line bg-card px-3 py-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium text-ink-2">Linear push</span>
        <span className="text-ink-4">
          {draftCount > 0 ? `${draftCount} tickets drafted from the matrix` : "preparing draft…"}
          {state && !state.linearConfigured && " · LINEAR_API_KEY not set"}
        </span>
        <button
          type="button"
          onClick={push}
          disabled={busy}
          className="ml-auto rounded-md bg-accent px-3 py-1 text-sm font-semibold text-white shadow-accent hover:brightness-105 disabled:opacity-50"
        >
          {busy ? "Pushing…" : pushed ? "Re-check push" : "Push to Linear"}
        </button>
      </div>
      {pushed && state && state.pushedIssueIds.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {state.pushedIssueIds.map((p, i) => (
            <a
              key={i}
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md border border-green/30 bg-green/[0.06] px-1.5 py-0.5 font-mono text-[11px] font-medium text-green-dark hover:bg-green/10"
            >
              {p.identifier ?? "issue"}
            </a>
          ))}
        </div>
      )}
      {msg && <p className="mt-1 text-xs text-ink-4">{msg}</p>}
    </div>
  );
}
