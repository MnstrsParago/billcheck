"use client";

import { formatUSD } from "@/lib/audit";
import type { CodeOutcomeStats, Finding } from "@/lib/types";
import { FindingOutcomeStats } from "@/components/outcomes/FindingOutcomeStats";
import { Badge } from "@/components/ui/Badge";

function LockedDetails({ onUnlock }: { onUnlock: () => void }) {
  return (
    <div className="relative mt-3 overflow-hidden rounded-lg border border-slate-200">
      {/* Placeholder text only — the real explanation is not rendered for free users. */}
      <div aria-hidden className="pointer-events-none select-none space-y-1.5 p-3 blur-[3px]">
        <div className="h-3 w-11/12 rounded bg-slate-200" />
        <div className="h-3 w-9/12 rounded bg-slate-200" />
        <div className="h-3 w-10/12 rounded bg-slate-200" />
        <div className="h-3 w-7/12 rounded bg-slate-200" />
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-white/60">
        <button
          type="button"
          onClick={onUnlock}
          className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          🔒 What&apos;s wrong, the rule and the source — Pro
        </button>
      </div>
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
  return (
    <li className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-400">#{index + 1}</span>
            <Badge tone={f.type === "duplicate" ? "rose" : "amber"}>{f.title}</Badge>
          </div>
          <p className="mt-1.5 font-medium text-slate-900">
            {f.cpt ? <span className="font-mono text-sm text-slate-600">{f.cpt} · </span> : null}
            {f.description}
          </p>
          <p className="text-xs text-slate-500">
            {f.dateOfService ?? "No date"} · charged {formatUSD(f.charge)}
            {f.units > 1 ? ` for ${f.units} units` : ""}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-lg font-semibold tabular-nums text-emerald-700">{formatUSD(f.disputeAmount)}</p>
          <p className="text-[11px] uppercase tracking-wide text-slate-400">to dispute</p>
        </div>
      </div>

      <FindingOutcomeStats hospital={hospital || null} cpt={f.cpt} stats={stats} />

      {pro ? (
        <dl className="mt-3 space-y-2 rounded-lg bg-slate-50 p-3 text-sm">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">What&apos;s wrong</dt>
            <dd className="text-slate-800">
              {f.explanation}
              {duplicateOf ? <span className="block text-xs text-slate-500">Repeats: {duplicateOf}</span> : null}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Rule</dt>
            <dd className="text-slate-700">{f.ruleRef}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Source of numbers</dt>
            <dd className="text-slate-700">
              {f.source}
              {f.medicareRate !== undefined && (
                <span className="block text-xs text-slate-500">
                  Reference {formatUSD(f.medicareRate)}/unit
                  {f.multiple !== undefined ? ` · charged ${f.multiple.toFixed(1)}× reference` : ""}
                </span>
              )}
            </dd>
          </div>
        </dl>
      ) : (
        <LockedDetails onUnlock={onUnlock} />
      )}
    </li>
  );
}
