"use client";

import { US_STATES } from "@/lib/audit/charity";
import type { HouseholdInput } from "@/lib/types";
import { Field, inputClass } from "@/components/ui/Field";

function toNum(s: string): number | null {
  const cleaned = s.replace(/[$,\s]/g, "");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Household size / income / patient state for the charity care check. */
export function HouseholdFields({
  value,
  onChange,
  idPrefix = "hh",
}: {
  value: HouseholdInput;
  onChange: (v: HouseholdInput) => void;
  idPrefix?: string;
}) {
  const sizeInvalid = value.householdSize !== null && (value.householdSize < 1 || !Number.isInteger(value.householdSize));
  const incomeInvalid = value.annualIncome !== null && value.annualIncome < 0;
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Field
        label="People in your household"
        htmlFor={`${idPrefix}-size`}
        error={sizeInvalid ? "Enter a whole number, 1 or more" : undefined}
      >
        <input
          id={`${idPrefix}-size`}
          type="number"
          inputMode="numeric"
          min={1}
          max={20}
          step={1}
          placeholder="e.g. 3"
          className={inputClass}
          value={value.householdSize ?? ""}
          onChange={(e) => onChange({ ...value, householdSize: toNum(e.target.value) })}
        />
      </Field>
      <Field
        label="Yearly household income ($)"
        htmlFor={`${idPrefix}-income`}
        error={incomeInvalid ? "Income can't be negative" : undefined}
      >
        <input
          id={`${idPrefix}-income`}
          type="number"
          inputMode="decimal"
          min={0}
          step={100}
          placeholder="e.g. 45000"
          className={inputClass}
          value={value.annualIncome ?? ""}
          onChange={(e) => onChange({ ...value, annualIncome: toNum(e.target.value) })}
        />
      </Field>
      <Field label="Your state" htmlFor={`${idPrefix}-state`}>
        <select
          id={`${idPrefix}-state`}
          className={inputClass}
          value={value.state ?? ""}
          onChange={(e) => onChange({ ...value, state: e.target.value || null })}
        >
          <option value="">Select state</option>
          {US_STATES.map((s) => (
            <option key={s.code} value={s.code}>
              {s.name}
            </option>
          ))}
        </select>
      </Field>
    </div>
  );
}
