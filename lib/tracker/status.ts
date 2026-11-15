// Pure status logic for disputes. No storage, no window.

import type { Dispute, DisputeStatus } from "@/lib/types";

export const DAY_MS = 86_400_000;
export const FOLLOW_UP_DAY = 30;
export const ESCALATION_DAY = 60;
/** Itemized-bill requests: follow up after 14 days. */
export const ITEMIZED_FOLLOW_UP_DAY = 14;

export function addDays(iso: string | Date, days: number): Date {
  const t = typeof iso === "string" ? new Date(iso).getTime() : iso.getTime();
  return new Date(t + days * DAY_MS);
}

/** Whole days elapsed since the dispute started (never negative). */
export function daysSince(d: Pick<Dispute, "startedAt">, now: Date): number {
  const start = new Date(d.startedAt).getTime();
  if (!Number.isFinite(start)) return 0;
  return Math.max(0, Math.floor((now.getTime() - start) / DAY_MS));
}

export function isClosed(d: Pick<Dispute, "status">): boolean {
  return d.status === "resolved" || d.status === "escalated";
}

export function isItemizedRequest(d: Pick<Dispute, "kind">): boolean {
  return d.kind === "itemized_request";
}

export function hasFollowUpSent(d: Pick<Dispute, "events">): boolean {
  return d.events.some((e) => e.type === "follow_up_sent");
}

export function hasPpdrFiled(d: Pick<Dispute, "events">): boolean {
  return d.events.some((e) => e.type === "ppdr_filed");
}

/** End of the PPDR deadline day (UTC), or null. */
export function ppdrDeadline(d: Pick<Dispute, "ppdr">): Date | null {
  if (!d.ppdr?.deadline) return null;
  const t = Date.parse(`${d.ppdr.deadline}T00:00:00Z`);
  return Number.isFinite(t) ? new Date(t) : null;
}

/**
 * Disputes: day 0 → letter_sent; days 1–29 → waiting; day ≥30 → follow_up_due until a
 * follow_up_sent event (then waiting); day ≥60 → escalation_due.
 * Itemized-bill requests: day 0 → letter_sent; day ≥14 → follow_up_due until follow_up_sent; never escalate.
 * resolved / escalated are terminal.
 */
export function computeStatus(d: Dispute, now: Date): DisputeStatus {
  if (isClosed(d)) return d.status;
  const days = daysSince(d, now);
  if (isItemizedRequest(d)) {
    if (days >= ITEMIZED_FOLLOW_UP_DAY && !hasFollowUpSent(d)) return "follow_up_due";
    return days === 0 ? "letter_sent" : "waiting";
  }
  if (days >= ESCALATION_DAY) return "escalation_due";
  if (days >= FOLLOW_UP_DAY) return hasFollowUpSent(d) ? "waiting" : "follow_up_due";
  if (days === 0) return "letter_sent";
  return "waiting";
}

export type NextActionKind = "follow_up" | "escalation" | "ppdr_deadline";

export type NextAction = {
  disputeId: string;
  label: string;
  dueDate: Date;
  kind: NextActionKind;
};

/** The upcoming (or overdue) step for one open dispute — the earliest of its regular step and the PPDR deadline. */
export function nextStepFor(d: Dispute, now: Date): NextAction | null {
  const status = computeStatus(d, now);
  if (status === "resolved" || status === "escalated") return null;
  const provider = d.provider || "the provider";
  const steps: NextAction[] = [];

  if (isItemizedRequest(d)) {
    if (!hasFollowUpSent(d)) {
      steps.push({
        disputeId: d.id,
        kind: "follow_up",
        dueDate: addDays(d.startedAt, ITEMIZED_FOLLOW_UP_DAY),
        label: `Follow up on your itemized bill request to ${provider}`,
      });
    }
  } else if (status === "escalation_due" || hasFollowUpSent(d)) {
    steps.push({
      disputeId: d.id,
      kind: "escalation",
      dueDate: addDays(d.startedAt, ESCALATION_DAY),
      label: `Escalate the dispute with ${provider}`,
    });
  } else {
    steps.push({
      disputeId: d.id,
      kind: "follow_up",
      dueDate: addDays(d.startedAt, FOLLOW_UP_DAY),
      label: `Send a follow-up letter to ${provider}`,
    });
  }

  const deadline = ppdrDeadline(d);
  if (deadline && !hasPpdrFiled(d)) {
    steps.push({
      disputeId: d.id,
      kind: "ppdr_deadline",
      dueDate: deadline,
      label: `File the federal Good Faith Estimate dispute about ${provider}`,
    });
  }
  return steps.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())[0] ?? null;
}

/** Nearest step across all open disputes, or null if none. */
export function nextAction(disputes: Dispute[], now: Date): NextAction | null {
  let best: NextAction | null = null;
  for (const d of disputes) {
    const step = nextStepFor(d, now);
    if (step && (!best || step.dueDate.getTime() < best.dueDate.getTime())) best = step;
  }
  return best;
}

export const STATUS_LABEL: Record<DisputeStatus, string> = {
  letter_sent: "Letter sent",
  waiting: "Waiting for response",
  follow_up_due: "Follow-up due",
  escalation_due: "Escalation due",
  resolved: "Resolved",
  escalated: "Escalated",
};
