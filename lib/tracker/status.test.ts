import { describe, expect, it } from "vitest";
import type { Dispute } from "@/lib/types";
import { DAY_MS, computeStatus, nextAction } from "./status";

const START = "2026-01-01T10:00:00.000Z";
const at = (days: number) => new Date(new Date(START).getTime() + days * DAY_MS);

function mk(over: Partial<Dispute> = {}): Dispute {
  return {
    id: "d1",
    provider: "Mercy General",
    state: "TX",
    amountDisputed: 500,
    billTotal: 2000,
    startedAt: START,
    status: "letter_sent",
    events: [{ at: START, type: "letter_sent" }],
    lines: [],
    findings: [],
    ...over,
  };
}

describe("computeStatus", () => {
  it("day 0 is letter_sent", () => {
    expect(computeStatus(mk(), at(0))).toBe("letter_sent");
    expect(computeStatus(mk(), new Date(at(1).getTime() - 1))).toBe("letter_sent");
  });
  it("days 1–29 are waiting", () => {
    expect(computeStatus(mk(), at(1))).toBe("waiting");
    expect(computeStatus(mk(), at(29))).toBe("waiting");
  });
  it("day 30 is follow_up_due", () => {
    expect(computeStatus(mk(), at(30))).toBe("follow_up_due");
    expect(computeStatus(mk(), at(59))).toBe("follow_up_due");
  });
  it("follow_up_sent moves back to waiting until day 60", () => {
    const d = mk({ events: [{ at: START, type: "letter_sent" }, { at: at(31).toISOString(), type: "follow_up_sent" }] });
    expect(computeStatus(d, at(31))).toBe("waiting");
    expect(computeStatus(d, at(59))).toBe("waiting");
    expect(computeStatus(d, at(60))).toBe("escalation_due");
  });
  it("day 60 is escalation_due even without follow-up", () => {
    expect(computeStatus(mk(), at(60))).toBe("escalation_due");
    expect(computeStatus(mk(), at(200))).toBe("escalation_due");
  });
  it("resolved and escalated are terminal", () => {
    expect(computeStatus(mk({ status: "resolved" }), at(0))).toBe("resolved");
    expect(computeStatus(mk({ status: "resolved" }), at(90))).toBe("resolved");
    expect(computeStatus(mk({ status: "escalated" }), at(45))).toBe("escalated");
  });
  it("clock before start counts as day 0", () => {
    expect(computeStatus(mk(), at(-3))).toBe("letter_sent");
  });
});

describe("nextAction", () => {
  it("returns null with no open disputes", () => {
    expect(nextAction([], at(0))).toBeNull();
    expect(nextAction([mk({ status: "resolved" })], at(10))).toBeNull();
  });
  it("points to the day-30 follow-up first", () => {
    const a = nextAction([mk()], at(5))!;
    expect(a.kind).toBe("follow_up");
    expect(a.disputeId).toBe("d1");
    expect(a.dueDate.toISOString()).toBe(at(30).toISOString());
    expect(a.label).toContain("Mercy General");
  });
  it("after follow-up sent, points to day-60 escalation", () => {
    const d = mk({ events: [{ at: START, type: "letter_sent" }, { at: at(32).toISOString(), type: "follow_up_sent" }] });
    const a = nextAction([d], at(32))!;
    expect(a.kind).toBe("escalation");
    expect(a.dueDate.toISOString()).toBe(at(60).toISOString());
  });
  it("escalation_due without follow-up is an escalation step", () => {
    expect(nextAction([mk()], at(61))!.kind).toBe("escalation");
  });
  it("picks the nearest step across disputes", () => {
    const older = mk({ id: "old", startedAt: at(-20).toISOString() }); // follow-up at day 10
    const newer = mk({ id: "new" }); // follow-up at day 30
    const closed = mk({ id: "closed", startedAt: at(-50).toISOString(), status: "escalated" });
    const a = nextAction([newer, closed, older], at(1))!;
    expect(a.disputeId).toBe("old");
    expect(a.dueDate.toISOString()).toBe(at(10).toISOString());
  });
});
