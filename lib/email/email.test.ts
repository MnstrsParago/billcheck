import { describe, expect, it } from "vitest";
import type { Dispute } from "@/lib/types";
import { latestSchedulable, planReminders, reminderTime } from "./plan";
import { remindersRequestSchema, summaryToDispute, toSummary } from "./schema";
import { confirmationEmail, escalationEmail, followUpEmail } from "./templates";

const DAY = 86_400_000;
const now = new Date("2026-11-15T12:00:00Z");

const dispute: Dispute = {
  id: "d-1",
  provider: "Riverside General Hospital",
  state: "TX",
  amountDisputed: 5943.61,
  billTotal: 10119,
  startedAt: now.toISOString(),
  status: "letter_sent",
  events: [{ at: now.toISOString(), type: "letter_sent" }],
  lines: [{ lineId: "l1", cpt: "70450", description: "CT head <b>", originalPrice: 1980, argument: "duplicate" }],
  findings: [],
  ppdr: { gfeAmount: 1, billDate: "2026-11-01", billed: 2, difference: 1, deadline: "2027-03-01" },
};

describe("reminder plan (Resend: max 30 days ahead, no cron)", () => {
  it("new dispute: follow-up booked for day 30 (inside the window), escalation deferred", () => {
    const p = planReminders(dispute.startedAt, new Date(now.getTime() + 60_000));
    expect(p.followUpAt).not.toBeNull();
    expect(p.followUpAt!.getTime()).toBeLessThanOrEqual(latestSchedulable(new Date(now.getTime() + 60_000)).getTime());
    expect(p.escalationAt).toBeNull();
  });
  it("escalation is booked once day 60 is within 30 days", () => {
    const later = new Date(now.getTime() + 31 * DAY);
    expect(reminderTime(dispute.startedAt, 60, later)!.toISOString()).toBe(new Date(now.getTime() + 60 * DAY).toISOString());
  });
  it("a date already passed is sent in a couple of minutes, never in the past", () => {
    const old = new Date(now.getTime() - 40 * DAY).toISOString();
    const at = reminderTime(old, 30, now)!;
    expect(at.getTime()).toBeGreaterThan(now.getTime());
    expect(at.getTime() - now.getTime()).toBeLessThan(5 * 60_000);
  });
});

describe("reminder request schema", () => {
  it("sends only a minimal summary (no state, PPDR or findings)", () => {
    const s = toSummary(dispute);
    expect(s).not.toHaveProperty("state");
    expect(s).not.toHaveProperty("ppdr");
    expect(s).not.toHaveProperty("findings");
    expect(remindersRequestSchema.safeParse({ action: "subscribe", email: "a@b.co", dispute: s }).success).toBe(true);
    expect(summaryToDispute(s).provider).toBe("Riverside General Hospital");
  });
  it("rejects bad emails and extra fields", () => {
    const s = toSummary(dispute);
    expect(remindersRequestSchema.safeParse({ action: "subscribe", email: "not-an-email", dispute: s }).success).toBe(false);
    expect(remindersRequestSchema.safeParse({ action: "subscribe", email: "a@b.co", dispute: { ...s, ssn: "x" } }).success).toBe(false);
    expect(remindersRequestSchema.safeParse({ action: "cancel", ids: ["../../x"] }).success).toBe(false);
  });
});

describe("email templates", () => {
  it("confirmation lists both dates and says honestly when day 60 is not booked yet", () => {
    const e = confirmationEmail(dispute, { followUpAt: new Date(now.getTime() + 30 * DAY), escalationAt: null });
    expect(e.text).toContain("December 15, 2026");
    expect(e.text).toContain("January 14, 2027");
    expect(e.text).toContain("within 30 days");
  });
  it("follow-up and escalation include the letters and escape HTML", () => {
    const f = followUpEmail(dispute, now);
    expect(f.subject).toContain("Day 30");
    expect(f.text).toContain("CPT 70450");
    expect(f.html).not.toContain("<b>");
    expect(f.html).toContain("&lt;b&gt;");
    expect(escalationEmail(dispute, now).subject).toContain("Day 60");
  });
});
