"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PERSONAS, PERSONA_LABELS, type PersonaSlug } from "@/lib/schemas/findings";

export default function TriggerRunButton() {
  const router = useRouter();
  const [selected, setSelected] = useState<PersonaSlug[]>([...PERSONAS]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function toggle(p: PersonaSlug) {
    setSelected((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));
  }

  async function submit() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/run-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personas: selected, note: note || undefined }),
      });
      if (res.ok) {
        setMessage("Queued. The agent worker picks requests up on its next poll (≤1h), or run /platform-review in a Claude Code session for an immediate run.");
        setNote("");
        router.refresh();
      } else {
        const body = await res.json().catch(() => null);
        setMessage(`Failed: ${body?.error ?? res.status}`);
      }
    } catch {
      setMessage("Network error — could not reach the server. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-[11px] border border-line bg-card p-5 shadow-card">
      <h2 className="text-sm font-semibold text-ink">Trigger a new evaluation run</h2>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        {PERSONAS.map((p) => (
          <label key={p} className="flex items-center gap-2 text-sm text-ink-2">
            <input
              type="checkbox"
              checked={selected.includes(p)}
              onChange={() => toggle(p)}
              className="h-4 w-4 rounded border-line-3 accent-accent"
            />
            {PERSONA_LABELS[p]}
          </label>
        ))}
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (optional)"
          className="min-w-48 flex-1 rounded-lg border border-line-3 bg-card-alt px-3 py-1.5 text-sm text-ink-2 focus:border-accent focus:outline-none"
        />
        <button
          onClick={submit}
          disabled={busy || selected.length === 0}
          className="rounded-lg bg-accent px-4 py-1.5 text-sm font-semibold text-white shadow-accent hover:brightness-105 disabled:opacity-50"
        >
          {busy ? "Queueing…" : "Queue run"}
        </button>
      </div>
      {message && <p className="mt-3 text-sm text-ink-4">{message}</p>}
    </div>
  );
}
