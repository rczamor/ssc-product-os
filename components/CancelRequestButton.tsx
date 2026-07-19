"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function CancelRequestButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function cancel() {
    setBusy(true);
    await fetch(`/api/run-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled" }),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <button
      onClick={cancel}
      disabled={busy}
      className="text-xs text-slate-400 underline-offset-2 hover:text-red-600 hover:underline disabled:opacity-50"
    >
      {busy ? "…" : "cancel"}
    </button>
  );
}
