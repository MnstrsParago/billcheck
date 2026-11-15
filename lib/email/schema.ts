import * as z from "zod/v4";
import type { Dispute } from "@/lib/types";

const ARG = z.enum(["duplicate", "above_medicare", "charity_care"]);
const EVENT = z.enum([
  "letter_sent",
  "follow_up_due",
  "follow_up_sent",
  "escalation_due",
  "resolved",
  "escalated",
  "ppdr_filed",
  "itemized_received",
  "note",
]);

/** Only what the email templates need. Capped sizes, no other personal data. */
export const disputeSummarySchema = z.strictObject({
  id: z.string().min(1).max(80),
  provider: z.string().trim().min(1).max(120),
  billTotal: z.number().finite().min(0).max(1e8),
  amountDisputed: z.number().finite().min(0).max(1e8),
  startedAt: z.iso.datetime(),
  lines: z
    .array(
      z.strictObject({
        lineId: z.string().max(80),
        cpt: z.string().max(10).nullable(),
        description: z.string().max(200),
        originalPrice: z.number().finite().min(0).max(1e8),
        argument: ARG,
      }),
    )
    .max(100),
  events: z.array(z.strictObject({ at: z.iso.datetime(), type: EVENT })).max(50),
});

const email = z.email().max(254);

export const remindersRequestSchema = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("subscribe"), email, dispute: disputeSummarySchema }),
  z.strictObject({ action: z.literal("send_now"), email, dispute: disputeSummarySchema }),
  z.strictObject({ action: z.literal("schedule_escalation"), email, dispute: disputeSummarySchema }),
  z.strictObject({ action: z.literal("cancel"), ids: z.array(z.string().min(8).max(64).regex(/^[A-Za-z0-9-]+$/)).min(1).max(5) }),
]);

export type DisputeSummary = z.infer<typeof disputeSummarySchema>;

/** Turn the summary into the Dispute shape the letter templates use. */
export function summaryToDispute(s: DisputeSummary): Dispute {
  return {
    id: s.id,
    provider: s.provider,
    state: null,
    amountDisputed: s.amountDisputed,
    billTotal: s.billTotal,
    startedAt: s.startedAt,
    status: "waiting",
    events: s.events,
    lines: s.lines,
    findings: [],
  };
}

/** Browser side: the minimal summary we send (no state, findings, PPDR or other personal data). */
export function toSummary(d: Dispute): DisputeSummary {
  return {
    id: d.id.slice(0, 80),
    provider: d.provider.slice(0, 120),
    billTotal: d.billTotal,
    amountDisputed: d.amountDisputed,
    startedAt: d.startedAt,
    lines: d.lines.slice(0, 100).map((l) => ({
      lineId: l.lineId.slice(0, 80),
      cpt: l.cpt ? l.cpt.slice(0, 10) : null,
      description: l.description.slice(0, 200),
      originalPrice: l.originalPrice,
      argument: l.argument,
    })),
    events: d.events.slice(0, 50).map((e) => ({ at: e.at, type: e.type })),
  };
}
