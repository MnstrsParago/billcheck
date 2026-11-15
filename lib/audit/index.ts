import type { AuditResult, BillLine, HouseholdInput } from "@/lib/types";
import { findDuplicates } from "./duplicates";
import { checkMedicare } from "./medicare";
import { checkCharity } from "./charity";
import { round2, validCharge } from "./util";

export { formatUSD } from "./util";
export { findDuplicates } from "./duplicates";
export { checkMedicare, getMedicareRate, MEDICARE_DISCLAIMER, MEDICARE_MULTIPLIER } from "./medicare";
export { checkCharity, stateToRegion, US_STATES, CHARITY_NOTE, CHARITY_COPY } from "./charity";

export function runAudit(lines: BillLine[], household: HouseholdInput): AuditResult {
  const safe = lines ?? [];
  const dups = findDuplicates(safe);
  const { findings: med, lineStatus } = checkMedicare(safe, new Set(dups.map((d) => d.lineId)));
  const findings = [...dups, ...med];
  return {
    findings,
    totalDisputable: round2(findings.reduce((s, f) => s + f.disputeAmount, 0)),
    billTotal: round2(safe.filter(validCharge).reduce((s, l) => s + l.charge, 0)),
    lineStatus,
    charity: checkCharity(household ?? { householdSize: null, annualIncome: null, state: null }),
  };
}
