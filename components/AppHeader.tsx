"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import NavTabs from "@/components/NavTabs";
import UserMenu from "@/components/UserMenu";

export default function AppHeader({ initials, label }: { initials: string; label: string }) {
  const pathname = usePathname();
  if (pathname === "/login") return null;

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-[26px] border-b border-line bg-white/88 px-6 backdrop-blur-md">
      <Link href="/" className="flex items-center gap-[11px]">
        <div className="flex h-[26px] w-[26px] items-center justify-center rounded-[7px] bg-accent">
          <div className="h-2.5 w-2.5 rotate-45 rounded-sm border-2 border-white" />
        </div>
        <div className="text-[13.5px] font-bold leading-[1.05] tracking-[-0.01em] text-ink">
          SSC Product OS
        </div>
      </Link>
      <NavTabs />
      <UserMenu initials={initials} label={label} />
    </header>
  );
}
