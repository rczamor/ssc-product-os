"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatTimestamp } from "@/lib/validation";

/**
 * The human approval gate, rendered as the matrix's hero footer. Approval is the
 * SOLE trigger for the matrix→Linear push, and here it also PERFORMS it: approving
 * writes the `approvals` row, archives any downvoted-and-unflagged themes, and
 * creates tickets for ONLY the themes flagged "Add to ticket" (flagging is the sole
 * convert trigger — nothing flagged means no tickets). Three states:
 *   1. not approved      → "Approve & create tickets" / "Approve plan"
 *   2. approved, unpushed → "Create tickets in Linear" (e.g. approved before this
 *                           was wired, or a prior push hit a missing LINEAR_API_KEY)
 *   3. approved, pushed  → "N tickets created" + a link to the Work board.
 * Idempotent throughout: re-approving/re-pushing creates nothing new. While a
 * click is in flight it reports busy via `onBusyChange` so the parent can lock the
 * themes area (no voting / flagging mid-approval).
 */
export default function ApproveMatrix({
  runId,
  approved,
  approvedBy,
  approvedAt,
  selectedCount = 0,
  pushed = false,
  pushedCount = 0,
  onBusyChange,
}: {
  runId: string;
  approved: boolean;
  approvedBy: string | null;
  approvedAt: string | null;
  selectedCount?: number;
  pushed?: boolean;
  pushedCount?: number;
  onBusyChange?: (busy: boolean) => void;
}) {
  const router = useRouter();
  const [busy, setBusyState] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Mirror every busy transition up to the parent so it can gray out / block the
  // themes area for the duration of the approval.
  const setBusy = (next: boolean) => {
    setBusyState(next);
    onBusyChange?.(next);
  };

  /** Create the tickets in Linear. Surfaces the 503 (no key) / 409 (nothing to
   *  draft) states as a message rather than failing silently. */
  async function pushTickets(): Promise<void> {
    const res = await fetch(`/api/runs/${runId}/tickets/push`, { method: "POST" });
    const data = (await res.json().catch(() => ({}))) as {
      count?: number;
      ticketCount?: number;
      error?: string;
    };
    if (res.ok) {
      setMsg(data.count ? `Created ${data.count} ticket${data.count === 1 ? "" : "s"} in Linear.` : "No new tickets to create.");
    } else if (res.status === 503) {
      setMsg(
        `Approved and ${data.ticketCount ?? 0} ticket${data.ticketCount === 1 ? "" : "s"} drafted, but LINEAR_API_KEY isn't set — nothing was pushed to Linear.`,
      );
    } else if (res.status === 409) {
      setMsg("Approved — no themes were flagged “Add to ticket”, so no tickets were created.");
    } else {
      setMsg("Couldn't create tickets — please try again.");
    }
  }

  async function approveAndPush() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/runs/${runId}/approve`, { method: "POST" });
      if (!res.ok) {
        setMsg("Approval failed — please try again.");
        return;
      }
      await pushTickets();
    } catch {
      setMsg("Something went wrong — please try again.");
    } finally {
      setBusy(false);
      router.refresh();
    }
  }

  async function createTickets() {
    setBusy(true);
    setMsg(null);
    try {
      await pushTickets();
    } catch {
      setMsg("Something went wrong — please try again.");
    } finally {
      setBusy(false);
      router.refresh();
    }
  }

  // State 3 — approved AND pushed.
  if (approved && pushed) {
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
            {pushedCount} ticket{pushedCount === 1 ? "" : "s"} created in Linear
            {approvedBy ? ` · approved by ${approvedBy}` : ""}
            {approvedAt ? ` · ${formatTimestamp(approvedAt)}` : ""}
          </div>
          <div className="mt-[2px] text-[12px] text-ink-4">
            Pushed from the approved matrix (Fix / Double-Down &rarr; epics, Kill &rarr; CCB
            decisions). Re-approving creates nothing new.
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

  // State 2 — approved but not yet pushed (offer an explicit create-tickets action).
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
            Matrix approved{approvedBy ? ` by ${approvedBy}` : ""} — no tickets created yet
          </div>
          <div className="mt-[2px] text-[12px] text-ink-4">
            {msg ?? (
              <>
                {selectedCount > 0 ? (
                  <>
                    <span className="font-semibold text-accent">{selectedCount}</span> flagged theme
                    {selectedCount === 1 ? "" : "s"} will convert.
                  </>
                ) : (
                  "No themes flagged “Add to ticket” — nothing to convert."
                )}
              </>
            )}
          </div>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={createTickets}
          className="flex-none cursor-pointer rounded-lg bg-accent px-[17px] py-[9px] text-[12.5px] font-semibold text-white shadow-accent hover:brightness-[1.08] disabled:opacity-60"
        >
          {busy ? "Creating…" : "Create tickets in Linear →"}
        </button>
      </div>
    );
  }

  // State 1 — not approved.
  return (
    <div className="flex items-center gap-[13px] border-t border-line-2 bg-card-alt px-5 py-[15px]">
      <div
        className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-lg"
        style={{ background: "rgba(176,119,20,0.1)" }}
      >
        <span className="h-[11px] w-[11px] rounded-[3px]" style={{ border: "2px solid #b07714" }} />
      </div>
      <div className="flex-1">
        <div className="text-[14px] font-semibold text-ink">Not yet approved</div>
        <div className="mt-[2px] text-[12px] text-ink-4">
          Human approval is the <span className="font-semibold text-ink-2">only</span> trigger for
          pushing matrix-derived tickets to Linear — the gate is enforced server-side.
        </div>
        <div className="mt-[4px] text-[11.5px] text-ink-5">
          {msg ?? (
            <>
              {selectedCount > 0 ? (
                <>
                  <span className="font-semibold text-accent">{selectedCount}</span> theme
                  {selectedCount === 1 ? "" : "s"} flagged &ldquo;Add to ticket&rdquo; — approval
                  creates <span className="font-medium text-ink-3">only those</span> and archives any
                  downvoted themes.
                </>
              ) : (
                <>
                  No themes flagged &ldquo;Add to ticket&rdquo; — approval creates no tickets and
                  archives any downvoted themes. Use{" "}
                  <span className="font-medium text-ink-3">+ Add to ticket</span> on a row to convert
                  it.
                </>
              )}
            </>
          )}
        </div>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={approveAndPush}
        className="flex-none cursor-pointer rounded-lg bg-accent px-[17px] py-[9px] text-[12.5px] font-semibold text-white shadow-accent hover:brightness-[1.08] disabled:opacity-60"
      >
        {busy
          ? selectedCount > 0
            ? "Creating tickets…"
            : "Approving…"
          : selectedCount > 0
            ? "Approve & create tickets →"
            : "Approve plan →"}
      </button>
    </div>
  );
}
