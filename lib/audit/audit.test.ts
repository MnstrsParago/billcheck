import { describe, it, expect } from "vitest";
import type { BillLine } from "@/lib/types";
import {
  runAudit, findDuplicates, checkMedicare, checkCharity, stateToRegion, US_STATES,
  getMedicareRate, MEDICARE_DISCLAIMER, MEDICARE_MULTIPLIER, formatUSD,
} from "./index";
import { getOppsRate, OPPS_DISCLAIMER, OPPS_MULTIPLIER, PFS_CODE_COUNT } from "@/lib/audit/medicare";
import { SAMPLES } from "@/lib/samples";

let n = 0;
const L = (cpt: string | null, charge: number, o: Partial<BillLine> = {}): BillLine => ({
  id: `l${++n}`, dateOfService: "2026-03-14", cpt, modifiers: [], description: "desc", units: 1, charge, ...o,
});

const sampleA = (): BillLine[] => [
  L("99285", 2450), L("71046", 412), L("70450", 1980), L("70450", 1980), L("74177", 2875),
  L("93000", 42), L("96374", 98), L("85025", 118), L("80053", 164),
];
const sampleB = (): BillLine[] => [L("45378", 1020), L("76700", 1240), L("93306", 560), L("93000", 38), L("36415", 32)];
const none = { householdSize: null, annualIncome: null, state: null };

describe("constants", () => {
  it("exports exact disclaimer and multiplier", () => {
    expect(MEDICARE_DISCLAIMER).toBe(
      "Medicare national rate (2026, non-facility, physician fee) is a reference point, not a guarantee. Hospital facility fees are priced differently.");
    expect(MEDICARE_MULTIPLIER).toBe(3);
    expect(getMedicareRate(" 70450 ")).toBe(106.55);
    expect(getMedicareRate("99999")).toBeUndefined();
    expect(getMedicareRate(null)).toBeUndefined();
  });
  it("formats USD", () => {
    expect(formatUSD(1850)).toBe("$1,850.00");
  });
});

describe("findDuplicates", () => {
  it("flags the repeat, not the first", () => {
    const lines = sampleA();
    const f = findDuplicates(lines);
    expect(f).toHaveLength(1);
    expect(f[0].lineId).toBe(lines[3].id);
    expect(f[0].duplicateOfLineId).toBe(lines[2].id);
    expect(f[0].disputeAmount).toBe(1980);
    expect(f[0].title).toBe("Possible duplicate charge");
    expect(f[0].id).toBe(`duplicate:${lines[3].id}`);
  });
  it("skips repeat modifiers", () => {
    for (const m of ["59", "76", "77", "91", "XE", "XS", "XP", "XU", "xe"]) {
      expect(findDuplicates([L("70450", 100), L("70450", 100, { modifiers: [m] })])).toHaveLength(0);
    }
  });
  it("different date or charge is not a duplicate", () => {
    expect(findDuplicates([L("70450", 100), L("70450", 101)])).toHaveLength(0);
    expect(findDuplicates([L("70450", 100), L("70450", 100, { dateOfService: "2026-03-15" })])).toHaveLength(0);
  });
  it("uses normalized description when no CPT; flags triples twice", () => {
    const f = findDuplicates([
      L(null, 50, { description: "Room  Charge." }), L(null, 50, { description: "room charge" }),
      L(" 71046 ", 5), L("71046", 5), L("71046", 5),
    ]);
    expect(f).toHaveLength(3);
  });
  it("handles empty and NaN", () => {
    expect(findDuplicates([])).toEqual([]);
    expect(findDuplicates([L("1", NaN), L("1", NaN)])).toEqual([]);
  });
});

