"use client";

import { formatUSD } from "@/lib/audit";
import {
  GFE_LABEL,
  PPDR_FEE,
  PPDR_SOURCE_URL,
  PPDR_THRESHOLD,
  PPDR_WINDOW_DAYS,
  type GfeInput,
  type GfeResult,
  type GfeStatus,
} from "@/lib/audit/gfe";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { inputClass } from "@/components/ui/Field";

const TONE: Record<GfeStatus, BadgeTone> = {
  not_checked: "sky",
  insured: "slate",
  below_threshold: "slate",
  eligible: "emerald",
  deadline_passed: "rose",
};

const longDate = (ymd: string) =>
  new Date(`${ymd}T00:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });

/** (D) No Surprises Act: compare the bill with the Good Faith Estimate (uninsured / self-pay patients). */
export function GfeCard({ gfe, input, onInput }: { gfe: GfeResult; input: GfeInput; onInput: (g: GfeInput) => void }) {
  return (
    <Card className="space-y-3" id="gfe-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Good Faith Estimate</h2>
        <Badge tone={TONE[gfe.status]}>{GFE_LABEL[gfe.status]}</Badge>
      </div>
      <p className="text-sm text-slate-600">
        Uninsured or paying yourself? Under the No Surprises Act the provider had to give you a Good Faith Estimate before
        scheduled care. If the bill is {formatUSD(PPDR_THRESHOLD).replace(".00", "")} or more above it, you can ask a
        federal reviewer to decide what you owe.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Estimate total ($)</span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            className={`${inputClass} mt-1`}
            placeholder="e.g. 1200"
            value={input.gfeAmount ?? ""}
            onChange={(e) => {
              const v = e.target.value === "" ? null : Number(e.target.value);
              onInput({ ...input, gfeAmount: v !== null && Number.isFinite(v) ? v : null });
            }}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Date on the bill</span>
          <input
            type="date"
            className={`${inputClass} mt-1`}
            value={input.billDate ?? ""}
            onChange={(e) => onInput({ ...input, billDate: e.target.value || null })}
          />
        </label>
      </div>
      <label className="flex items-start gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 accent-emerald-600"
          checked={input.selfPay}
          onChange={(e) => onInput({ ...input, selfPay: e.target.checked })}
        />
        I didn&apos;t have or didn&apos;t use health insurance for this care, and told the provider before the care.
      </label>

      {gfe.status === "not_checked" ? (
        <p className="text-sm text-slate-600">Enter the estimate total and the date on the bill to check.</p>
      ) : (
        <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
          <p>
            Billed {formatUSD(gfe.billed)} vs. estimate {formatUSD(gfe.gfeAmount ?? 0)}:{" "}
            <strong>
              {(gfe.difference ?? 0) >= 0 ? `${formatUSD(gfe.difference ?? 0)} over` : `${formatUSD(-(gfe.difference ?? 0))} under`}
            </strong>
            .
          </p>
          {gfe.status === "eligible" && gfe.deadline && (
            <p className="mt-1">
              You can start a federal patient-provider dispute until <strong>{longDate(gfe.deadline)}</strong> (
              {gfe.daysLeft} day{gfe.daysLeft === 1 ? "" : "s"} left; {PPDR_WINDOW_DAYS} days from the bill date). Fee: $
              {PPDR_FEE}. While it&apos;s in progress the provider can&apos;t send the bill to collections.
            </p>
          )}
          {gfe.status === "below_threshold" && (
            <p className="mt-1">The federal dispute applies only when the bill is at least $400 above the estimate.</p>
          )}
          {gfe.status === "deadline_passed" && gfe.deadline && (
            <p className="mt-1">The 120-day window ended on {longDate(gfe.deadline)}. You can still dispute directly with the provider.</p>
          )}
          {gfe.status === "insured" && (
            <p className="mt-1">This federal process is for uninsured or self-pay patients. With insurance, appeal through your plan.</p>
          )}
        </div>
      )}
      <p className="text-xs text-slate-500">
        Rules: billed ≥ $400 above the estimate, filed within 120 days of the bill date, $25 fee. Source:{" "}
        <a className="underline" href={PPDR_SOURCE_URL} target="_blank" rel="noopener noreferrer">
          CMS — Dispute a medical bill
        </a>
        . Not added to the amount you can dispute.
      </p>
    </Card>
  );
}
