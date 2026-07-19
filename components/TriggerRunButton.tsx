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
    const res = await fetch("/api/run-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ personas: selected, note: note || undefined }),
    });
    setBusy(false);
    if (res.ok) {
      setMessage("Queued. The agent worker picks requests up on its next poll (≤1h), or run /platform-review in a Claude Code session for an immediate run.");
      setNote("");
      router.refresh();
    } else {
      const body = await res.json().catch(() => null);
      setMessage(`Failed: ${body?.error ?? res.status}`);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900">Trigger a new evaluation run</h2>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        {PERSONAS.map((p) => (
          <label key={p} className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={selected.includes(p)}
              onChange={() => toggle(p)}
              className="h-4 w-4 rounded border-slate-300"
            />
            {PERSONA_LABELS[p]}
          </label>
        ))}
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (optional)"
          className="min-w-48 flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
        />
        <button
          onClick={submit}
          disabled={busy || selected.length === 0}
          className="rounded-lg bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {busy ? "Queueing…" : "Queue run"}
        </button>
      </div>
      {message && <p className="mt-3 text-sm text-slate-500">{message}</p>}
    </div>
  );
}
