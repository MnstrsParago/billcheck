"use client";

import { Button } from "@/components/ui/Button";

const usd0 = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

const FEATURES = ["Letter to the hospital", "Reasons for each charge", "Reminders"];

export const PAYWALL_ID = "upgrade";

export function Paywall({ onUpgrade }: { disputable: number; onUpgrade: () => void }) {
  return (
    <section id={PAYWALL_ID} tabIndex={-1} aria-label="Upgrade" className="space-y-2 text-center outline-none">
      <Button size="lg" data-tour="upgrade" onClick={onUpgrade} aria-describedby="demo-note" className="w-full sm:w-auto">
        Upgrade — $12/mo
      </Button>
      <p id="demo-note" className="text-sm text-slate-400">
        Demo unlock — no real charge
      </p>
    </section>
  );
}
