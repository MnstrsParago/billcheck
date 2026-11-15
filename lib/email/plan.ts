// Pure scheduling rules for email reminders (no cron: Resend's scheduled_at, max 30 days ahead).
import { MAX_SCHEDULE_DAYS } from "./limits";

const DAY = 86_400_000;
const MIN = 60_000;
export const FOLLOW_UP_DAY = 30;
export const ESCALATION_DAY = 60;

/** Latest moment Resend accepts, with a safety margin. */
export function latestSchedulable(now: Date): Date {
  return new Date(now.getTime() + MAX_SCHEDULE_DAYS * DAY - 15 * MIN);
}

/** When to send a reminder for day N, or null if it is still beyond the 30-day window (schedule later). */
export function reminderTime(startedAt: string, day: number, now: Date): Date | null {
  const due = new Date(Date.parse(startedAt) + day * DAY);
  if (!Number.isFinite(due.getTime())) return null;
  const earliest = new Date(now.getTime() + 2 * MIN); // already due → send in 2 minutes
  const at = due < earliest ? earliest : due;
  const latest = latestSchedulable(now);
  if (at <= latest) return at;
  // Day 30 of a dispute started today sits a few minutes past Resend's 30-day limit: send it at the limit instead.
  if (at.getTime() - latest.getTime() <= DAY) return latest;
  return null;
}

export function planReminders(startedAt: string, now: Date) {
  return {
    followUpAt: reminderTime(startedAt, FOLLOW_UP_DAY, now),
    escalationAt: reminderTime(startedAt, ESCALATION_DAY, now),
  };
}
