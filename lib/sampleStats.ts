import { runAudit } from "@/lib/audit";
import { SAMPLES } from "@/lib/samples";
import type { BillLine } from "@/lib/types";

/** Parse `MM/DD/YYYY | CPT | Description | Units | $Charge` rows (the sample-bill format). */
export function parsePipeRows(text: string): BillLine[] {
  const lines: BillLine[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const cells = raw.split("|").map((c) => c.trim());
    if (cells.length !== 5) continue;
    const [date, cpt, description, units, charge] = cells;
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(date);
    const amount = Number(charge.replace(/[$,]/g, ""));
    if (!m || !Number.isFinite(amount)) continue; // header row etc.
    lines.push({
      id: `s${lines.length}`,
      dateOfService: `${m[3]}-${m[1]}-${m[2]}`,
      cpt: /^[A-Z0-9]{5}$/i.test(cpt) ? cpt.toUpperCase() : null,
      modifiers: [],
      description,
      units: Number(units) > 0 ? Number(units) : 1,
      charge: amount,
    });
  }
  return lines;
}

/** Live audit of every sample bill — the landing page's numbers come from here, not from constants. */
export function sampleAuditSummary() {
  const totals = SAMPLES.map((s) =>
    runAudit(parsePipeRows(s.text), s.household ?? { householdSize: null, annualIncome: null, state: null }).totalDisputable,
  );
  const average = totals.length ? totals.reduce((a, b) => a + b, 0) / totals.length : 0;
  return { count: totals.length, totals, average };
}

/** Published fee models of full-service negotiators (checked Nov 2026), applied to a given saving. */
export function competitorFees(saving: number) {
  const goodbill = Math.min(0.2 * saving, 1000); // 20% of savings, capped at $1,000
  // Resolve, bills under $15k: 25% of savings, $1,000 minimum, never more than 50% of savings.
  const resolve = Math.min(Math.max(0.25 * saving, 1000), 0.5 * saving);
  return { goodbill, resolve };
}
