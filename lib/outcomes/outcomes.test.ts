import { describe, expect, it } from "vitest";
import type { Dispute, OutcomeRecord } from "@/lib/types";
import { normalizeHospital } from "./normalize";
import { codeStats, median, rankHospitals, reductionPct, topArgument, totals } from "./aggregate";
import { DEMO_HOSPITALS, generateDemoOutcomes } from "./demo-seed";
import { outcomePayloadSchema, payloadToRecords } from "./schema";
import { buildOutcomePayload } from "./client";
import pfs from "@/data/medicare-pfs-2026.json";

const rec = (o: Partial<OutcomeRecord>): OutcomeRecord => ({
  id: Math.random().toString(36),
  hospitalKey: "a hospital",
  hospital: "A Hospital",
  state: "TX",
  cpt: "99213",
  originalPrice: 100,
  finalPrice: 100,
  argument: "above_medicare",
  status: "resolved",
  demo: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  ...o,
});

describe("normalizeHospital", () => {
  it("lowercases, strips punctuation, collapses spaces, drops leading 'the'", () => {
    expect(normalizeHospital("The Riverside  General Hospital, Inc.")).toBe("riverside general hospital inc");
    expect(normalizeHospital("  LAKEVIEW Medical-Center ")).toBe("lakeview medical center");
    expect(normalizeHospital("St. Mary's")).toBe("st marys");
    expect(normalizeHospital("Theodore Hospital")).toBe("theodore hospital");
    expect(normalizeHospital("")).toBe("");
    expect(normalizeHospital(null)).toBe("");
  });
  it("is idempotent", () => {
    const k = normalizeHospital("The Cedar Hollow Regional Medical Center");
    expect(normalizeHospital(k)).toBe(k);
  });
});

describe("aggregate", () => {
  it("median", () => {
    expect(median([])).toBe(0);
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
  });
  it("reductionPct clamps", () => {
    expect(reductionPct(100, 58)).toBe(42);
    expect(reductionPct(100, 150)).toBe(0);
    expect(reductionPct(100, -10)).toBe(100);
    expect(reductionPct(0, 0)).toBe(0);
  });
  it("topArgument counts only reduced lines", () => {
    const rs = [
      rec({ argument: "duplicate", finalPrice: 100 }),
      rec({ argument: "duplicate", finalPrice: 100 }),
      rec({ argument: "charity_care", finalPrice: 10 }),
    ];
    expect(topArgument(rs)).toBe("charity_care");
    expect(topArgument([rec({})])).toBeNull();
  });
  it("codeStats filters by hospital and cpt", () => {
    const rs = [
      rec({ finalPrice: 50 }),
      rec({ finalPrice: 60, demo: true }),
      rec({ finalPrice: 100, status: "escalated" }),
      rec({ cpt: "71046", finalPrice: 10 }),
      rec({ hospitalKey: "other", finalPrice: 0 }),
    ];
    const s = codeStats(rs, "The A Hospital", ["99213", "93000"]);
    expect(s).toHaveLength(1);
    expect(s[0]).toEqual({
      hospitalKey: "a hospital",
      cpt: "99213",
      count: 3,
      reducedCount: 2,
      medianReductionPct: 45,
      topArgument: "above_medicare",
      demoCount: 1,
    });
  });
  it("rankHospitals sorts by concededPct then median and applies min sample", () => {
    const mk = (key: string, n: number, conceded: number, final: number) =>
      Array.from({ length: n }, (_, i) => rec({ hospitalKey: key, hospital: key.toUpperCase(), finalPrice: i < conceded ? final : 100 }));
    const rs = [...mk("a", 5, 5, 80), ...mk("b", 5, 5, 40), ...mk("c", 6, 3, 10), ...mk("tiny", 2, 2, 0)];
    const r = rankHospitals(rs, 5);
    expect(r.map((x) => x.hospitalKey)).toEqual(["b", "a", "c"]);
    expect(r[0].concededPct).toBe(100);
    expect(r[0].medianReductionPct).toBe(60);
    expect(r[2].concededPct).toBe(50);
    expect(totals(rs)).toEqual({ records: 18, demo: 0, real: 18 });
  });
});

describe("demo seed", () => {
  const a = generateDemoOutcomes();
  it("is deterministic", () => {
    expect(generateDemoOutcomes()).toEqual(a);
  });
  it("has 150–250 demo rows with unique ids", () => {
    expect(a.length).toBeGreaterThanOrEqual(150);
    expect(a.length).toBeLessThanOrEqual(250);
    expect(new Set(a.map((r) => r.id)).size).toBe(a.length);
    expect(a.every((r) => r.demo && r.id.startsWith("demo~"))).toBe(true);
  });
  it("includes the two sample-bill hospitals", () => {
    const keys = new Set(a.map((r) => `${r.hospital}|${r.state}`));
    expect(keys.has("Riverside General Hospital|TX")).toBe(true);
    expect(keys.has("Lakeview Medical Center|OH")).toBe(true);
    expect(DEMO_HOSPITALS).toHaveLength(10);
  });
  it("prices are 3–12x Medicare per unit, finals never above original", () => {
    const rate = new Map((pfs as { rates: { cpt: string; nationalNonFacilityRate: number }[] }).rates.map((r) => [r.cpt, r.nationalNonFacilityRate]));
    for (const r of a) {
      const m = rate.get(r.cpt!)!;
      expect(m).toBeGreaterThan(0);
      const mult = r.originalPrice / m;
      expect(mult).toBeGreaterThanOrEqual(2.99);
      expect(mult).toBeLessThanOrEqual(24.01); // up to 2 units
      expect(r.finalPrice).toBeLessThanOrEqual(r.originalPrice);
      expect(r.finalPrice).toBeGreaterThanOrEqual(0);
      if (r.status === "escalated") expect(r.finalPrice).toBe(r.originalPrice);
    }
  });
  it("produces a meaningful ranking (all 10 ranked, varied concede rates)", () => {
    const r = rankHospitals(a);
    expect(r).toHaveLength(10);
    expect(r[0].concededPct - r[r.length - 1].concededPct).toBeGreaterThan(20);
  });
});

