import { describe, expect, it } from "vitest";
import { buildCharityLetter, buildDisputeLetter, canBuildCharityLetter, letterFilename, usd } from "./letters";
import type { CharityResult, Finding } from "./types";

const dup: Finding = {
  id: "duplicate:l2",
  type: "duplicate",
  lineId: "l2",
  cpt: "70450",
  description: "CT head w/o contrast",
  dateOfService: "2026-10-02",
  charge: 2850,
  units: 1,
  disputeAmount: 2850,
  title: "Possible duplicate charge",
  explanation: "x",
  ruleRef: "x",
  source: "x",
  duplicateOfLineId: "l1",
};

const price: Finding = {
  id: "above_medicare:l3",
  type: "above_medicare",
  lineId: "l3",
  cpt: "93000",
  description: "ECG complete",
  dateOfService: "2026-10-02",
  charge: 450,
  units: 2,
  disputeAmount: 312.5,
  title: "Price far above Medicare reference",
  explanation: "x",
  ruleRef: "x",
  source: "x",
  medicareRate: 22.92,
  multiple: 9.8,
};

const charity: CharityResult = {
  status: "likely",
  fplPercent: 164.6,
  guideline: 27320,
  householdSize: 3,
  annualIncome: 45000,
  region: "contiguous48AndDC",
};

const date = new Date("2026-11-15T12:00:00Z");

describe("usd", () => {
  it("formats dollars with cents", () => {
    expect(usd(1234.5)).toBe("$1,234.50");
    expect(usd(Number.NaN)).toBe("$0.00");
  });
});

describe("buildDisputeLetter", () => {
  const letter = buildDisputeLetter({
    provider: "St. Example Medical Center",
    findings: [dup, price],
    billTotal: 9876.54,
    totalDisputable: 3162.5,
    date,
  });

  it("includes provider, date and totals computed from input", () => {
    expect(letter).toContain("November 15, 2026");
    expect(letter).toContain("St. Example Medical Center");
    expect(letter).toContain("$9,876.54");
    expect(letter).toContain("Total amount in question: $3,162.50");
    expect(letter).toContain("I found 2 charges");
  });

  it("lists each finding with CPT, charge, reason and amount", () => {
    expect(letter).toContain("1. CPT 70450 — CT head w/o contrast (date of service 2026-10-02)");
    expect(letter).toContain("Charged: $2,850.00");
    expect(letter).toContain("Possible duplicate charge");
    expect(letter).toContain("2. CPT 93000 — ECG complete");
    expect(letter).toContain("Charged: $450.00 for 2 units");
    expect(letter).toContain("9.8x the 2026 Medicare national non-facility rate");
    expect(letter).toContain("$22.92 per unit");
    expect(letter).toContain("Amount in question: $312.50");
  });

  it("requests itemized review, corrected bill and a collections hold", () => {
    expect(letter).toMatch(/itemized review/i);
    expect(letter).toMatch(/corrected, itemized bill/i);
    expect(letter).toMatch(/do not refer it to a collection agency/i);
  });

  it("only mentions Medicare references when a price finding exists", () => {
    const onlyDup = buildDisputeLetter({ provider: "X", findings: [dup], billTotal: 100, totalDisputable: 50, date });
    expect(onlyDup).not.toContain("RVU26D");
    expect(onlyDup).toContain("I found 1 charge that I believe is");
    expect(letter).toContain("RVU26D");
  });

  it("uses placeholders when provider is missing", () => {
    const l = buildDisputeLetter({ provider: null, findings: [], billTotal: 0, totalDisputable: 0, date });
    expect(l).toContain("[Hospital name]");
    expect(l).toContain("[Account number]");
  });
});

describe("buildCharityLetter", () => {
  it("includes income, household size, %FPL and 501(r) request", () => {
    const l = buildCharityLetter({ provider: "Valley General", charity, state: "tx", billTotal: 5200, date });
    expect(l).toContain("Household size: 3 people");
    expect(l).toContain("$45,000.00");
    expect(l).toContain("164.6% FPL");
    expect(l).toContain("$27,320.00");
    expect(l).toContain("State of residence: TX");
    expect(l).toContain("501(r)");
    expect(l).toMatch(/Financial Assistance Policy/);
    expect(l).toMatch(/application form/);
    expect(l).toContain("$5,200.00");
  });

  it("refuses to build without income", () => {
    const notChecked: CharityResult = { ...charity, status: "not_checked", fplPercent: null, annualIncome: null };
    expect(canBuildCharityLetter(notChecked)).toBe(false);
    expect(canBuildCharityLetter(charity)).toBe(true);
    expect(() => buildCharityLetter({ provider: "X", charity: notChecked, billTotal: 1 })).toThrow();
  });
});

describe("letterFilename", () => {
  it("slugifies provider", () => {
    expect(letterFilename("dispute", "St. Mary's Hospital")).toBe("dispute-letter-st-mary-s-hospital.txt");
    expect(letterFilename("charity", null)).toBe("charity-care-request.txt");
  });
});
