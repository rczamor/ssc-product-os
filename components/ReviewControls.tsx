"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * The human up/down vote block on a single finding — the matrix right-rail's
 * "Your review · judge 1–5" control. Persists via POST /api/runs/[id]/reviews
 * (upsert, reviewer_type='human'), then refreshes so the accuracy strip and any
 * derived state recompute. The selected direction tints green (up) / red (down).
 */
export default function ReviewControls({
  runId,
  findingKey,
  persona,
  initialVerdict,
}: {
  runId: string;
  findingKey: string;
  persona: string;
  initialVerdict: "up" | "down" | null;
  /** Accepted for backward-compat with the run-detail call; unused (the inline
   *  note textarea was dropped per the v2 matrix design). */
  initialComment?: string | null;
}) {
  const router = useRouter();
  const [verdict, setVerdict] = useState<"up" | "down" | null>(initialVerdict);
  const [busy, setBusy] = useState(false);

  async function save(next: "up" | "down") {
    const prev = verdict;
    setBusy(true);
    setVerdict(next); // optimistic
    try {
      const res = await fetch(`/api/runs/${runId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ findingKey, persona, verdict: next }),
      });
      if (res.ok) router.refresh();
      else setVerdict(prev);
    } catch {
      setVerdict(prev);
    } finally {
      setBusy(false);
    }
  }

  const on = {
    up: { background: "rgba(31,157,99,0.12)", color: "#1f7d51", borderColor: "rgba(31,157,99,0.4)" },
    down: { background: "rgba(204,59,70,0.1)", color: "#b6353f", borderColor: "rgba(204,59,70,0.4)" },
  } as const;
  const off = { background: "#fff", color: "#98907f", borderColor: "#e5e0d6" } as const;

  const btn = (dir: "up" | "down", glyph: string) => (
    <button
      type="button"
      disabled={busy}
      onClick={() => save(dir)}
      aria-pressed={verdict === dir}
      aria-label={dir === "up" ? "Agree" : "Disagree"}
      className="flex-1 cursor-pointer rounded-md border py-[5px] text-[11px] font-semibold disabled:opacity-60"
      style={verdict === dir ? on[dir] : off}
    >
      {glyph}
    </button>
  );

  return (
    <div>
      <div className="mb-1 text-[9.5px] text-ink-6">Your review · judge 1–5</div>
      <div className="flex gap-[5px]">
        {btn("up", "▲")}
        {btn("down", "▼")}
      </div>
    </div>
  );
}
