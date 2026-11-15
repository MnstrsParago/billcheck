"use client";

import { CHARITY_NOTE } from "@/lib/audit/charity";
import { formatUSD } from "@/lib/audit";
import type { CharityResult, CharityStatus, HouseholdInput } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { HouseholdFields } from "./HouseholdFields";

export const CHARITY_LABEL: Record<CharityStatus, string> = {
  likely: "Likely eligible",
  possibly: "Possibly eligible",
  not_likely: "Not likely",
  not_checked: "Not checked",
};

const STATUS_COLOR: Record<CharityStatus, string> = {
  likely: "text-emerald-700",
  possibly: "text-amber-700",
  not_likely: "text-slate-500",
  not_checked: "text-slate-500",
};

const PLAIN: Record<CharityStatus, string> = {
  likely: "Many hospitals give free or much cheaper care at your income.",
  possibly: "You may get a partial discount. Ask.",
  not_likely: "Probably above most limits, but you can still ask.",
  not_checked: "Enter your household and income to check.",
};

/** Whole-number FPL percent for plain text ("180%"). */
const pct = (n: number) => `${Math.round(n)}%`;

export function CharityCard({
  charity,
  household,
  onHousehold,
}: {
  charity: CharityResult;
  household: HouseholdInput;
  onHousehold: (h: HouseholdInput) => void;
}) {
  const checked = charity.status !== "not_checked";
  return (
    <Card className="space-y-4">
      <div>
        <h3 className="text-xl font-semibold tracking-tight text-slate-900">Free or cheaper care</h3>
        <p className={`mt-1 text-base font-medium ${STATUS_COLOR[charity.status]}`}>{CHARITY_LABEL[charity.status]}</p>
      </div>
      <p className="text-base text-slate-600">{PLAIN[charity.status]}</p>
      {checked && charity.fplPercent !== null ? (
        <p className="text-sm text-slate-500">
          <span className="tabular-nums">{pct(charity.fplPercent)}</span> of the federal poverty line
          {charity.guideline !== null ? <> ({formatUSD(charity.guideline)})</> : null}.
        </p>
      ) : null}
      {!checked ? (
        <HouseholdFields value={household} onChange={onHousehold} idPrefix="res" />
      ) : (
        <details className="group">
          <summary className="cursor-pointer text-sm font-medium text-emerald-700 hover:text-emerald-800">
            Change household details
          </summary>
          <div className="mt-3">
            <HouseholdFields value={household} onChange={onHousehold} idPrefix="res" />
          </div>
        </details>
      )}
      <p className="text-xs text-slate-400" title={CHARITY_NOTE}>
        Source: HHS 2026 poverty guidelines.
      </p>
    </Card>
  );
}
