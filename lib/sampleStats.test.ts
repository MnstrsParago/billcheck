import { describe, expect, it } from "vitest";
import { SAMPLES } from "@/lib/samples";
import { competitorFees, parsePipeRows, sampleAuditSummary } from "@/lib/sampleStats";

describe("sample stats", () => {
  it("parses every line item of the samples", () => {
    expect(parsePipeRows(SAMPLES[0].text)).toHaveLength(9);
    expect(parsePipeRows(SAMPLES[1].text)).toHaveLength(5);
    expect(parsePipeRows(SAMPLES[0].text).reduce((n, l) => n + l.charge, 0)).toBe(10119);
  });
  it("averages the live audit totals", () => {
    const s = sampleAuditSummary();
    expect(s.count).toBe(SAMPLES.length);
    expect(s.average).toBeCloseTo(s.totals.reduce((a, b) => a + b, 0) / s.count, 6);
    expect(s.average).toBeGreaterThan(0);
  });
  it("applies published competitor fee rules", () => {
    expect(competitorFees(1000)).toEqual({ goodbill: 200, resolve: 500 });
    expect(competitorFees(3000)).toEqual({ goodbill: 600, resolve: 1000 });
    expect(competitorFees(10000)).toEqual({ goodbill: 1000, resolve: 2500 });
  });
});
