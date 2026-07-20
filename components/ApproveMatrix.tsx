"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatTimestamp } from "@/lib/validation";

/**
 * The human approval gate, rendered as the matrix's hero footer. Writing an
 * approval is the SOLE trigger for the Phase-3 matrix→Linear push; this control
 * is the only way to create one from the UI. Single-click (no confirm sub-step);
 * idempotent — approving an approved run is a no-op. Once approved it shows
 * who/when and cannot be un-approved here.
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

  async function approve() {
    setBusy(true);
    try {
      const res = await fetch(`/api/runs/${runId}/approve`, { method: "POST" });
      if (res.ok) router.refresh();
    } catch {
      /* refresh will reflect real state */
    } finally {
      setBusy(false);
    }
  }

  if (approved) {
    return (
      <div
        className="flex items-center gap-[13px] border-t px-5 py-[15px]"
        style={{ background: "rgba(31,157,99,0.06)", borderTopColor: "rgba(31,157,99,0.24)" }}
      >
        <div
          className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-lg text-[18px] text-green"
          style={{ background: "rgba(31,157,99,0.13)" }}
        >
          ✓
        </div>
        <div className="flex-1">
          <div className="text-[14px] font-semibold text-ink">
            Matrix approved by {approvedBy ?? "admin"} ·{" "}
            {approvedAt ? formatTimestamp(approvedAt) : "just now"}
          </div>
          <div className="mt-[2px] text-[12px] text-ink-4">
            Approval written to <span className="font-mono text-ink-3">approvals</span> — the sole
            trigger for the matrix→Linear push.{" "}
            <span className="font-medium text-green-dark">Eligible for the Work board push.</span>
          </div>
        </div>
        <Link
          href="/work"
          className="flex-none cursor-pointer rounded-lg bg-accent px-[15px] py-[9px] text-[12.5px] font-semibold text-white hover:brightness-[1.08]"
        >
          View on Work board →
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-[13px] border-t border-line-2 bg-card-alt px-5 py-[15px]">
      <div
        className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-lg"
        style={{ background: "rgba(176,119,20,0.1)" }}
      >
        <span
          className="h-[11px] w-[11px] rounded-[3px]"
          style={{ border: "2px solid #b07714" }}
        />
      </div>
      <div className="flex-1">
        <div className="text-[14px] font-semibold text-ink">Not yet approved</div>
        <div className="mt-[2px] text-[12px] text-ink-4">
          Human approval is the <span className="font-semibold text-ink-2">only</span> trigger for
          pushing matrix-derived tickets to Linear — the gate is enforced server-side.
        </div>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={approve}
        className="flex-none cursor-pointer rounded-lg bg-accent px-[17px] py-[9px] text-[12.5px] font-semibold text-white shadow-accent hover:brightness-[1.08] disabled:opacity-60"
      >
        {busy ? "Approving…" : "Approve matrix →"}
      </button>
    </div>
  );
}
