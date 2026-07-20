import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "SSC Product OS — Persona Evaluation Agents",
  description:
    "Admin console for AI persona agents evaluating the SecurityScorecard platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              SSC Product OS{" "}
              <span className="font-normal text-slate-400">· persona evaluation agents</span>
            </Link>
            <nav className="flex gap-5 text-sm text-slate-600">
              <Link className="hover:text-slate-900" href="/">
                Planning
              </Link>
              <Link className="hover:text-slate-900" href="/work">
                Work
              </Link>
              <Link className="hover:text-slate-900" href="/metrics">
                Metrics
              </Link>
              <Link className="hover:text-slate-900" href="/personas">
                Personas
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
