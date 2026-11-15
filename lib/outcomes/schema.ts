import { z } from "zod";
import type { OutcomeRecord } from "@/lib/types";
import { normalizeHospital } from "./normalize";

const ID_RE = /^[A-Za-z0-9_.-]{1,80}$/; // no ":" (id separator) and no "~" (reserved for demo ids)
const price = z.number().finite().min(0).max(1e7);

export const argumentSchema = z.enum(["duplicate", "above_medicare", "charity_care"]);

export const outcomeLineSchema = z.strictObject({
  lineId: z.string().regex(ID_RE),
  cpt: z.string().regex(/^[A-Z0-9]{5}$/).nullable(),
  originalPrice: price,
  finalPrice: price,
  argument: argumentSchema,
});

export const outcomePayloadSchema = z
  .strictObject({
    disputeId: z.string().regex(ID_RE),
    hospital: z.string().trim().min(1).max(120),
    state: z.string().regex(/^[A-Z]{2}$/).nullable(),
    status: z.enum(["resolved", "escalated"]),
    lines: z.array(outcomeLineSchema).min(1).max(100),
  })
  .superRefine((p, ctx) => {
    if (!normalizeHospital(p.hospital)) {
      ctx.addIssue({ code: "custom", path: ["hospital"], message: "Hospital name is empty after normalization" });
    }
    const seen = new Set<string>();
    p.lines.forEach((l, i) => {
      if (seen.has(l.lineId)) ctx.addIssue({ code: "custom", path: ["lines", i, "lineId"], message: "Duplicate lineId" });
      seen.add(l.lineId);
      if (p.status === "resolved" && l.finalPrice > l.originalPrice) {
        ctx.addIssue({ code: "custom", path: ["lines", i, "finalPrice"], message: "finalPrice must be <= originalPrice" });
      }
    });
  });

export type OutcomePayload = z.infer<typeof outcomePayloadSchema>;

/** Turn a validated payload into anonymous records. Server always forces demo:false. */
export function payloadToRecords(p: OutcomePayload, now: Date = new Date()): OutcomeRecord[] {
  // Day precision only, to avoid fingerprinting.
  const createdAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
  const hospitalKey = normalizeHospital(p.hospital);
  return p.lines.map((l) => ({
    id: `${p.disputeId}:${l.lineId}`,
    hospitalKey,
    hospital: p.hospital.trim(),
    state: p.state,
    cpt: l.cpt,
    originalPrice: l.originalPrice,
    // Escalated = hospital did not settle; never record a final price above the original.
    finalPrice: Math.min(l.finalPrice, l.originalPrice),
    argument: l.argument,
    status: p.status,
    demo: false,
    createdAt,
  }));
}

/** Loose validation for rows read back from Redis. */
export const storedRecordSchema = z.object({
  id: z.string(),
  hospitalKey: z.string(),
  hospital: z.string(),
  state: z.string().nullable(),
  cpt: z.string().nullable(),
  originalPrice: z.number(),
  finalPrice: z.number(),
  argument: argumentSchema,
  status: z.enum(["resolved", "escalated"]),
  demo: z.boolean(),
  createdAt: z.string(),
});

export const statsQuerySchema = z.object({
  hospital: z.string().trim().min(1).max(120),
  cpts: z.array(z.string().regex(/^[A-Z0-9]{5}$/)).min(1).max(100),
});
