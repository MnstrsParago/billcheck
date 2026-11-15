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
  if (f.type === "duplicate") return "Same code, date and price as another line.";
  if (f.medicareRate === undefined) return f.explanation;
  const units = f.units > 0 ? f.units : 1;
  return `${formatUSD(f.charge / units)} vs. Medicare ${formatUSD(f.medicareRate)}${
    f.multiple !== undefined ? ` (${f.multiple.toFixed(1)}×)` : ""
  }.`;
}

const SOURCE_URL = {
  pfs: "https://www.cms.gov/medicare/payment/fee-schedules/physician",
  opps: "https://www.cms.gov/medicare/payment/prospective-payment-systems/hospital-outpatient-pps/quarterly-addenda-updates/october-2026-addendum-b",
} as const;

export function FindingItem({
  finding: f,
  index,
  pro,
  hospital,
  stats,
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
  const url = f.type === "above_medicare" ? SOURCE_URL[f.referenceKind ?? "pfs"] : null;
  return (
    <li aria-label={`Problem ${index + 1}: ${plainTitle(f)}`} className="py-3">
      <details className="group">
        <summary className="flex cursor-pointer select-none list-none items-baseline justify-between gap-3">
          <span className="min-w-0 truncate text-base text-slate-900">
            {plainTitle(f)} · {shortName(f)}
          </span>
          <span className="shrink-0 text-base font-semibold tabular-nums text-slate-900">{usd0(f.disputeAmount)}</span>
        </summary>
        <p className="mt-1 text-sm text-slate-600">
          {pro ? (
            <>
              {plainExplanation(f)}
              {url ? (
                <>
                  {" "}
                  <a href={url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
                    Source
                  </a>
                </>
              ) : null}
            </>
          ) : (
            <button type="button" onClick={onUnlock} className="underline underline-offset-4">
              See why (Pro)
            </button>
          )}
        </p>
      </details>
      <FindingOutcomeStats hospital={hospital || null} cpt={f.cpt} stats={stats} />
    </li>
  );
}
