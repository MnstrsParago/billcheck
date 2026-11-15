"use client";

import { formatUSD } from "@/lib/audit";
import { Button } from "@/components/ui/Button";

const FEATURES = [
  "What's wrong with each line, the rule and the source of every number",
  "Ready-to-send dispute letter with your findings, CPT codes and amounts",
  "Charity care request letter with your income and % of the poverty level",
  "Dispute tracker with 30/60-day follow-ups, reminders (.ics) and follow-up letters",
  "Unlimited bills for your whole household",
];

export const PAYWALL_ID = "upgrade";

export function Paywall({ disputable, onUpgrade }: { disputable: number; onUpgrade: () => void }) {
  return (
    <div
      id={PAYWALL_ID}
      tabIndex={-1}
      className="rounded-2xl border border-emerald-200 bg-gradient-to-b from-emerald-50 to-white p-5 shadow-sm outline-none sm:p-6"
    >
      <h2 className="text-lg font-semibold text-slate-900">
        {disputable > 0 ? `Get the letter to dispute ${formatUSD(disputable)}` : "Unlock BillCheck Pro"}
      </h2>
      <ul className="mt-3 space-y-1.5 text-sm text-slate-700">
        {FEATURES.map((f) => (
          <li key={f} className="flex gap-2">
            <span aria-hidden className="text-emerald-600">
              ✓
            </span>
            {f}
          </li>
        ))}
      </ul>
      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <Button size="lg" data-tour="upgrade" onClick={onUpgrade} aria-describedby="demo-note">
          Upgrade — $12/mo
        </Button>
        <span
          id="demo-note"
          className="inline-flex w-fit items-center rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800"
        >
          Demo unlock — no real charge
        </span>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Disputes take 30–90 days. Pro keeps track of every deadline until the bill is fixed. Cancel anytime.
      </p>
    </div>
  );
}
