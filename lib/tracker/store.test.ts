import { beforeEach, describe, expect, it } from "vitest";
import type { Finding } from "@/lib/types";
import { resetClock, simulateDays } from "./clock";
import {
  createDispute,
  deleteDispute,
  escalateDispute,
  getDispute,
  listDisputes,
  markFollowUpSent,
  markItemizedReceived,
  markPpdrFiled,
  resolveDispute,
  savedSoFar,
} from "./store";

function installWindow() {
  const data = new Map<string, string>();
  const localStorage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, String(v)),
    removeItem: (k: string) => void data.delete(k),
  };
  (globalThis as unknown as { window: unknown }).window = {
    localStorage,
    dispatchEvent: () => true,
    addEventListener: () => {},
    removeEventListener: () => {},
  };
}

const f = (type: Finding["type"], lineId: string, charge: number, disputeAmount: number): Finding => ({
  id: `${type}:${lineId}`,
  type,
  lineId,
  cpt: "70450",
  description: "CT head",
  dateOfService: "2026-01-01",
  charge,
  units: 1,
  disputeAmount,
  title: "t",
  explanation: "e",
  ruleRef: "r",
  source: "s",
});

describe("store", () => {
  beforeEach(() => {
    installWindow();
    resetClock();
  });

  it("creates a dispute from findings", () => {
    const d = createDispute({
      provider: "Mercy",
      state: "TX",
      billTotal: 3000,
      findings: [f("duplicate", "l2", 800, 800), f("above_medicare", "l3", 1200, 900)],
    });
    expect(d.status).toBe("letter_sent");
    expect(d.events).toEqual([{ at: d.startedAt, type: "letter_sent" }]);
    expect(d.amountDisputed).toBe(1700);
    expect(d.lines.map((l) => [l.lineId, l.argument, l.originalPrice])).toEqual([
      ["l2", "duplicate", 800],
      ["l3", "above_medicare", 1200],
    ]);
    expect(listDisputes()).toHaveLength(1);
  });

  it("status follows the virtual clock and follow-up", () => {
    const d = createDispute({ provider: "Mercy", state: null, billTotal: 1, findings: [f("duplicate", "l1", 100, 100)] });
    simulateDays(30);
    expect(getDispute(d.id)!.status).toBe("follow_up_due");
    markFollowUpSent(d.id);
    expect(getDispute(d.id)!.status).toBe("waiting");
    simulateDays(30);
    expect(getDispute(d.id)!.status).toBe("escalation_due");
  });

  it("resolve clamps prices and computes savings; escalate saves 0", () => {
    const a = createDispute({ provider: "A", state: null, billTotal: 1, findings: [f("duplicate", "l1", 100, 100), f("above_medicare", "l2", 500, 300)] });
    const b = createDispute({ provider: "B", state: null, billTotal: 1, findings: [f("duplicate", "x", 50, 50)] });
    const r = resolveDispute(a.id, {
      l1: { finalPrice: 0, argument: "duplicate" },
      l2: { finalPrice: 9999, argument: "charity_care" },
    })!;
    expect(r.status).toBe("resolved");
    expect(r.savedAmount).toBe(100);
    expect(r.lines[1]).toMatchObject({ finalPrice: 500, argument: "charity_care" });
    expect(r.outcomeShared).toBe(false);
    const e = escalateDispute(b.id)!;
    expect(e.status).toBe("escalated");
    expect(e.lines[0].finalPrice).toBe(50);
    expect(savedSoFar()).toBe(100);
    simulateDays(90);
    expect(getDispute(a.id)!.status).toBe("resolved");
    deleteDispute(b.id);
    expect(listDisputes()).toHaveLength(1);
  });

  it("itemized-bill request: created without lines, closed on receipt with nothing to share", () => {
    const d = createDispute({ provider: "Lakeview", state: "OH", billTotal: 2890, findings: [], kind: "itemized_request" });
    expect(d).toMatchObject({ kind: "itemized_request", amountDisputed: 0, lines: [] });
    const closed = markItemizedReceived(d.id)!;
    expect(closed).toMatchObject({ status: "resolved", savedAmount: 0, outcomeShared: true });
    expect(closed.events.at(-1)?.type).toBe("itemized_received");
    expect(savedSoFar()).toBe(0);
  });

  it("stores the PPDR deadline and marks it filed", () => {
    const ppdr = { gfeAmount: 1000, billDate: "2026-10-01", billed: 2000, difference: 1000, deadline: "2027-01-29" };
    const d = createDispute({ provider: "Maple", state: "PA", billTotal: 2000, findings: [], ppdr });
    expect(getDispute(d.id)?.ppdr).toEqual(ppdr);
    expect(markPpdrFiled(d.id)!.events.some((e) => e.type === "ppdr_filed")).toBe(true);
  });

  it("closing twice does nothing the second time (double click)", () => {
    const d = createDispute({ provider: "Mercy", state: "TX", billTotal: 3000, findings: [f("duplicate", "l2", 800, 800)] });
    const first = resolveDispute(d.id, { l2: { finalPrice: 0, argument: "duplicate" } })!;
    const second = resolveDispute(d.id, { l2: { finalPrice: 500, argument: "duplicate" } })!;
    expect(second.savedAmount).toBe(first.savedAmount);
    expect(second.events.filter((e) => e.type === "resolved")).toHaveLength(1);
    expect(escalateDispute(d.id)!.status).toBe("resolved");
  });
});