describe("checkMedicare", () => {
  it("flags above 3x with correct dispute amount", () => {
    const l = L("71046", 412);
    const { findings, lineStatus } = checkMedicare([l], new Set());
    expect(findings).toHaveLength(1);
    expect(findings[0].disputeAmount).toBe(312.79);
    expect(findings[0].medicareRate).toBe(33.07);
    expect(findings[0].multiple).toBe(12.5);
    expect(findings[0].explanation).toContain("$412.00 per unit is 12.5× the Medicare reference of $33.07");
    expect(findings[0].source).toContain("RVU26D");
    expect(findings[0].source).toContain("33.4009");
    expect(lineStatus[0]).toMatchObject({ status: "reference", medicareRate: 33.07 });
  });
  it("does not flag at or below 3x", () => {
    expect(checkMedicare([L("93000", 42)], new Set()).findings).toHaveLength(0);
    expect(checkMedicare([L("70450", 3 * 106.55)], new Set()).findings).toHaveLength(0);
  });
  it("handles units: per-unit comparison and total dispute", () => {
    const { findings } = checkMedicare([L("93000", 200, { units: 2 })], new Set());
    expect(findings[0].disputeAmount).toBe(Math.round((200 - 3 * 15.36 * 2) * 100) / 100);
    expect(checkMedicare([L("93000", 90, { units: 2 })], new Set()).findings).toHaveLength(0);
  });
  it("units 0 / negative / NaN treated as 1", () => {
    for (const u of [0, -3, NaN]) {
      expect(checkMedicare([L("71046", 412, { units: u })], new Set()).findings[0].units).toBe(1);
    }
  });
  it("normalizes cpt", () => {
    expect(checkMedicare([L(" 71046 ", 412)], new Set()).findings).toHaveLength(1);
    expect(checkMedicare([L("g0001", 412)], new Set()).lineStatus[0].status).toBe("no_reference");
  });
  it("statuses: excluded, no_reference, no_cpt", () => {
    const { lineStatus, findings } = checkMedicare([L("11004", 9999), L("85025", 9999), L("12345", 9999), L(null, 5), L("", 5)], new Set());
    expect(findings).toHaveLength(0);
    expect(lineStatus[0]).toMatchObject({ status: "excluded", reason: expect.stringContaining("NA") });
    expect(lineStatus[1]).toMatchObject({ status: "excluded", reason: expect.stringContaining("status X") });
    expect(lineStatus[2].status).toBe("no_reference");
    expect(lineStatus[3].status).toBe("no_cpt");
    expect(lineStatus[4].status).toBe("no_cpt");
  });
  it("respects excludeLineIds but still reports status", () => {
    const l = L("71046", 412);
    const r = checkMedicare([l], new Set([l.id]));
    expect(r.findings).toHaveLength(0);
    expect(r.lineStatus[0].status).toBe("reference");
  });
  it("uses the full PFS table (any CPT with a non-facility rate)", () => {
    expect(getMedicareRate("99213")).toBe(95.19);
    expect(getMedicareRate("71046")).toBe(33.07);
    expect(PFS_CODE_COUNT).toBeGreaterThan(3000);
  });
  it("falls back to OPPS facility rate with a 4× threshold and its own disclaimer", () => {
    expect(getOppsRate("99285")).toEqual({ rate: 608.43, si: "J2", apc: "5025" });
    const under = checkMedicare([L("99284", 4 * 426.3)], new Set());
    expect(under.findings).toHaveLength(0);
    expect(under.lineStatus[0]).toMatchObject({ status: "reference", kind: "opps", medicareRate: 426.3 });
    const over = checkMedicare([L("99284", 3000)], new Set());
    expect(over.findings[0]).toMatchObject({ referenceKind: "opps", disputeAmount: 1294.8, title: expect.stringContaining("Hospital fee") });
    expect(over.findings[0].explanation).toContain(OPPS_DISCLAIMER);
    expect(over.findings[0].source).toContain("Addendum B");
  });
  it("PFS takes precedence over OPPS when both exist", () => {
    const r = checkMedicare([L("70450", 1980)], new Set());
    expect(r.lineStatus[0]).toMatchObject({ kind: "pfs" });
    expect(OPPS_MULTIPLIER).toBe(4);
  });
  it("ignores NaN charge", () => {
    expect(checkMedicare([L("71046", NaN)], new Set()).findings).toHaveLength(0);
  });
});

