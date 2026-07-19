"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatTimestamp } from "@/lib/validation";

/**
 * The human approval gate. Writing an approval is the SOLE trigger for the
 * Phase-3 matrix→Linear push; this control is the only way to create one from
 * the UI. Idempotent — approving an approved run is a no-op. Once approved it
 * shows who/when and cannot be un-approved here.
 */
export default function ApproveMatrix({
  runId,
  approved,
  approvedBy,
  approvedAt,
}: {
  runId: string;
  approved: boolean;
  approvedBy: string | null;
  approvedAt: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function approve() {
    setBusy(true);
    try {
      const res = await fetch(`/api/runs/${runId}/approve`, { method: "POST" });
      if (res.ok) router.refresh();
    } catch {
      /* refresh will reflect real state */
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  if (approved) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
        <span className="font-medium text-emerald-800">✓ Matrix approved</span>
        <span className="text-emerald-700">
          by {approvedBy}
          {approvedAt ? ` · ${formatTimestamp(approvedAt)}` : ""}
        </span>
        <span className="text-xs text-emerald-600">— eligible for the Linear push</span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
      <div className="text-sm text-amber-800">
        <span className="font-medium">Not yet approved.</span> Approving is the only trigger for
        pushing this matrix to Linear.
      </div>
      {confirming ? (
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={approve}
            className="rounded-md bg-emerald-600 px-3 py-1 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {busy ? "Approving…" : "Confirm approval"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setConfirming(false)}
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="ml-auto rounded-md bg-slate-900 px-3 py-1 text-sm font-medium text-white hover:bg-slate-700"
        >
          Approve matrix
        </button>
      )}
    </div>
  );
}
