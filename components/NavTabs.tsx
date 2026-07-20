"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Exactly three tabs, matching the mockup. Persona detail is a sub-view of Plan
// (reached from the Plan persona chips), not a top-level tab.
const TABS = [
  { href: "/", label: "Plan" },
  { href: "/work", label: "Work" },
  { href: "/metrics", label: "Measure" },
] as const;

export default function NavTabs() {
  const pathname = usePathname();
  return (
    <nav className="flex h-full items-stretch gap-0.5">
      {TABS.map((t) => {
        const active =
          t.href === "/"
            ? pathname === "/" ||
              pathname?.startsWith("/runs") ||
              pathname?.startsWith("/personas")
            : pathname?.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`relative flex h-full flex-col justify-center gap-px px-3.5 ${
              active ? "text-ink" : "text-ink-4 hover:text-ink"
            }`}
          >
            <span className="text-[13px] font-semibold tracking-[-0.01em]">{t.label}</span>
            {active && (
              <span className="absolute inset-x-[11px] bottom-0 h-0.5 rounded-t-sm bg-accent" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
