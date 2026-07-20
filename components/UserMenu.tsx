"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function UserMenu({ initials, label }: { initials: string; label: string }) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState(false);

  async function logout() {
    setLoggingOut(true);
    setError(false);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch("/api/auth/logout", { method: "POST", signal: controller.signal });
      if (!res.ok) throw new Error(`logout failed (${res.status})`);
      router.push("/login");
      router.refresh();
    } catch {
      setError(true);
      setLoggingOut(false);
    } finally {
      clearTimeout(timeout);
    }
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
        title={error ? "Logout failed — try again" : undefined}
        className={`whitespace-nowrap border-l pl-3.5 text-xs font-medium hover:text-ink disabled:opacity-50 ${
          error ? "border-red/30 text-red" : "border-line text-ink-4"
        }`}
      >
        {loggingOut ? "Logging out…" : error ? "Log out (failed, retry)" : "Log out"}
      </button>
    </div>
  );
}
