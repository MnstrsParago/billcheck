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
import { Card } from "@/components/ui/Card";
import { inputClass } from "@/components/ui/Field";

const STATUS_COLOR: Record<GfeStatus, string> = {
  not_checked: "text-slate-500",
  insured: "text-slate-500",
  below_threshold: "text-slate-500",
  eligible: "text-emerald-700",
  deadline_passed: "text-rose-700",
};

const longDate = (ymd: string) =>
  new Date(`${ymd}T00:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });

const threshold = formatUSD(PPDR_THRESHOLD).replace(".00", "");

/** (D) No Surprises Act: compare the bill with the Good Faith Estimate (uninsured / self-pay patients). */
export function GfeCard({ gfe, input, onInput }: { gfe: GfeResult; input: GfeInput; onInput: (g: GfeInput) => void }) {
  const diff = gfe.difference ?? 0;
  return (
    <Card className="space-y-4" id="gfe-card">
      <div>
        <h3 className="text-xl font-semibold tracking-tight text-slate-900">Did you get a price estimate?</h3>
        <p className={`mt-1 text-base font-medium ${STATUS_COLOR[gfe.status]}`}>{GFE_LABEL[gfe.status]}</p>
      </div>
      <p className="text-base text-slate-600">
        If you paid without insurance, the provider had to give you a written price estimate (a &quot;Good Faith
        Estimate&quot;) before planned care. If the bill is {threshold} or more above it, a federal reviewer can decide
        what you really owe.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Estimate total ($)</span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            className={inputClass}
            placeholder="e.g. 1200"
            value={input.gfeAmount ?? ""}
            onChange={(e) => {
              const v = e.target.value === "" ? null : Number(e.target.value);
              onInput({ ...input, gfeAmount: v !== null && Number.isFinite(v) ? v : null });
            }}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Date on the bill</span>
          <input
            type="date"
            className={inputClass}
            value={input.billDate ?? ""}
            onChange={(e) => onInput({ ...input, billDate: e.target.value || null })}
          />
        </label>
      </div>
      <label className="flex items-start gap-3 text-base text-slate-700">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 shrink-0 accent-emerald-600"
          checked={input.selfPay}
          onChange={(e) => onInput({ ...input, selfPay: e.target.checked })}
        />
        I didn&apos;t use health insurance for this care, and I told the provider before the care.
      </label>

      {gfe.status === "not_checked" ? (
        <p className="text-sm text-slate-500">Enter the estimate and the bill date to check.</p>
      ) : (
        <div className="space-y-1 rounded-2xl bg-white p-4 text-base text-slate-700">
          <p>
            You were billed {formatUSD(gfe.billed)}. The estimate was {formatUSD(gfe.gfeAmount ?? 0)}. That&apos;s{" "}
            <strong className="font-semibold">
              {diff >= 0 ? `${formatUSD(diff)} more` : `${formatUSD(-diff)} less`}
            </strong>
            .
          </p>
          {gfe.status === "eligible" && gfe.deadline && (
            <p>
              You can ask for a federal review until <strong className="font-semibold">{longDate(gfe.deadline)}</strong> (
              {gfe.daysLeft} day{gfe.daysLeft === 1 ? "" : "s"} left). It costs ${PPDR_FEE}. While it&apos;s open, the
              provider can&apos;t send your bill to collections.
            </p>
          )}
          {gfe.status === "below_threshold" && (
            <p>The federal review is only for bills at least {threshold} above the estimate.</p>
          )}
          {gfe.status === "deadline_passed" && gfe.deadline && (
            <p>
              The {PPDR_WINDOW_DAYS}-day window ended on {longDate(gfe.deadline)}. You can still dispute with the provider
              directly.
            </p>
          )}
          {gfe.status === "insured" && (
            <p>This federal review is for people without insurance. If you have insurance, appeal through your plan.</p>
          )}
        </div>
      )}
      <p className="text-xs leading-relaxed text-slate-400">
        Rules: bill {threshold}+ above the estimate, ask within {PPDR_WINDOW_DAYS} days of the bill date, ${PPDR_FEE} fee.
        Source:{" "}
        <a className="underline hover:text-slate-600" href={PPDR_SOURCE_URL} target="_blank" rel="noopener noreferrer">
          CMS — Dispute a medical bill
        </a>
        . Not added to the amount you can dispute.
      </p>
    </Card>
  );
}
