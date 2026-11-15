"use client";

import { useEffect, useState } from "react";
import { SAMPLES } from "@/lib/samples";
import type { HouseholdInput } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { inputClass } from "@/components/ui/Field";
import { HouseholdFields } from "./HouseholdFields";

const PROGRESS = [
  "Reading your bill…",
  "Finding each line item, CPT code and charge…",
  "Checking dates, units and totals…",
  "Almost done — structuring the lines for review…",
];

export const MAX_TEXT = 40000;

function Progress() {
  const [sec, setSec] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSec((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const msg = PROGRESS[Math.min(PROGRESS.length - 1, Math.floor(sec / 7))];
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
      <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" aria-hidden />
      <span>
        {msg} <span className="text-emerald-700/70">({sec}s — this usually takes 10–30 seconds)</span>
      </span>
    </div>
  );
}

export function InputStep({
  text,
  household,
  loading,
  onText,
  onHousehold,
  onSample,
  onSubmit,
  onManual,
  onCancel,
}: {
  text: string;
  household: HouseholdInput;
  loading: boolean;
  onText: (t: string) => void;
  onHousehold: (h: HouseholdInput) => void;
  onSample: (id: "A" | "B") => void;
  onSubmit: () => void;
  onManual: () => void;
  onCancel: () => void;
}) {
  const hasHousehold = household.annualIncome !== null || household.householdSize !== null || household.state !== null;
  const tooLong = text.length > MAX_TEXT;
  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Is your hospital bill right?</h1>
        <p className="max-w-2xl text-slate-600">
          Paste your itemized bill. In about a minute BillCheck flags possible duplicate charges, prices far above the
          Medicare reference, and whether you may qualify for charity care — then helps you dispute it.
        </p>
      </section>

      <Card className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <label htmlFor="bill-text" className="text-sm font-medium text-slate-700">
            Paste your itemized bill
          </label>
          <div className="flex flex-wrap gap-2">
            {SAMPLES.map((s) => (
              <Button key={s.id} variant="secondary" size="sm" disabled={loading} onClick={() => onSample(s.id)} title={s.label}>
                Try Sample {s.id} ({s.id === "A" ? "ER visit" : "outpatient"})
              </Button>
            ))}
          </div>
        </div>
        <textarea
          id="bill-text"
          rows={12}
          className={`${inputClass} font-mono text-xs sm:text-sm`}
          placeholder={"Date | CPT | Description | Units | Charge\n03/14/2026 | 70450 | CT head without contrast | 1 | $1,980.00\n…"}
          value={text}
          disabled={loading}
          onChange={(e) => onText(e.target.value)}
          aria-describedby="bill-text-hint"
        />
        <p id="bill-text-hint" className={`text-xs ${tooLong ? "text-rose-600" : "text-slate-500"}`}>
          {tooLong
            ? `That's ${text.length.toLocaleString()} characters — please trim to ${MAX_TEXT.toLocaleString()} (just the line items are enough).`
            : "Copy the text from your itemized statement (with dates, CPT codes and charges). Remove your name and account number if you like — we don't need them."}
        </p>

        <details className="group rounded-lg border border-slate-200 p-3" open={hasHousehold || undefined}>
          <summary className="cursor-pointer select-none text-sm font-medium text-slate-700">
            Charity care check <span className="font-normal text-slate-500">(optional)</span>
          </summary>
          <p className="mb-3 mt-2 text-xs text-slate-500">
            Nonprofit hospitals must offer financial assistance. We compare your income with the 2026 federal poverty
            guidelines. Nothing leaves your browser.
          </p>
          <HouseholdFields value={household} onChange={onHousehold} idPrefix="in" />
        </details>

        {loading ? (
          <div className="space-y-2">
            <Progress />
            <Button variant="ghost" size="sm" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button size="lg" onClick={onSubmit} disabled={!text.trim() || tooLong}>
              Check my bill
            </Button>
            <Button variant="ghost" onClick={onManual}>
              Enter lines manually instead
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
