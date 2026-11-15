"use client";

import { CHARITY_COPY, CHARITY_NOTE } from "@/lib/audit/charity";
import { formatUSD } from "@/lib/audit";
import type { CharityResult, CharityStatus, HouseholdInput } from "@/lib/types";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { HouseholdFields } from "./HouseholdFields";

export const CHARITY_LABEL: Record<CharityStatus, string> = {
  likely: "Likely eligible",
  possibly: "Possibly eligible",
  not_likely: "Not likely",
  not_checked: "Not checked",
};
const TONE: Record<CharityStatus, BadgeTone> = {
  likely: "emerald",
  possibly: "amber",
  not_likely: "slate",
  not_checked: "sky",
};

const REGION_LABEL: Record<CharityResult["region"], string> = {
  contiguous48AndDC: "48 states + DC",
  alaska: "Alaska",
  hawaii: "Hawaii",
};

export function CharityCard({
  charity,
  household,
  onHousehold,
}: {
  charity: CharityResult;
  household: HouseholdInput;
  onHousehold: (h: HouseholdInput) => void;
}) {
  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Charity care</h2>
        <Badge tone={TONE[charity.status]}>{CHARITY_LABEL[charity.status]}</Badge>
      </div>
      {charity.status !== "not_checked" && charity.fplPercent !== null ? (
        <p className="text-sm text-slate-700">
          Income {formatUSD(charity.annualIncome ?? 0)} for a household of {charity.householdSize} is{" "}
          <strong className="tabular-nums">{charity.fplPercent.toFixed(1)}%</strong> of the 2026 federal poverty level
          {charity.guideline !== null && (
            <>
              {" "}
              ({formatUSD(charity.guideline)}, {REGION_LABEL[charity.region]})
            </>
          )}
          .
        </p>
      ) : null}
      <p className="text-sm text-slate-600">{CHARITY_COPY[charity.status]}</p>
      {charity.status === "not_checked" ? (
        <div className="rounded-lg bg-slate-50 p-3">
          <HouseholdFields value={household} onChange={onHousehold} idPrefix="res" />
        </div>
      ) : (
        <details className="text-sm">
          <summary className="cursor-pointer text-slate-600 hover:text-slate-900">Change household details</summary>
          <div className="mt-2 rounded-lg bg-slate-50 p-3">
            <HouseholdFields value={household} onChange={onHousehold} idPrefix="res" />
          </div>
        </details>
      )}
      <p className="text-xs text-slate-500">
        {CHARITY_NOTE} Not added to the amount you can dispute.
      </p>
    </Card>
  );
}
