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

/** Plain-English title for each kind of problem. */
function plainTitle(f: Finding): string {
  if (f.type === "duplicate") return "Billed twice";
  return f.referenceKind === "opps" ? "Hospital fee much higher than Medicare pays" : "Much higher than Medicare pays";
}

/** Short, jargon-free explanation built from the finding's numbers. */
function plainExplanation(f: Finding): string {
  if (f.type === "duplicate") {
    return "This charge appears twice: same code, same day, same price. Ask the hospital to confirm it was really done twice. If not, it should come off your bill.";
  }
  const units = f.units > 0 ? f.units : 1;
  const perUnit = f.charge / units;
  const k = f.referenceKind === "opps" ? OPPS_MULTIPLIER : MEDICARE_MULTIPLIER;
  const who = f.referenceKind === "opps" ? "Medicare pays hospitals" : "Medicare pays";
  const each = units > 1 ? " each" : "";
  if (f.medicareRate === undefined) return f.explanation;
  return `You were charged ${formatUSD(perUnit)}${each}. ${who} about ${formatUSD(f.medicareRate)} for the same thing${
    f.multiple !== undefined ? ` — that's ${f.multiple.toFixed(1)} times more` : ""
  }. To be fair to the hospital, we only count the part above ${k} times the Medicare price.`;
}

function LockedDetails({ onUnlock }: { onUnlock: () => void }) {
  return (
    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      {/* Placeholder only — the real explanation is not rendered for free users. */}
      <div aria-hidden className="pointer-events-none flex-1 select-none space-y-2 blur-[2px]">
        <div className="h-2.5 w-11/12 rounded-full bg-slate-200/80" />
        <div className="h-2.5 w-8/12 rounded-full bg-slate-200/80" />
      </div>
      <button
        type="button"
        onClick={onUnlock}
        className="shrink-0 self-start text-sm font-medium text-emerald-700 hover:text-emerald-800 focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 sm:self-auto"
      >
        <span aria-hidden>🔒 </span>See why with Pro
      </button>
    </div>
  );
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
    <li className="rounded-3xl bg-slate-50 p-5 sm:p-6" aria-label={`Problem ${index + 1}: ${plainTitle(f)}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-lg font-semibold tracking-tight text-slate-900">
            <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
            {plainTitle(f)}
          </p>
          <p className="mt-1 break-words text-base text-slate-700">{f.description}</p>
          <p className="mt-0.5 text-sm text-slate-500">
            Charged {formatUSD(f.charge)}
            {f.units > 1 ? ` for ${f.units} units` : ""}
            {f.dateOfService ? ` on ${prettyDate(f.dateOfService)}` : ""}
            {f.cpt ? ` · code ${f.cpt}` : ""}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xl font-semibold tabular-nums text-emerald-700 sm:text-2xl">{usd0(f.disputeAmount)}</p>
          <p className="text-sm text-slate-500">to dispute</p>
        </div>
      </div>

      <FindingOutcomeStats hospital={hospital || null} cpt={f.cpt} stats={stats} />

      {pro ? (
        <div className="mt-4 space-y-2">
          <p className="text-base leading-relaxed text-slate-700">{plainExplanation(f)}</p>
          {duplicateOf ? <p className="text-sm text-slate-500">Same as: {duplicateOf}</p> : null}
          <p className="text-xs leading-relaxed text-slate-400">
            Rule: {f.ruleRef} Source: {f.source}.
          </p>
        </div>
      ) : (
        <LockedDetails onUnlock={onUnlock} />
      )}
    </li>
  );
}
