"use client";

import { usePro } from "@/lib/pro";

/** Small "Pro (demo)" pill shown once the demo unlock is active. Renders nothing otherwise. */
export function ProBadge({ className = "" }: { className?: string }) {
  const pro = usePro();
  if (!pro) return null;
  return (
    <span
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white ${className}`}
      title="Pro features unlocked in demo mode. No real charge."
    >
      Pro (demo)
    </span>
  );
}
