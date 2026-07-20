"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Plan" },
  { href: "/work", label: "Work" },
  { href: "/metrics", label: "Measure" },
  { href: "/personas", label: "Personas" },
] as const;

export default function NavTabs() {
  const pathname = usePathname();
  return (
    <nav className="flex h-full items-stretch gap-0.5">
      {TABS.map((t) => {
        const active =
          t.href === "/"
            ? pathname === "/" || pathname?.startsWith("/runs")
            : pathname?.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`relative flex h-full flex-col justify-center px-3.5 text-[13px] font-semibold tracking-tight ${
              active ? "text-ink" : "text-ink-5 hover:text-ink"
            }`}
          >
            {t.label}
            {active && (
              <span className="absolute inset-x-[11px] bottom-0 h-0.5 rounded-t-sm bg-accent" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
