// RFC 5545 calendar export for a dispute: day-30 follow-up and day-60 escalation.

import type { Dispute } from "@/lib/types";
import { ESCALATION_DAY, FOLLOW_UP_DAY, addDays } from "./status";

/** Escape TEXT values per RFC 5545 §3.3.11. */
export function escapeText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Fold lines longer than 75 octets (RFC 5545 §3.1). */
export function foldLine(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let cur = "";
  let curLen = 0;
  for (const ch of line) {
    const len = enc.encode(ch).length;
    const limit = parts.length === 0 ? 75 : 74; // continuation lines start with a space
    if (curLen + len > limit) {
      parts.push(cur);
      cur = "";
      curLen = 0;
    }
    cur += ch;
    curLen += len;
  }
  parts.push(cur);
  return parts.join("\r\n ");
}

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
const stamp = (d: Date) =>
  `${ymd(d)}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;

export function buildIcs(d: Dispute, dtstamp: Date = new Date()): string {
  const usd = `$${d.amountDisputed.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const events = [
    {
      key: "follow-up",
      day: FOLLOW_UP_DAY,
      summary: `BillCheck: send follow-up letter to ${d.provider}`,
      description: `Day ${FOLLOW_UP_DAY} of your dispute with ${d.provider} (${usd} disputed). If there is no written response yet, send the follow-up letter from your BillCheck tracker.`,
    },
    {
      key: "escalation",
      day: ESCALATION_DAY,
      summary: `BillCheck: escalate dispute with ${d.provider}`,
      description: `Day ${ESCALATION_DAY} of your dispute with ${d.provider} (${usd} disputed). If unresolved, request a formal itemized review and consider a complaint to your state attorney general or insurance/health department consumer line.`,
    },
  ];
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//BillCheck//Dispute Tracker//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];
  for (const e of events) {
    const start = addDays(d.startedAt, e.day);
    const end = addDays(start, 1);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${d.id}-${e.key}@billcheck`,
      `DTSTAMP:${stamp(dtstamp)}`,
      `DTSTART;VALUE=DATE:${ymd(start)}`,
      `DTEND;VALUE=DATE:${ymd(end)}`,
      `SUMMARY:${escapeText(e.summary)}`,
      `DESCRIPTION:${escapeText(e.description)}`,
      "TRANSP:TRANSPARENT",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

/** Client-only: trigger a .ics download. Returns false if not possible. */
export function downloadIcs(d: Dispute): boolean {
  try {
    if (typeof window === "undefined") return false;
    const blob = new Blob([buildIcs(d)], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const slug = d.provider.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "dispute";
    a.download = `billcheck-${slug}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch {
    return false;
  }
}

/** Client-only: download any text as a file. */
export function downloadText(filename: string, text: string): boolean {
  try {
    if (typeof window === "undefined") return false;
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch {
    return false;
  }
}
