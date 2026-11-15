import type { BillLine, Finding, LineCheckStatus, ReferenceKind } from "@/lib/types";
import pfsData from "@/data/medicare-pfs-2026.json";
import oppsData from "@/data/opps-2026.json";
import { formatUSD, normalizeCpt, normalizeUnits, round2, validCharge } from "./util";

export const MEDICARE_DISCLAIMER =
  "Medicare national rate (2026, non-facility, physician fee) is a reference point, not a guarantee. Hospital facility fees are priced differently.";
export const OPPS_DISCLAIMER =
  "Medicare hospital outpatient (OPPS) national unadjusted rate for 2026 is a reference point for the hospital's facility fee, not a guarantee. Actual Medicare payment varies by local wage index, and some services are paid as part of a package.";

/** Physician-fee lines: flag above 3× the PFS national non-facility rate. */
export const MEDICARE_MULTIPLIER = 3;
/** Hospital facility lines (ER visits etc.): flag above 4× the OPPS rate — more conservative, since facility
 * charges carry hospital overhead. Product decision, not a legal rule. */
export const OPPS_MULTIPLIER = 4;

type Pfs = {
  conversionFactor: number;
  rates: Record<string, number>;
  excluded: Record<string, string>;
  excludedReasons: Record<string, string>;
};
type Opps = { rates: Record<string, [number, string, string]> };
const pfs = pfsData as unknown as Pfs;
const opps = oppsData as unknown as Opps;

export const PFS_CODE_COUNT = Object.keys(pfs.rates).length;
export const OPPS_CODE_COUNT = Object.keys(opps.rates).length;

/** Per-unit national non-facility PFS rate, or undefined if not in the table. */
export function getMedicareRate(cpt: string | null | undefined): number | undefined {
  const c = normalizeCpt(cpt);
  return c ? pfs.rates[c] : undefined;
}

/** OPPS national unadjusted payment rate + APC for a HCPCS code, if separately payable. */
export function getOppsRate(cpt: string | null | undefined): { rate: number; apc: string; si: string } | undefined {
  const c = normalizeCpt(cpt);
  const r = c ? opps.rates[c] : undefined;
  return r ? { rate: r[0], si: r[1], apc: r[2] } : undefined;
}

function reference(cpt: string): { kind: ReferenceKind; rate: number; apc?: string } | null {
  const p = pfs.rates[cpt];
  if (p && p > 0) return { kind: "pfs", rate: p };
  const o = opps.rates[cpt];
  if (o && o[0] > 0) return { kind: "opps", rate: o[0], apc: o[2] };
  return null;
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
    const ref = reference(cpt);
    if (!ref) {
      const why = pfs.excluded[cpt];
      if (why) lineStatus.push({ lineId: line.id, status: "excluded", reason: pfs.excludedReasons[why] ?? why });
      else lineStatus.push({ lineId: line.id, status: "no_reference" });
      continue;
    }
    const { kind, rate } = ref;
    if (!validCharge(line)) {
      lineStatus.push({ lineId: line.id, status: "reference", kind, medicareRate: rate, multiple: 0 });
      continue;
    }
    const units = normalizeUnits(line.units);
    const perUnit = line.charge / units;
    const multiple = Math.round((perUnit / rate) * 10) / 10;
    lineStatus.push({ lineId: line.id, status: "reference", kind, medicareRate: rate, multiple });
    if (excludeLineIds.has(line.id)) continue;

    const k = kind === "pfs" ? MEDICARE_MULTIPLIER : OPPS_MULTIPLIER;
    if (perUnit <= k * rate) continue;
    const base = {
      id: `above_medicare:${line.id}`,
      type: "above_medicare" as const,
      lineId: line.id,
      cpt,
      description: line.description,
      dateOfService: line.dateOfService,
      charge: line.charge,
      units,
      disputeAmount: round2(line.charge - k * rate * units),
      referenceKind: kind,
      medicareRate: rate,
      multiple,
    };
    findings.push(
      kind === "pfs"
        ? {
            ...base,
            title: "Priced well above Medicare reference",
            explanation: `${formatUSD(perUnit)} per unit is ${multiple.toFixed(1)}× the Medicare reference of ${formatUSD(rate)}. We count only the amount above ${k}× the reference as disputable. ${MEDICARE_DISCLAIMER}`,
            ruleRef: `Charge per unit above ${k}× Medicare national non-facility rate (our conservative threshold, a product decision, not a legal rule).`,
            source: `CMS PFS RVU26D CY2026 national non-facility rate (non-facility total RVU × CF ${pfs.conversionFactor})`,
          }
        : {
            ...base,
            title: "Hospital fee well above Medicare facility rate",
            explanation: `${formatUSD(perUnit)} per unit is ${multiple.toFixed(1)}× the 2026 Medicare hospital outpatient rate of ${formatUSD(rate)} (APC ${ref.apc}). We count only the amount above ${k}× that rate as disputable. ${OPPS_DISCLAIMER}`,
            ruleRef: `Facility charge per unit above ${k}× the Medicare OPPS national unadjusted rate (our conservative threshold for hospital fees, a product decision, not a legal rule).`,
            source: `CMS OPPS Addendum B, October 2026 — national unadjusted payment rate for ${cpt} (APC ${ref.apc})`,
          },
    );
  }
  return { findings, lineStatus };
}
