"use client";

import type { Dispute } from "@/lib/types";
import { toSummary } from "./schema";

export type ReminderResponse = {
  ok: boolean;
  code?: string;
  error?: string;
  confirmationId?: string;
  followUp?: { id: string; at: string };
  escalation?: { id: string; at: string };
  scheduled?: boolean;
  id?: string;
  at?: string;
  keyCannotCancel?: boolean;
};

async function post(body: unknown): Promise<ReminderResponse> {
  try {
    const res = await fetch("/api/reminders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = (await res.json().catch(() => null)) as ReminderResponse | null;
    return j ?? { ok: false, error: "The email service did not answer. Please try again." };
  } catch {
    return { ok: false, error: "Network error. Please try again." };
  }
}

export const subscribeReminders = (d: Dispute, email: string) => post({ action: "subscribe", email, dispute: toSummary(d) });
export const sendFollowUpNow = (d: Dispute, email: string) => post({ action: "send_now", email, dispute: toSummary(d) });
export const scheduleEscalation = (d: Dispute, email: string) =>
  post({ action: "schedule_escalation", email, dispute: toSummary(d) });

/** Best effort: cancel emails that were scheduled for a dispute that is now closed or deleted. */
export function cancelScheduled(d: Dispute): Promise<ReminderResponse> | null {
  const ids = [d.email?.followUp?.id, d.email?.escalation?.id].filter((x): x is string => Boolean(x));
  if (ids.length === 0) return null;
  return post({ action: "cancel", ids });
}
