import { describe, expect, it } from "vitest";
import type { Dispute } from "@/lib/types";
import { buildIcs, escapeText, foldLine } from "./ics";
import { escalationLetter, followUpLetter } from "./letters";

const d: Dispute = {
  id: "abc-123",
  provider: "St. Mary's Hospital, Inc; Austin",
  state: "TX",
  amountDisputed: 1234.5,
  billTotal: 5000,
  startedAt: "2026-01-01T10:00:00.000Z",
  status: "letter_sent",
  events: [{ at: "2026-01-01T10:00:00.000Z", type: "letter_sent" }],
  lines: [{ lineId: "l1", cpt: "70450", description: "CT head", originalPrice: 1800, argument: "duplicate" }],
  findings: [],
};

describe("buildIcs", () => {
  const ics = buildIcs(d, new Date("2026-01-01T12:34:56Z"));

  it("is a CRLF VCALENDAR with two VEVENTs", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics.split("BEGIN:VEVENT").length - 1).toBe(2);
    expect(ics.split("END:VEVENT").length - 1).toBe(2);
    expect(/[^\r]\n/.test(ics)).toBe(false);
    expect(ics).toContain("PRODID:");
  });

  it("has all-day events on day 30 and day 60", () => {
    expect(ics).toContain("DTSTART;VALUE=DATE:20260131\r\n");
    expect(ics).toContain("DTEND;VALUE=DATE:20260201\r\n");
    expect(ics).toContain("DTSTART;VALUE=DATE:20260302\r\n");
    expect(ics).toContain("DTEND;VALUE=DATE:20260303\r\n");
  });

  it("has unique UIDs and DTSTAMP", () => {
    expect(ics).toContain("UID:abc-123-follow-up@billcheck");
    expect(ics).toContain("UID:abc-123-escalation@billcheck");
    expect(ics.split("DTSTAMP:20260101T123456Z").length - 1).toBe(2);
  });

  it("escapes text", () => {
    expect(ics.replace(/\r\n /g, "")).toContain("SUMMARY:BillCheck: send follow-up letter to St. Mary's Hospital\\, Inc\\; Austin");
    expect(escapeText("a\\b;c,d\ne")).toBe("a\\\\b\\;c\\,d\\ne");
  });

  it("folds lines to 75 octets", () => {
    for (const line of ics.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(foldLine("x".repeat(100))).toBe("x".repeat(75) + "\r\n " + "x".repeat(25));
  });
});

describe("letters", () => {
  const now = new Date("2026-02-01T00:00:00Z");
  it("follow-up references original date, provider, CPT, amounts", () => {
    const t = followUpLetter(d, now);
    expect(t).toContain("January 1, 2026");
    expect(t).toContain(d.provider);
    expect(t).toContain("CPT 70450");
    expect(t).toContain("$1,234.50");
    expect(t).toContain("$1,800.00");
  });
  it("escalation mentions itemized review and attorney general", () => {
    const t = escalationLetter(d, now);
    expect(t).toContain("itemized review");
    expect(t).toContain("attorney general");
    expect(t).toContain("January 1, 2026");
  });
});
