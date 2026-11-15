"use client";

import { formatUSD } from "@/lib/audit";
import { MEDICARE_MULTIPLIER, OPPS_MULTIPLIER } from "@/lib/audit/medicare";
import type { CodeOutcomeStats, Finding } from "@/lib/types";
import { FindingOutcomeStats } from "@/components/outcomes/FindingOutcomeStats";

const prettyDate = (ymd: string) => {
  const t = Date.parse(`${ymd}T00:00:00Z`);
  return Number.isFinite(t)
    ? new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
    : ymd;
};

/** Whole dollars for the big amounts ("$5,943"). */
const usd0 = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

/** What's wrong, in 2–4 words. */
function plainTitle(f: Finding): string {
  if (f.type === "duplicate") return "Billed twice";
  return f.referenceKind === "opps" ? "High fee" : "Over Medicare";
}

/** "CT head/brain without contrast" -> "CT head". */
function shortName(f: Finding): string {
  const first = f.description.split(/[,/(&]/)[0].trim();
  const words = first.split(/\s+/).slice(0, 2).join(" ");
  return words || (f.cpt ? `code ${f.cpt}` : "charge");
}

/** One short sentence built from the finding's numbers. */
function plainExplanation(f: Finding): string {
  if (f.type === "duplicate") return "Same code, same day, same price — ask the hospital to remove the copy.";
  if (f.medicareRate === undefined) return f.explanation;
  const units = f.units > 0 ? f.units : 1;
  const k = f.referenceKind === "opps" ? OPPS_MULTIPLIER : MEDICARE_MULTIPLIER;
  return `${formatUSD(f.charge / units)} vs. Medicare ${formatUSD(f.medicareRate)}${
    f.multiple !== undefined ? ` (${f.multiple.toFixed(1)}×)` : ""
  }; we count only the part above ${k}×.`;
}

export function FindingItem({
  finding: f,
  index,
  pro,
  hospital,
  stats,
  duplicateOf,
  onUnlock,
}: {
  finding: Finding;
  index: number;
  pro: boolean;
  hospital: string;
  stats?: CodeOutcomeStats;
  duplicateOf?: string;
  onUnlock: () => void;
}) {
  const dot = f.type === "duplicate" ? "bg-rose-500" : "bg-amber-500";
  return (
    <li aria-label={`Problem ${index + 1}: ${plainTitle(f)}`}>
      <details className="group rounded-2xl bg-slate-50 open:bg-slate-100/70">
        <summary className="flex cursor-pointer select-none list-none items-center justify-between gap-2 px-3.5 py-3.5 sm:gap-3 sm:px-5">
          <span className="flex min-w-0 items-center gap-2.5">
            <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
            <span className="truncate text-[15px] text-slate-900 sm:text-base">
              <span className="font-semibold">{plainTitle(f)}:</span> {shortName(f)}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-2">
            <span className="text-base font-semibold tabular-nums text-emerald-700 sm:text-lg">{usd0(f.disputeAmount)}</span>
            <span aria-hidden className="text-slate-400 transition group-open:rotate-90">›</span>
          </span>
        </summary>
        <div className="space-y-2 px-4 pb-4 text-sm text-slate-600 sm:px-5">
          <p>
            {f.description} · {formatUSD(f.charge)}
            {f.dateOfService ? ` · ${prettyDate(f.dateOfService)}` : ""}
            {f.cpt ? ` · code ${f.cpt}` : ""}
          </p>
          <FindingOutcomeStats hospital={hospital || null} cpt={f.cpt} stats={stats} />
          {pro ? (
            <>
              <p className="text-base text-slate-800">{plainExplanation(f)}</p>
              {duplicateOf ? <p>Same as: {duplicateOf}</p> : null}
              <p className="text-xs text-slate-400">Source: {f.source}.</p>
            </>
          ) : (
            <button type="button" onClick={onUnlock} className="font-medium text-emerald-700 hover:text-emerald-800">
              <span aria-hidden>🔒 </span>See why with Pro
            </button>
          )}
        </div>
      </details>
    </li>
  );
}
