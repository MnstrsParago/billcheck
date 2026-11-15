"use client";

import { useState } from "react";
import { formatUSD } from "@/lib/audit";
import { US_STATES } from "@/lib/audit/charity";
import { emptyRow, parseMoney, validateRow, type EditableLine, type RowErrors } from "@/lib/state";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, inputClass } from "@/components/ui/Field";

const GRID = "md:grid-cols-[9rem_5.5rem_5.5rem_minmax(0,1fr)_4rem_7rem_2.75rem] md:items-start";

type ColKey = keyof Omit<EditableLine, "id">;
type Col = { key: ColKey; label: string; placeholder: string; inputMode?: "numeric" | "decimal"; type?: string };
const COLS: Col[] = [
  { key: "dateOfService", label: "Date", placeholder: "yyyy-mm-dd", type: "date" },
  { key: "cpt", label: "CPT", placeholder: "70450" },
  { key: "modifiers", label: "Modifiers", placeholder: "e.g. 59" },
  { key: "description", label: "Description", placeholder: "CT head without contrast" },
  { key: "units", label: "Units", placeholder: "1", inputMode: "numeric" },
  { key: "charge", label: "Charge ($)", placeholder: "0.00", inputMode: "decimal" },
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
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Review the bill lines</h1>
        <Button variant="ghost" size="sm" data-tour="back" onClick={onBack}>
          ← Back
        </Button>
      </div>

      {extractError ? (
        <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-medium">We couldn&apos;t read the bill automatically.</p>
          <p className="mt-1">{extractError}</p>
          <p className="mt-1">You can still enter the lines below by hand. The audit works exactly the same way.</p>
        </div>
      ) : (
        <p className="text-sm text-slate-600">
          Check that each line matches your bill. Fix anything that looks off, delete lines that aren&apos;t charges, or add
          missing ones.
        </p>
      )}

      {dropped.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">
          <p className="font-medium">
            {dropped.length} line{dropped.length === 1 ? "" : "s"} could not be read and{" "}
            {dropped.length === 1 ? "was" : "were"} left out:
          </p>
          <ul className="mt-1 list-inside list-disc text-xs text-slate-600">
            {dropped.map((d) => (
              <li key={d.index}>
                Line {d.index + 1}: {d.reason}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-slate-500">Add them manually below if they are real charges.</p>
        </div>
      )}

      <Card>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_14rem]">
          <Field
            label="Hospital / provider name"
            htmlFor="provider"
            hint="Used in your letters and to show what others achieved at this hospital."
          >
            <input
              id="provider"
              className={inputClass}
              value={provider}
              placeholder="e.g. Riverside General Hospital"
              onChange={(e) => onProvider(e.target.value)}
            />
          </Field>
          <Field label="Hospital state" htmlFor="hospital-state">
            <select
              id="hospital-state"
              className={inputClass}
              value={hospitalState}
              onChange={(e) => onHospitalState(e.target.value)}
            >
              <option value="">Unknown</option>
              {US_STATES.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </Card>

      <div className="space-y-2">
        <div
          className={`hidden gap-2 px-3 text-xs font-medium uppercase tracking-wide text-slate-500 md:grid ${GRID}`}
          aria-hidden
        >
          {COLS.map((c) => (
            <span key={c.key} className={c.key === "units" || c.key === "charge" ? "text-right" : ""}>
              {c.label}
            </span>
          ))}
          <span />
        </div>
        {rows.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
            No lines yet. Add the charges from your itemized bill.
          </div>
        )}
        <ol className="space-y-2">
          {rows.map((r, i) => {
            const e: RowErrors = showErrors ? errors[r.id] : {};
            const bad = Object.keys(e).length > 0;
            return (
              <li key={r.id} className={`rounded-xl border bg-white p-3 ${bad ? "border-rose-300" : "border-slate-200"}`}>
                <p className="mb-2 text-xs font-medium text-slate-500 md:hidden">Line {i + 1}</p>
                <div className={`grid grid-cols-2 gap-2 ${GRID}`}>
                  {COLS.map((c) => {
                    const id = `row-${r.id}-${c.key}`;
                    const err = c.key === "modifiers" ? undefined : e[c.key];
                    const numeric = c.key === "charge" || c.key === "units";
                    return (
                      <div key={c.key} className={c.key === "description" ? "col-span-2 md:col-span-1" : ""}>
                        <label htmlFor={id} className="mb-0.5 block text-xs text-slate-500 md:sr-only">
                          {c.label}
                          <span className="sr-only"> (line {i + 1})</span>
                        </label>
                        <input
                          id={id}
                          type={c.type ?? "text"}
                          inputMode={c.inputMode}
                          className={`${inputClass} px-2 ${err ? "border-rose-400" : ""} ${numeric ? "text-right tabular-nums" : ""}`}
                          placeholder={c.placeholder}
                          value={r[c.key]}
                          aria-invalid={err ? true : undefined}
                          onChange={(ev) => update(r.id, c.key, ev.target.value)}
                        />
                        {err && <p className="mt-0.5 text-xs text-rose-600">{err}</p>}
                      </div>
                    );
                  })}
                  <div className="col-span-2 flex justify-end md:col-span-1 md:justify-center">
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => remove(r.id)}
                      aria-label={`Delete line ${i + 1}`}
                      title="Delete line"
                    >
                      <span className="md:hidden">Delete line</span>
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
          + Add line
        </Button>
      </div>

      <div className="sticky bottom-0 -mx-4 border-t border-slate-200 bg-slate-50/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-600">
            {rows.length} line{rows.length === 1 ? "" : "s"} · total{" "}
            <span className="font-semibold tabular-nums text-slate-900">{formatUSD(total)}</span>
            {showErrors && invalidCount > 0 && (
              <span className="ml-2 text-rose-600" role="alert">
                Fix {invalidCount} line{invalidCount === 1 ? "" : "s"} first
              </span>
            )}
            {showErrors && rows.length === 0 && (
              <span className="ml-2 text-rose-600" role="alert">
                Add at least one line
              </span>
            )}
          </p>
          <Button size="lg" data-tour="run-audit" onClick={run}>
            Run audit
          </Button>
        </div>
      </div>
    </div>
  );
}
