"use client";

import { useState } from "react";
import { formatUSD } from "@/lib/audit";
import { US_STATES } from "@/lib/audit/charity";
import { emptyRow, parseMoney, validateRow, type EditableLine, type RowErrors } from "@/lib/state";
import { Button } from "@/components/ui/Button";
import { Field, inputClass } from "@/components/ui/Field";

const GRID = "md:grid-cols-[9.5rem_6rem_5.5rem_minmax(0,1fr)_4.5rem_7.5rem_2.5rem] md:items-start";

type ColKey = keyof Omit<EditableLine, "id">;
type Col = { key: ColKey; label: string; placeholder: string; inputMode?: "numeric" | "decimal"; type?: string };
const COLS: Col[] = [
  { key: "dateOfService", label: "Date", placeholder: "yyyy-mm-dd", type: "date" },
  { key: "cpt", label: "Code", placeholder: "70450" },
  { key: "modifiers", label: "Modifier", placeholder: "e.g. 59" },
  { key: "description", label: "What it's for", placeholder: "CT head without contrast" },
  { key: "units", label: "Qty", placeholder: "1", inputMode: "numeric" },
  { key: "charge", label: "Price ($)", placeholder: "0.00", inputMode: "decimal" },
];

export function LinesStep({
  rows,
  provider,
  hospitalState,
  dropped,
  extractError,
  onRows,
  onProvider,
  onHospitalState,
  onBack,
  onRun,
}: {
  rows: EditableLine[];
  provider: string;
  hospitalState: string;
  dropped: { index: number; reason: string }[];
  extractError: string | null;
  onRows: (r: EditableLine[]) => void;
  onProvider: (p: string) => void;
  onHospitalState: (s: string) => void;
  onBack: () => void;
  onRun: () => void;
}) {
  const [showErrors, setShowErrors] = useState(false);
  const errors: Record<string, RowErrors> = Object.fromEntries(rows.map((r) => [r.id, validateRow(r)]));
  const invalidCount = rows.filter((r) => Object.keys(errors[r.id]).length > 0).length;
  const total = rows.reduce((s, r) => s + (parseMoney(r.charge) ?? 0), 0);

  const update = (id: string, key: ColKey, value: string) =>
    onRows(rows.map((r) => (r.id === id ? { ...r, [key]: value } : r)));
  const remove = (id: string) => onRows(rows.filter((r) => r.id !== id));
  const add = () => onRows([...rows, emptyRow()]);

  const run = () => {
    if (rows.length === 0 || invalidCount > 0) {
      setShowErrors(true);
      return;
    }
    onRun();
  };

  return (
    <div className="space-y-10">
      <div>
        <Button variant="ghost" size="sm" className="-ml-3.5" data-tour="back" onClick={onBack}>
          ← Back
        </Button>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-5xl">Check the charges we found</h1>
        <p className="mt-3 text-lg text-slate-600">Fix anything wrong, then check.</p>
      </div>

      {extractError && (
        <div role="alert" className="rounded-3xl bg-amber-50 p-5 text-base text-amber-900 sm:p-6">
          <p className="font-semibold">We couldn&apos;t read your bill automatically.</p>
          <p className="mt-1">{extractError}</p>

        </div>
      )}

      {dropped.length > 0 && (
        <div className="rounded-3xl bg-slate-50 p-5 text-base text-slate-700 sm:p-6">
          <p className="font-semibold text-slate-900">
            We couldn&apos;t read {dropped.length} line{dropped.length === 1 ? "" : "s"}, so we left{" "}
            {dropped.length === 1 ? "it" : "them"} out.
          </p>
          <ul className="mt-2 space-y-1 text-sm text-slate-600">
            {dropped.map((d) => (
              <li key={d.index}>
                Line {d.index + 1}: {d.reason}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-slate-600">If they are real charges, add them below.</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_14rem]">
        <Field label="Hospital or doctor's office" htmlFor="provider" hint="We put this name in your letters.">
          <input
            id="provider"
            className={inputClass}
            value={provider}
            placeholder="e.g. Riverside General Hospital"
            onChange={(e) => onProvider(e.target.value)}
          />
        </Field>
        <Field label="Hospital's state" htmlFor="hospital-state">
          <select
            id="hospital-state"
            className={inputClass}
            value={hospitalState}
            onChange={(e) => onHospitalState(e.target.value)}
          >
            <option value="">Not sure</option>
            {US_STATES.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <section aria-label="Charges" className="space-y-3">
        <div className={`hidden gap-2 px-1 text-sm font-medium text-slate-500 md:grid ${GRID}`} aria-hidden>
          {COLS.map((c) => (
            <span key={c.key} className={c.key === "units" || c.key === "charge" ? "text-right" : ""}>
              {c.label}
            </span>
          ))}
          <span />
        </div>
        {rows.length === 0 && (
          <div className="rounded-3xl bg-slate-50 p-8 text-center text-base text-slate-500">
            No charges yet. Add them from your itemized bill.
          </div>
        )}
        <ol className="space-y-3 md:space-y-2">
          {rows.map((r, i) => {
            const e: RowErrors = showErrors ? errors[r.id] : {};
            const bad = Object.keys(e).length > 0;
            return (
              <li
                key={r.id}
                className={`rounded-3xl p-4 md:rounded-2xl md:p-1 ${
                  bad ? "bg-rose-50 ring-1 ring-rose-200" : "bg-slate-50 md:bg-transparent"
                }`}
              >
                <p className="mb-3 text-sm font-medium text-slate-500 md:hidden">Charge {i + 1}</p>
                <div className={`grid grid-cols-2 gap-3 md:gap-2 ${GRID}`}>
                  {COLS.map((c) => {
                    const id = `row-${r.id}-${c.key}`;
                    const err = c.key === "modifiers" ? undefined : e[c.key];
                    const numeric = c.key === "charge" || c.key === "units";
                    return (
                      <div key={c.key} className={`min-w-0 ${c.key === "description" ? "col-span-2 md:col-span-1" : ""}`}>
                        <label htmlFor={id} className="mb-1 block text-sm text-slate-500 md:sr-only">
                          {c.label}
                          <span className="sr-only"> (line {i + 1})</span>
                        </label>
                        <input
                          id={id}
                          type={c.type ?? "text"}
                          inputMode={c.inputMode}
                          className={`${inputClass} px-2.5 ${err ? "border-rose-400" : ""} ${numeric ? "text-right tabular-nums" : ""}`}
                          placeholder={c.placeholder}
                          value={r[c.key]}
                          aria-invalid={err ? true : undefined}
                          onChange={(ev) => update(r.id, c.key, ev.target.value)}
                        />
                        {err && <p className="mt-1 text-sm text-rose-600">{err}</p>}
                      </div>
                    );
                  })}
                  <div className="col-span-2 flex justify-end md:col-span-1 md:justify-center md:pt-1">
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => remove(r.id)}
                      aria-label={`Delete line ${i + 1}`}
                      title="Delete line"
                    >
                      <span className="md:hidden">Remove</span>
                      <span aria-hidden className="hidden md:inline">
                        ✕
                      </span>
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
        <Button variant="secondary" onClick={add}>
          + Add a charge
        </Button>
      </section>

      <div className="sticky bottom-0 -mx-5 bg-white/90 px-5 py-4 backdrop-blur-xl sm:static sm:mx-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-base text-slate-600">
            {rows.length} charge{rows.length === 1 ? "" : "s"} · total{" "}
            <span className="font-semibold tabular-nums text-slate-900">{formatUSD(total)}</span>
            {showErrors && invalidCount > 0 && (
              <span className="block text-sm text-rose-600 sm:ml-2 sm:inline" role="alert">
                Please fix {invalidCount} charge{invalidCount === 1 ? "" : "s"} first
              </span>
            )}
            {showErrors && rows.length === 0 && (
              <span className="block text-sm text-rose-600 sm:ml-2 sm:inline" role="alert">
                Add at least one charge
              </span>
            )}
          </p>
          <Button size="lg" data-tour="run-audit" onClick={run}>
            Check the bill
          </Button>
        </div>
      </div>
    </div>
  );
}
