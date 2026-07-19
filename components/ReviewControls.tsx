"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Human up/down vote + comment on a single finding. Persists via
 * POST /api/runs/[id]/reviews (upsert), then refreshes so the accuracy strip and
 * badges recompute. Every review it writes is reviewer_type='human'.
 */
export default function ReviewControls({
  runId,
  findingKey,
  persona,
  initialVerdict,
  initialComment,
}: {
  runId: string;
  findingKey: string;
  persona: string;
  initialVerdict: "up" | "down" | null;
  initialComment: string | null;
}) {
  const router = useRouter();
  const [verdict, setVerdict] = useState<"up" | "down" | null>(initialVerdict);
  const [comment, setComment] = useState(initialComment ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showComment, setShowComment] = useState(Boolean(initialComment));

  async function save(nextVerdict: "up" | "down") {
    const prev = verdict; // roll back to this if the save fails
    setBusy(true);
    setError(null);
    setVerdict(nextVerdict); // optimistic
    try {
      const res = await fetch(`/api/runs/${runId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          findingKey,
          persona,
          verdict: nextVerdict,
          comment: comment.trim() || undefined,
        }),
      });
      if (res.ok) {
        router.refresh();
      } else {
        setVerdict(prev);
        setError("Couldn’t save your vote — please try again.");
      }
    } catch {
      setVerdict(prev);
      setError("Network error — your vote was not saved.");
    } finally {
      setBusy(false);
    }
  }

  const btn = (v: "up" | "down", label: string) => (
    <button
      type="button"
      disabled={busy}
      onClick={() => save(v)}
      className={`rounded-md border px-2 py-0.5 text-xs font-medium disabled:opacity-50 ${
        verdict === v
          ? v === "up"
            ? "border-emerald-300 bg-emerald-100 text-emerald-800"
            : "border-red-300 bg-red-100 text-red-800"
          : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
      }`}
      aria-pressed={verdict === v}
    >
      {label}
    </button>
  );

  return (
    <div className="mt-2 border-t border-slate-200/70 pt-2">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
          Your review
        </span>
        {btn("up", "▲ Agree")}
        {btn("down", "▼ Disagree")}
        <button
          type="button"
          onClick={() => setShowComment((s) => !s)}
          className="ml-auto text-[11px] text-indigo-600 hover:underline"
        >
          {showComment ? "hide note" : comment ? "edit note" : "add note"}
        </button>
      </div>
      {showComment && (
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          onBlur={() => verdict && save(verdict)}
          placeholder="Why? (saved with your vote)"
          rows={2}
          className="mt-2 w-full rounded-md border border-slate-200 px-2 py-1 text-xs focus:border-slate-400 focus:outline-none"
        />
      )}
      {error && <p className="mt-1 text-[11px] text-red-600">{error}</p>}
    </div>
  );
}
