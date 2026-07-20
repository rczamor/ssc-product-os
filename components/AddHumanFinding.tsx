"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PERSONAS, PERSONA_LABELS, type PersonaSlug } from "@/lib/schemas/findings";

const ROOT_CAUSES = ["ux", "data", "workflow", "packaging", "strategy"] as const;
const EFFORTS = ["S", "M", "L"] as const;

/**
 * Add a human-authored finding to a run. Posts to POST /api/runs/[id]/findings,
 * which enforces the same content contract as agent findings (min-length guards;
 * dislikes require pain/root-cause/effort/first-action/severity) and stamps
 * origin='human'. Surfaces the server's validation errors inline.
 */
export default function AddHumanFinding({
  runId,
  fixedPersona,
}: {
  runId: string;
  fixedPersona?: PersonaSlug;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [persona, setPersona] = useState<PersonaSlug>(fixedPersona ?? PERSONAS[0]);
  const [kind, setKind] = useState<"like" | "dislike">("dislike");
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [jtbd, setJtbd] = useState("");
  const [customerPain, setCustomerPain] = useState("");
  const [rootCause, setRootCause] = useState<(typeof ROOT_CAUSES)[number]>("ux");
  const [effort, setEffort] = useState<(typeof EFFORTS)[number]>("M");
  const [firstAction, setFirstAction] = useState("");
  const [severity, setSeverity] = useState(3);

  function reset() {
    setTitle("");
    setDetail("");
    setJtbd("");
    setCustomerPain("");
    setFirstAction("");
    setSeverity(3);
    setError(null);
  }

  async function submit() {
    setBusy(true);
    setError(null);
    const body: Record<string, unknown> = { persona, kind, title, detail, jtbd: jtbd.trim() };
    if (kind === "dislike") {
      body.customerPain = customerPain;
      body.rootCause = rootCause;
      body.effort = effort;
      body.firstAction = firstAction;
      body.severity = severity;
    }
    try {
      const res = await fetch(`/api/runs/${runId}/findings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        reset();
        setOpen(false);
        router.refresh();
      } else {
        const j = await res.json().catch(() => null);
        const first = j?.issues?.[0];
        setError(first ? `${first.path?.join(".") ?? ""} ${first.message}`.trim() : `Failed (${res.status})`);
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  const input = "w-full rounded-md border border-line-3 bg-card px-2 py-1 text-sm text-ink-2 focus:border-accent focus:outline-none";

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-dashed border-line-3 px-3 py-1.5 text-sm text-ink-3 hover:border-ink-5 hover:text-ink"
      >
        + Add a human finding
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-line-3 bg-card-alt p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-ink">Add a human finding</h4>
        <span className="rounded-md border border-line-3 bg-card px-2 py-0.5 text-[11px] font-medium text-ink-3">
          origin: human
        </span>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {fixedPersona ? (
          <div className="text-xs text-ink-4">
            Persona
            <div className="mt-[2px] rounded-md border border-line bg-card px-2 py-1 text-sm text-ink-2">
              {PERSONA_LABELS[fixedPersona]}
            </div>
          </div>
        ) : (
          <label className="text-xs text-ink-4">
            Persona
            <select value={persona} onChange={(e) => setPersona(e.target.value as PersonaSlug)} className={input}>
              {PERSONAS.map((p) => (
                <option key={p} value={p}>
                  {PERSONA_LABELS[p]}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="text-xs text-ink-4">
          Kind
          <select value={kind} onChange={(e) => setKind(e.target.value as "like" | "dislike")} className={input}>
            <option value="dislike">Dislike</option>
            <option value="like">Like</option>
          </select>
        </label>
        <label className="text-xs text-ink-4 sm:col-span-2">
          Title (≥8 chars)
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={input} />
        </label>
        <label className="text-xs text-ink-4 sm:col-span-2">
          Detail (≥40 chars — what, where, why it matters)
          <textarea value={detail} onChange={(e) => setDetail(e.target.value)} rows={2} className={input} />
        </label>
        <label className="text-xs text-ink-4 sm:col-span-2">
          JTBD / KPI (≥5 chars — the persona job this supports or blocks)
          <input value={jtbd} onChange={(e) => setJtbd(e.target.value)} className={input} />
        </label>
        {kind === "dislike" && (
          <>
            <label className="text-xs text-ink-4 sm:col-span-2">
              Customer pain (≥20 chars, in the persona&apos;s voice)
              <input value={customerPain} onChange={(e) => setCustomerPain(e.target.value)} className={input} />
            </label>
            <label className="text-xs text-ink-4">
              Root cause
              <select value={rootCause} onChange={(e) => setRootCause(e.target.value as typeof rootCause)} className={input}>
                {ROOT_CAUSES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-ink-4">
              Effort
              <select value={effort} onChange={(e) => setEffort(e.target.value as typeof effort)} className={input}>
                {EFFORTS.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-ink-4">
              Severity (1–5)
              <input
                type="number"
                min={1}
                max={5}
                value={severity}
                onChange={(e) => setSeverity(Number(e.target.value))}
                className={input}
              />
            </label>
            <label className="text-xs text-ink-4">
              First action this week (≥10 chars)
              <input value={firstAction} onChange={(e) => setFirstAction(e.target.value)} className={input} />
            </label>
          </>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-red">{error}</p>}
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={submit}
          className="rounded-md bg-accent px-3 py-1 text-sm font-semibold text-white shadow-accent hover:brightness-105 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Add finding"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            reset();
            setOpen(false);
          }}
          className="text-sm text-ink-4 hover:text-ink-2"
        >
          cancel
        </button>
      </div>
    </div>
  );
}
