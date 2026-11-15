import type { BillLine, Finding } from "@/lib/types";
import { formatUSD, normalizeCpt, normalizeUnits, round2, validCharge } from "./util";

/** Modifiers that signal a legitimately repeated procedure. */
export const EXEMPT_MODIFIERS = ["59", "76", "77", "91", "XE", "XS", "XP", "XU"];

function normDesc(d: string): string {
  return (d ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function findDuplicates(lines: BillLine[]): Finding[] {
  const seen = new Map<string, string>();
  const out: Finding[] = [];
  for (const line of lines ?? []) {
    if (!validCharge(line)) continue;
    const mods = (line.modifiers ?? []).map((m) => String(m).trim().toUpperCase());
    if (mods.some((m) => EXEMPT_MODIFIERS.includes(m))) continue;
    const cpt = normalizeCpt(line.cpt);
    const key = [cpt ?? `d:${normDesc(line.description)}`, line.dateOfService ?? "", line.charge.toFixed(2)].join("|");
    const first = seen.get(key);
    if (first === undefined) {
      seen.set(key, line.id);
      continue;
    }
    out.push({
      id: `duplicate:${line.id}`,
      type: "duplicate",
      lineId: line.id,
      cpt,
      description: line.description,
      dateOfService: line.dateOfService,
      charge: line.charge,
      units: normalizeUnits(line.units),
      disputeAmount: round2(line.charge),
      title: "Possible duplicate charge",
      explanation: `This line has the same ${cpt ? "code" : "description"}, date of service and amount (${formatUSD(line.charge)}) as an earlier line and no modifier indicating a repeat procedure. It may be billed twice; ask the hospital to confirm it was performed twice.`,
      ruleRef: "Repeat services on the same date normally need a modifier (e.g. 59, 76, 77, 91, XE/XS/XP/XU).",
      source: "Itemized bill line comparison (same code, date and charge)",
      duplicateOfLineId: first,
    });
  }
  return out;
}