describe("payload schema", () => {
  const good = {
    disputeId: "abc-123",
    hospital: "Riverside General Hospital",
    state: "TX",
    status: "resolved" as const,
    lines: [{ lineId: "l1", cpt: "99213", originalPrice: 500, finalPrice: 200, argument: "above_medicare" as const }],
  };
  it("accepts a valid payload and forces demo:false", () => {
    const p = outcomePayloadSchema.parse(good);
    const recs = payloadToRecords(p, new Date("2026-05-05T13:14:15Z"));
    expect(recs[0]).toMatchObject({ id: "abc-123:l1", hospitalKey: "riverside general hospital", demo: false, createdAt: "2026-05-05T00:00:00.000Z" });
  });
  it("rejects extra keys (no free text / patient data)", () => {
    expect(outcomePayloadSchema.safeParse({ ...good, patientName: "x" }).success).toBe(false);
    expect(outcomePayloadSchema.safeParse({ ...good, demo: true }).success).toBe(false);
    expect(outcomePayloadSchema.safeParse({ ...good, lines: [{ ...good.lines[0], description: "x" }] }).success).toBe(false);
  });
  it("validates fields", () => {
    const bad = (o: object) => outcomePayloadSchema.safeParse({ ...good, ...o }).success;
    expect(bad({ hospital: "x".repeat(121) })).toBe(false);
    expect(bad({ hospital: "   " })).toBe(false);
    expect(bad({ state: "Texas" })).toBe(false);
    expect(bad({ state: null })).toBe(true);
    expect(bad({ disputeId: "demo~1" })).toBe(false);
    expect(bad({ disputeId: "a:b" })).toBe(false);
    expect(bad({ lines: [] })).toBe(false);
    expect(bad({ lines: Array.from({ length: 101 }, (_, i) => ({ ...good.lines[0], lineId: `l${i}` })) })).toBe(false);
    expect(bad({ lines: [{ ...good.lines[0], cpt: "9921" }] })).toBe(false);
    expect(bad({ lines: [{ ...good.lines[0], cpt: null }] })).toBe(true);
    expect(bad({ lines: [{ ...good.lines[0], originalPrice: Infinity }] })).toBe(false);
    expect(bad({ lines: [{ ...good.lines[0], originalPrice: 2e7 }] })).toBe(false);
    expect(bad({ lines: [{ ...good.lines[0], finalPrice: 600 }] })).toBe(false);
    expect(bad({ status: "escalated", lines: [{ ...good.lines[0], finalPrice: 600 }] })).toBe(true);
    expect(bad({ lines: [{ ...good.lines[0], argument: "other" }] })).toBe(false);
    expect(bad({ lines: [good.lines[0], good.lines[0]] })).toBe(false);
  });
  it("escalated final price is capped at original", () => {
    const p = outcomePayloadSchema.parse({ ...good, status: "escalated", lines: [{ ...good.lines[0], finalPrice: 600 }] });
    expect(payloadToRecords(p)[0].finalPrice).toBe(500);
  });
});

describe("client payload builder", () => {
  const dispute: Dispute = {
    id: "d-1",
    provider: "Lakeview Medical Center",
    state: "oh",
    amountDisputed: 300,
    billTotal: 1000,
    startedAt: "2026-01-01T00:00:00Z",
    status: "escalated",
    events: [{ at: "2026-01-01T00:00:00Z", type: "note", note: "private" }],
    lines: [{ lineId: "x1", cpt: "99214", description: "Office visit", originalPrice: 300, argument: "above_medicare" }],
    findings: [],
  };
  it("produces a schema-valid anonymous payload", () => {
    const p = buildOutcomePayload(dispute)!;
    expect(p).toEqual({
      disputeId: "d-1",
      hospital: "Lakeview Medical Center",
      state: "OH",
      status: "escalated",
      lines: [{ lineId: "x1", cpt: "99214", originalPrice: 300, finalPrice: 300, argument: "above_medicare" }],
    });
    expect(outcomePayloadSchema.safeParse(p).success).toBe(true);
  });
  it("returns null for open disputes", () => {
    expect(buildOutcomePayload({ ...dispute, status: "waiting" })).toBeNull();
  });
});
