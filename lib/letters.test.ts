import { describe, expect, it } from "vitest";
import {
  buildCharityLetter,
  buildDisputeLetter,
  buildItemizedRequest,
  buildPpdrRequest,
  canBuildCharityLetter,
  letterFilename,
  usd,
} from "./letters";
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

describe("dispute letter — hospital facility (OPPS) finding", () => {
  it("names the OPPS outpatient rate instead of the physician fee schedule", () => {
    const text = buildDisputeLetter({
      provider: "Test Hospital",
      billTotal: 2450,
      totalDisputable: 16.28,
      findings: [
        {
          id: "above_medicare:x",
          type: "above_medicare",
          lineId: "x",
          cpt: "99285",
          description: "ER visit",
          dateOfService: "2026-03-14",
          charge: 2450,
          units: 1,
          disputeAmount: 16.28,
          title: "Hospital fee well above Medicare facility rate",
          explanation: "",
          ruleRef: "",
          source: "",
          referenceKind: "opps",
          medicareRate: 608.43,
          multiple: 4,
        },
      ],
    });
    expect(text).toContain("hospital outpatient (OPPS)");
    expect(text).toContain("$608.43");
  });
});

describe("PPDR request (No Surprises Act)", () => {
  it("contains the facts, deadline, fee and CMS source", () => {
    const t = buildPpdrRequest({
      provider: "Maple Crest Medical Center",
      providerState: "PA",
      gfeAmount: 1200,
      billDate: "2026-10-01",
      billed: 2085,
      deadline: "2027-01-29",
      date: new Date("2026-11-15T00:00:00Z"),
    });
    expect(t).toContain("Good Faith Estimate total: $1,200.00");
    expect(t).toContain("Amount billed: $2,085.00");
    expect(t).toContain("Billed above the estimate: $885.00");
    expect(t).toContain("January 29, 2027");
    expect(t).toContain("$25");
    expect(t).toContain("nsa-idr.cms.gov/billdisputes");
    expect(t).toContain("cms.gov/medical-bill-rights/help/dispute-a-bill");
  });
});

describe("itemized bill request", () => {
  it("asks for codes, units and charges per line and a collections hold", () => {
    const t = buildItemizedRequest({ provider: "Lakeview Medical Center", billTotal: 2890, billDate: "2026-06-05", date: new Date("2026-11-15T00:00:00Z") });
    expect(t).toContain("Lakeview Medical Center");
    expect(t).toContain("$2,890.00");
    expect(t).toContain("June 5, 2026");
    expect(t).toMatch(/CPT or HCPCS code/);
    expect(t).toMatch(/collections/);
    expect(buildItemizedRequest({ provider: "", billTotal: null })).toContain("[Hospital name]");
  });
});
