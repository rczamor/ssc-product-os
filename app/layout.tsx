import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import AppHeader from "@/components/AppHeader";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains-mono" });

export const metadata: Metadata = {
  title: "SSC Product OS",
  description:
    "Admin console for AI persona agents evaluating the SecurityScorecard platform",
};

/**
 * Chrome identity (A19). Prefers ADMIN_DISPLAY_NAME ("Riché Zamor" → "RZ" /
 * "Riché Z."); otherwise derives a best-effort label from ADMIN_EMAIL.
 */
function accountLabel(): { initials: string; label: string } {
  const display = process.env.ADMIN_DISPLAY_NAME?.trim();
  if (display) {
    const words = display.split(/\s+/).filter(Boolean);
    const initials = (
      words.length > 1 ? words[0][0] + words[words.length - 1][0] : words[0].slice(0, 2)
    ).toUpperCase();
    const label = words.length > 1 ? `${words[0]} ${words[words.length - 1][0]}.` : words[0];
    return { initials, label };
  }
  const email = process.env.ADMIN_EMAIL?.trim();
  if (!email) return { initials: "A", label: "Admin" };
  const local = email.split("@")[0];
  const parts = local.split(/[._-]+/).filter(Boolean);
  const initials = (parts.length > 1 ? parts[0][0] + parts[1][0] : local.slice(0, 2)).toUpperCase();
  const label = parts.length > 1 ? parts.map((p) => p[0].toUpperCase() + p.slice(1)).join(" ") : local;
  return { initials, label };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const account = accountLabel();
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body>
        <div className="min-h-screen bg-paper">
          <AppHeader initials={account.initials} label={account.label} />
          {/* Bare wrapper — each screen sets its own max-width/padding so Work &
              Measure can be 1300px while Plan is 1240px, matching the mockup. */}
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
