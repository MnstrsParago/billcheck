import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { ProBadge } from "@/components/ui/ProBadge";
import { JudgeTour } from "@/components/tour/JudgeTour";
import { TourLink } from "@/components/tour/TourLink";
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
      <body className="min-h-screen bg-white text-slate-900 antialiased">
        <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-xl">
          <nav
            aria-label="Main"
            className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3 sm:flex-nowrap sm:px-5 sm:py-3.5"
          >
            <div className="flex items-center gap-2">
              <Link href="/" className="text-lg font-semibold tracking-tight">
                Bill<span className="text-emerald-600">Check</span>
              </Link>
              <span className="hidden sm:inline-flex">
                <ProBadge />
              </span>
            </div>
            <div className="sm:order-last">
              <TourLink />
            </div>
            <div className="flex w-full items-center justify-between text-sm text-slate-500 sm:w-auto sm:justify-end sm:gap-6">
              <Link href="/" className="hover:text-slate-900">Check a bill</Link>
              <Link href="/tracker" className="hover:text-slate-900">My disputes</Link>
              <Link href="/hospitals" className="hover:text-slate-900">Hospital ratings</Link>
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-5xl px-5 py-6 sm:py-12">{children}</main>
        <JudgeTour />
        <footer className="mx-auto max-w-5xl px-5 pb-12 pt-6 text-xs text-slate-400">
          BillCheck is not legal or medical advice. Prices: CMS Medicare 2026. Income limits: HHS 2026.
        </footer>
      </body>
    </html>
  );
}
