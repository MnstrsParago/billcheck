"use client";

import { Button } from "@/components/ui/Button";

const usd0 = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

const FEATURES = [
  "Why each charge is wrong, in plain words",
  "A ready-to-send letter to the hospital",
  "A letter to ask for free or cheaper care",
  "Reminders until the bill is fixed",
];

export const PAYWALL_ID = "upgrade";

export function Paywall({ disputable, onUpgrade }: { disputable: number; onUpgrade: () => void }) {
  return (
    <section
      id={PAYWALL_ID}
      tabIndex={-1}
      aria-labelledby="paywall-title"
      className="rounded-3xl bg-emerald-50 px-5 py-8 text-center outline-none sm:px-10 sm:py-12"
    >
      <h2 id="paywall-title" className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
        {disputable > 0 ? `Get your letter to dispute ${usd0(disputable)}` : "Unlock BillCheck Pro"}
      </h2>
      <ul className="mx-auto mt-5 max-w-sm space-y-2 text-left text-base text-slate-700">
        {FEATURES.map((f) => (
          <li key={f} className="flex gap-3">
            <span aria-hidden className="font-semibold text-emerald-600">
              ✓
            </span>
            {f}
          </li>
        ))}
      </ul>
      <div className="mt-7 flex flex-col items-center gap-3">
        <Button size="lg" data-tour="upgrade" onClick={onUpgrade} aria-describedby="demo-note">
          Upgrade — $12/mo
        </Button>
        <span id="demo-note" className="text-sm font-medium text-amber-700">
          Demo unlock — no real charge
        </span>
      </div>
      <p className="mt-4 text-sm text-slate-500">Cancel anytime.</p>
    </section>
  );
}
