"use client";

import { useState } from "react";
import type { Dispute, WinningArgument } from "@/lib/types";
import { usd } from "@/lib/tracker/format";
import type { LineResolution } from "@/lib/tracker/store";

const ARGUMENTS: { value: WinningArgument; label: string }[] = [
  { value: "duplicate", label: "Duplicate charge" },
  { value: "above_medicare", label: "Above Medicare" },
  { value: "charity_care", label: "Charity care" },
];

type Row = { price: string; argument: WinningArgument };

export default function ResolveForm({
  dispute,
  onSubmit,
  onCancel,
}: {
  dispute: Dispute;
  onSubmit: (r: Record<string, LineResolution>) => void;
  onCancel: () => void;
}) {
  const [rows, setRows] = useState<Record<string, Row>>(() =>
    Object.fromEntries(
      dispute.lines.map((l) => [l.lineId, { price: String(l.originalPrice), argument: l.argument }]),
    ),
  );

  const parsed = dispute.lines.map((l) => {
    const row = rows[l.lineId];
    const n = row.price.trim() === "" ? NaN : Number(row.price);
    const error = !Number.isFinite(n)
      ? "Enter the new price"
      : n < 0
        ? "Can't be negative"
        : n > l.originalPrice
          ? `Can't be more than ${usd(l.originalPrice)}`
          : null;
    return { line: l, row, value: n, error };
  });
  const hasError = parsed.some((p) => p.error);
  const saved = parsed.reduce((s, p) => s + (p.error ? 0 : p.line.originalPrice - p.value), 0);

  const set = (id: string, patch: Partial<Row>) => setRows((r) => ({ ...r, [id]: { ...r[id], ...patch } }));

  return (
    <form
      className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50/50 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (hasError) return;
        onSubmit(
          Object.fromEntries(parsed.map((p) => [p.line.lineId, { finalPrice: p.value, argument: p.row.argument }])),
        );
      }}
    >
      <p className="text-sm font-medium text-slate-900">What did the provider agree to charge?</p>
      {parsed.map(({ line, row, error }) => (
        <div key={line.lineId} className="rounded-md bg-white p-3 ring-1 ring-slate-200">
          <p className="text-sm text-slate-800">
            <span className="font-mono text-xs text-slate-500">{line.cpt ?? "—"}</span> {line.description}
          </p>
          <p className="text-xs text-slate-500">Original: {usd(line.originalPrice)}</p>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="text-xs text-slate-600">
              New price ($)
              <input
                type="number"
                inputMode="decimal"
                min={0}
                max={line.originalPrice}
                step="0.01"
                value={row.price}
                onChange={(e) => set(line.lineId, { price: e.target.value })}
                className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
              />
            </label>
            <label className="text-xs text-slate-600">
              Winning argument
              <select
                value={row.argument}
                onChange={(e) => set(line.lineId, { argument: e.target.value as WinningArgument })}
                className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
              >
                {ARGUMENTS.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
        </div>
      ))}
      <p className="text-sm text-slate-800">
        You saved: <span className="font-semibold text-emerald-700">{usd(Math.max(0, saved))}</span>
      </p>
      <p className="text-xs text-slate-500">
        Anonymous result (hospital, state, CPT, prices, winning argument) is added to the shared outcomes database.
      </p>
      <div className="flex gap-2">
        <button
          type="submit"
          data-tour="save-resolved"
          disabled={hasError}
          className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
        >
          Save as resolved
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 sm:flex-none"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
