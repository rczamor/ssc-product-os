"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PERSONAS, type PersonaSlug } from "@/lib/schemas/findings";
import { PERSONA_SHORT } from "@/lib/persona-colors";

const ROOT_CAUSES = ["ux", "data", "workflow", "packaging", "strategy"] as const;
const ROOT_LABELS: Record<(typeof ROOT_CAUSES)[number], string> = {
  ux: "UX",
  data: "Data",
  workflow: "Workflow",
  packaging: "Packaging",
  strategy: "Strategy",
};
const EFFORTS = ["S", "M", "L"] as const;
const RECS = [
  { value: "fix", label: "Fix" },
  { value: "double_down", label: "Double Down" },
  { value: "kill", label: "Kill" },
] as const;

/**
 * Add a human-authored theme (finding) to a run — the matrix's "+ Add a theme"
 * control. Posts to POST /api/runs/[id]/findings, which enforces the same
 * content contract as agent findings and stamps origin='human'. The v2 form:
 * a Working / Not-working segmented toggle, a violet "Human" attribution tag,
 * and Title → Customer pain → Persona/Root cause/Effort/Recommendation → First
 * action. Surfaces the server's validation errors inline.
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

  // "Not working" (dislike) is the default, matching the mockup's addKind.
  const [kind, setKind] = useState<"like" | "dislike">("dislike");
  const [persona, setPersona] = useState<PersonaSlug>(fixedPersona ?? PERSONAS[0]);
  const [title, setTitle] = useState("");
  const [pain, setPain] = useState("");
  const [rootCause, setRootCause] = useState<(typeof ROOT_CAUSES)[number]>("ux");
  const [effort, setEffort] = useState<(typeof EFFORTS)[number]>("M");
  const [rec, setRec] = useState<(typeof RECS)[number]["value"]>("fix");
  const [firstAction, setFirstAction] = useState("");

  function reset() {
    setTitle("");
    setPain("");
    setFirstAction("");
    setError(null);
  }

  async function submit() {
    const t = title.trim();
    const p = pain.trim();
    const fa = firstAction.trim();
    if (t.length < 8) return setError("Give the theme a headline of at least 8 characters.");
    if (p.length < 20) return setError("Add a customer-pain quote of at least 20 characters.");
    if (kind === "dislike" && fa.length < 10)
      return setError("Add a first action of at least 10 characters.");

    // The API requires detail (≥40) and jtbd (≥5); the compact form doesn't ask
    // for them, so compose an honest detail from the pain + first action.
    const detail = fa
      ? `${p} — first action: ${fa}`
      : `${p} — first action to be scoped by the team this week.`;
    const body: Record<string, unknown> = {
      persona,
      kind,
      title: t,
      detail,
      jtbd: `Human-added ${kind === "like" ? "strength" : "gap"} (${PERSONA_SHORT[persona]})`,
      verdict: rec,
    };
    if (kind === "dislike") {
      body.customerPain = p;
      body.rootCause = rootCause;
      body.effort = effort;
      body.firstAction = fa;
      body.severity = 3;
    }

    setBusy(true);
    setError(null);
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

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex cursor-pointer items-center gap-[7px] rounded-lg border border-dashed border-line-4 bg-card px-[13px] py-2 text-[12.5px] font-semibold text-ink-2 hover:border-accent hover:text-accent"
      >
        <span className="text-[15px] leading-none">+</span> Add a theme
      </button>
    );
  }

  const labelCls =
    "mb-[5px] block text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-5";
  const fieldCls =
    "box-border w-full min-w-0 rounded-[7px] border border-line bg-card px-[10px] py-2 text-[12.5px] text-ink outline-none focus:border-accent";
  const selectCls =
    "box-border w-full min-w-0 rounded-[7px] border border-line bg-card px-[10px] py-2 text-[12px] text-ink-2 outline-none focus:border-accent";

  const seg = (value: "like" | "dislike", label: string) => {
    const active = kind === value;
    return (
      <button
        type="button"
        onClick={() => setKind(value)}
        className="cursor-pointer whitespace-nowrap rounded-md border-none px-[15px] py-[6px] text-[12px] font-semibold"
        style={{
          background: active ? "var(--accent-bg)" : "transparent",
          color: active ? "var(--accent)" : "#6b6152",
        }}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="rounded-[10px] border border-line-3 bg-card-alt px-4 py-[15px]">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-[13px] font-bold text-ink">Add a theme</span>
        <span
          className="inline-flex items-center gap-1 rounded border px-[6px] py-[2px] text-[9.5px] font-semibold uppercase tracking-[0.03em]"
          style={{
            background: "rgba(109,75,208,0.09)",
            color: "#6d4bd0",
            borderColor: "rgba(109,75,208,0.3)",
          }}
        >
          <span className="h-[5px] w-[5px] rounded-full" style={{ background: "#6d4bd0" }} />
          Human
        </span>
        <span className="text-[11px] text-ink-5">it will be attributed to you</span>
      </div>

      <div className="flex flex-col gap-[11px]">
        <div>
          <span className={labelCls}>Status</span>
          <div className="inline-flex rounded-lg border border-line bg-card p-[3px]">
            {seg("like", "Working")}
            {seg("dislike", "Not working")}
          </div>
        </div>

        <label className="block">
          <span className={labelCls}>Title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="A short, specific headline"
            className={fieldCls}
          />
        </label>

        <label className="block">
          <span className={labelCls}>Customer pain — in the persona&apos;s voice</span>
          <textarea
            value={pain}
            onChange={(e) => setPain(e.target.value)}
            rows={2}
            placeholder="&ldquo;When I… I have to… which means…&rdquo;"
            className={`${fieldCls} min-h-[54px] resize-y leading-[1.45]`}
          />
        </label>

        <div className="grid grid-cols-2 gap-[9px] sm:grid-cols-4">
          <label className="block">
            <span className={labelCls}>Persona</span>
            <select
              value={persona}
              onChange={(e) => setPersona(e.target.value as PersonaSlug)}
              disabled={Boolean(fixedPersona)}
              className={selectCls}
            >
              {PERSONAS.map((p) => (
                <option key={p} value={p}>
                  {PERSONA_SHORT[p]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={labelCls}>Root cause</span>
            <select
              value={rootCause}
              onChange={(e) => setRootCause(e.target.value as typeof rootCause)}
              className={selectCls}
            >
              {ROOT_CAUSES.map((r) => (
                <option key={r} value={r}>
                  {ROOT_LABELS[r]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={labelCls}>Effort</span>
            <select
              value={effort}
              onChange={(e) => setEffort(e.target.value as typeof effort)}
              className={selectCls}
            >
              {EFFORTS.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={labelCls}>Recommendation</span>
            <select
              value={rec}
              onChange={(e) => setRec(e.target.value as typeof rec)}
              className={selectCls}
            >
              {RECS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block">
          <span className={labelCls}>First action this week</span>
          <textarea
            value={firstAction}
            onChange={(e) => setFirstAction(e.target.value)}
            rows={2}
            placeholder="Something a team could actually start Monday"
            className={`${fieldCls} min-h-[54px] resize-y leading-[1.45]`}
          />
        </label>
      </div>

      {error && <p className="mt-2 text-[11px] text-red">{error}</p>}

      <div className="mt-3 flex items-center gap-[10px]">
        <button
          type="button"
          disabled={busy}
          onClick={submit}
          className="cursor-pointer rounded-[7px] bg-accent px-[15px] py-2 text-[12px] font-semibold text-white hover:brightness-[1.08] disabled:opacity-60"
        >
          {busy ? "Adding…" : "Add Theme"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            reset();
            setOpen(false);
          }}
          className="cursor-pointer border-none bg-transparent text-[12px] text-ink-5 hover:text-ink-2"
        >
          cancel
        </button>
      </div>
    </div>
  );
}
