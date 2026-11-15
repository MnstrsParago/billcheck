import type { BillLine, Finding, LineCheckStatus } from "@/lib/types";
import data from "@/data/medicare-pfs-2026.json";
import { formatUSD, normalizeCpt, normalizeUnits, round2, validCharge } from "./util";

export const MEDICARE_DISCLAIMER =
  "Medicare national rate (2026, non-facility, physician fee) is a reference point, not a guarantee. Hospital facility fees are priced differently.";
export const MEDICARE_MULTIPLIER = 3;

type Pfs = {
  rates: { cpt: string; nationalNonFacilityRate: number }[];
  excluded: { code: string; desc: string; reason: string }[];
  conversionFactor: number;
};
const pfs = data as unknown as Pfs;
const RATES = new Map(pfs.rates.map((r) => [r.cpt.toUpperCase(), r.nationalNonFacilityRate]));
const EXCLUDED = new Map(pfs.excluded.map((e) => [e.code.toUpperCase(), e.reason]));

/** Per-unit national non-facility rate, or undefined if not in our table. */
export function getMedicareRate(cpt: string | null | undefined): number | undefined {
  const c = normalizeCpt(cpt);
  return c ? RATES.get(c) : undefined;
}

export function checkMedicare(
  lines: BillLine[],
  excludeLineIds: Set<string> = new Set(),
): { findings: Finding[]; lineStatus: LineCheckStatus[] } {
  const findings: Finding[] = [];
  const lineStatus: LineCheckStatus[] = [];
  for (const line of lines ?? []) {
    const cpt = normalizeCpt(line.cpt);
    if (!cpt) {
      lineStatus.push({ lineId: line.id, status: "no_cpt" });
      continue;
    }
    const reason = EXCLUDED.get(cpt);
    if (reason !== undefined) {
      lineStatus.push({ lineId: line.id, status: "excluded", reason });
      continue;
    }
    const rate = RATES.get(cpt);
    if (rate === undefined || !(rate > 0)) {
      lineStatus.push({ lineId: line.id, status: "no_reference" });
      continue;
    }
    if (!validCharge(line)) {
      lineStatus.push({ lineId: line.id, status: "reference", medicareRate: rate, multiple: 0 });
      continue;
    }
    const units = normalizeUnits(line.units);
    const perUnit = line.charge / units;
    const multiple = Math.round((perUnit / rate) * 10) / 10;
    lineStatus.push({ lineId: line.id, status: "reference", medicareRate: rate, multiple });
    if (excludeLineIds.has(line.id)) continue;
    if (perUnit > MEDICARE_MULTIPLIER * rate) {
      findings.push({
        id: `above_medicare:${line.id}`,
        type: "above_medicare",
        lineId: line.id,
        cpt,
        description: line.description,
        dateOfService: line.dateOfService,
        charge: line.charge,
        units,
        disputeAmount: round2(line.charge - MEDICARE_MULTIPLIER * rate * units),
        title: "Priced well above Medicare reference",
        explanation: `${formatUSD(perUnit)} per unit is ${multiple.toFixed(1)}× the Medicare reference of ${formatUSD(rate)}. We count only the amount above ${MEDICARE_MULTIPLIER}× the reference as disputable. ${MEDICARE_DISCLAIMER}`,
        ruleRef: `Charge per unit above ${MEDICARE_MULTIPLIER}× Medicare national non-facility rate (our conservative threshold, a product decision, not a legal rule).`,
        source: `CMS PFS RVU26D CY2026 national non-facility rate (non-facility total RVU × CF ${pfs.conversionFactor})`,
        medicareRate: rate,
        multiple,
      });
    }
  }
  return { findings, lineStatus };
}