describe("checkCharity", () => {
  it("maps regions", () => {
    expect(stateToRegion("AK")).toBe("alaska");
    expect(stateToRegion("hi")).toBe("hawaii");
    expect(stateToRegion("TX")).toBe("contiguous48AndDC");
    expect(stateToRegion("DC")).toBe("contiguous48AndDC");
    expect(stateToRegion(null)).toBe("contiguous48AndDC");
  });
  it("lists 50 states + DC", () => {
    expect(US_STATES).toHaveLength(51);
    expect(new Set(US_STATES.map((s) => s.code)).size).toBe(51);
    expect(US_STATES.find((s) => s.code === "DC")).toBeTruthy();
  });
  it("tiers", () => {
    expect(checkCharity({ householdSize: 3, annualIncome: 45000, state: "OH" })).toMatchObject({ status: "likely", fplPercent: 164.7, guideline: 27320 });
    expect(checkCharity({ householdSize: 1, annualIncome: 15960 * 2, state: "TX" }).status).toBe("likely");
    expect(checkCharity({ householdSize: 1, annualIncome: 15960 * 3, state: "TX" }).status).toBe("possibly");
    expect(checkCharity({ householdSize: 1, annualIncome: 15960 * 4, state: "TX" }).status).toBe("possibly");
    expect(checkCharity({ householdSize: 1, annualIncome: 15960 * 4 + 1, state: "TX" }).status).toBe("not_likely");
  });
  it("not_checked when missing", () => {
    for (const h of [none, { householdSize: 3, annualIncome: null, state: "OH" }, { householdSize: null, annualIncome: 100, state: "OH" }, { householdSize: 0, annualIncome: 100, state: "OH" }]) {
      const r = checkCharity(h);
      expect(r.status).toBe("not_checked");
      expect(r.fplPercent).toBeNull();
    }
  });
  it("AK and HI use own tables", () => {
    expect(checkCharity({ householdSize: 1, annualIncome: 19950, state: "AK" })).toMatchObject({ fplPercent: 100, guideline: 19950, region: "alaska" });
    expect(checkCharity({ householdSize: 2, annualIncome: 24890, state: "HI" })).toMatchObject({ fplPercent: 100, region: "hawaii" });
  });
  it("household > 8 adds per additional person", () => {
    expect(checkCharity({ householdSize: 10, annualIncome: 55720 + 2 * 5680, state: "TX" })).toMatchObject({ guideline: 67080, fplPercent: 100 });
    expect(checkCharity({ householdSize: 9, annualIncome: 1, state: "AK" }).guideline).toBe(69650 + 7100);
  });
});

describe("runAudit", () => {
  it("Sample A fixture: duplicate + >=2 above Medicare, no double counting", () => {
    const lines = sampleA();
    const r = runAudit(lines, none);
    const dup = r.findings.filter((f) => f.type === "duplicate");
    const med = r.findings.filter((f) => f.type === "above_medicare");
    expect(dup).toHaveLength(1);
    expect(med.length).toBeGreaterThanOrEqual(2);
    expect(med.map((f) => f.lineId)).not.toContain(lines[3].id);
    expect(med.map((f) => f.cpt).sort()).toEqual(["70450", "71046", "74177", "99285"]);
    // ER visit 99285 has no PFS non-facility rate; it is checked against OPPS ($608.43, APC 5025) at 4×.
    const er = med.find((f) => f.cpt === "99285")!;
    expect(er.referenceKind).toBe("opps");
    expect(er.disputeAmount).toBe(16.28); // 2450 - 4 × 608.43
    expect(r.totalDisputable).toBe(5943.61);
    expect(r.billTotal).toBe(10119);
    expect(r.charity.status).toBe("not_checked");
    expect(r.lineStatus).toHaveLength(lines.length);
  });
  it("Sample B fixture: one above Medicare, charity likely", () => {
    const r = runAudit(sampleB(), { householdSize: 3, annualIncome: 45000, state: "OH" });
    expect(r.findings).toHaveLength(1);
    expect(r.findings[0].cpt).toBe("76700");
    expect(r.findings[0].disputeAmount).toBe(897.31);
    expect(r.charity.status).toBe("likely");
    expect(r.charity.fplPercent).toBe(164.7);
    expect(r.billTotal).toBe(2890);
  });
  it("charity is not added to totalDisputable", () => {
    const r = runAudit([L("93000", 10)], { householdSize: 1, annualIncome: 1, state: "TX" });
    expect(r.totalDisputable).toBe(0);
  });
  it("empty lines and NaN charges", () => {
    const r = runAudit([], none);
    expect(r).toMatchObject({ findings: [], totalDisputable: 0, billTotal: 0, lineStatus: [] });
    expect(runAudit([L("71046", NaN), L("93000", 10)], none).billTotal).toBe(10);
  });
});

describe("SAMPLES", () => {
  it("has A and B with fictional hospital names and rows", () => {
    expect(SAMPLES.map((s) => s.id)).toEqual(["A", "B"]);
    expect(SAMPLES[0].text).toContain("Riverside General Hospital".toUpperCase());
    expect(SAMPLES[1].text).toContain("LAKEVIEW MEDICAL CENTER");
    expect(SAMPLES[0].text.match(/\| 70450 \|/g)).toHaveLength(2);
    expect(SAMPLES[1].household).toEqual({ householdSize: 3, annualIncome: 45000, state: "OH" });
  });
});
