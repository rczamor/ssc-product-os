"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function UserMenu({ initials, label }: { initials: string; label: string }) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    setLoggingOut(true);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    await fetch("/api/auth/logout", { method: "POST", signal: controller.signal }).catch(() => {});
    clearTimeout(timeout);
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="ml-auto flex items-center gap-3.5">
      <div className="flex items-center gap-2">
        <div className="flex h-[26px] w-[26px] items-center justify-center rounded-full border border-line-3 bg-[#ece7de] text-[11px] font-semibold text-ink-3">
          {initials}
        </div>
        <span className="text-xs text-ink-4">{label}</span>
      </div>
      <button
        onClick={logout}
        disabled={loggingOut}
        className="whitespace-nowrap border-l border-line pl-3.5 text-xs font-medium text-ink-4 hover:text-ink disabled:opacity-50"
      >
        {loggingOut ? "Logging out…" : "Log out"}
      </button>
    </div>
  );
}
