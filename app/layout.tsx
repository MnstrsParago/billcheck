import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { ProBadge } from "@/components/ui/ProBadge";
import { JudgeTour } from "@/components/tour/JudgeTour";
import "./globals.css";

export const metadata: Metadata = {
  title: "BillCheck — find errors in your hospital bill",
  description:
    "Paste your itemized hospital bill. BillCheck finds duplicates and prices far above Medicare, checks charity care, and tracks your dispute to the end.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
          <nav aria-label="Main" className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
            <div className="flex items-center gap-2">
              <Link href="/" className="text-lg font-semibold tracking-tight">
                Bill<span className="text-emerald-600">Check</span>
              </Link>
              <ProBadge />
            </div>
            <div className="flex items-center gap-4 text-sm text-slate-600">
              <Link href="/" className="hover:text-slate-900">Check a bill</Link>
              <Link href="/tracker" className="hover:text-slate-900">Tracker</Link>
              <Link href="/hospitals" className="hover:text-slate-900">Hospitals</Link>
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-6 sm:py-10">{children}</main>
        <JudgeTour />
        <footer className="mx-auto max-w-5xl px-4 pb-10 text-xs text-slate-500">
          BillCheck is not legal or medical advice. Reference prices: CMS Medicare Physician Fee Schedule CY2026
          (RVU26D). Income thresholds: HHS 2026 Poverty Guidelines.
        </footer>
      </body>
    </html>
  );
}
