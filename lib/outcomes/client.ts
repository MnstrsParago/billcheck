/** Client-safe helpers for the shared outcomes DB. No server imports here. */
import type { CodeOutcomeStats, Dispute } from "@/lib/types";

const ID_RE = /^[A-Za-z0-9_.-]{1,80}$/;
const CPT_RE = /^[A-Z0-9]{5}$/;
const cents = (n: number) => Math.round(n * 100) / 100;

/** Build the anonymous payload: no patient data, no dates, no free text. Null if not shareable. */
export function buildOutcomePayload(d: Dispute) {
  if (d.status !== "resolved" && d.status !== "escalated") return null;
  const disputeId = d.id.replace(/[^A-Za-z0-9_.-]/g, "").slice(0, 80);
  const hospital = (d.provider ?? "").trim().slice(0, 120);
  if (!disputeId || !hospital) return null;
  const state = d.state && /^[A-Za-z]{2}$/.test(d.state.trim()) ? d.state.trim().toUpperCase() : null;
  const lines = d.lines
    .filter((l) => ID_RE.test(l.lineId) && Number.isFinite(l.originalPrice) && l.originalPrice >= 0)
    .slice(0, 100)
    .map((l) => {
      const originalPrice = cents(Math.min(l.originalPrice, 1e7));
      const rawFinal = l.finalPrice ?? originalPrice; // escalated without a final price = unchanged
      const finalPrice = cents(Math.max(0, Math.min(Number.isFinite(rawFinal) ? rawFinal : originalPrice, originalPrice)));
      const cpt = l.cpt ? l.cpt.trim().toUpperCase() : null;
      return {
        lineId: l.lineId,
        cpt: cpt && CPT_RE.test(cpt) ? cpt : null,
        originalPrice,
        finalPrice,
        argument: l.argument,
      };
    });
  if (lines.length === 0) return null;
  return { disputeId, hospital, state, status: d.status, lines };
}

export async function shareOutcome(d: Dispute): Promise<{ ok: boolean }> {
  const payload = buildOutcomePayload(d);
  if (!payload) return { ok: false };
  try {
    const res = await fetch("/api/outcomes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return { ok: false };
    const json = (await res.json()) as { ok?: boolean };
    return { ok: json.ok === true };
  } catch {
    return { ok: false };
  }
}

/** Null on failure or when the DB is not configured (503). */
export async function fetchCodeStats(hospital: string, cpts: string[]): Promise<CodeOutcomeStats[] | null> {
  const clean = [...new Set(cpts.map((c) => c.trim().toUpperCase()).filter((c) => CPT_RE.test(c)))].slice(0, 100);
  if (!hospital.trim() || clean.length === 0) return [];
  try {
    const qs = new URLSearchParams({ hospital: hospital.trim().slice(0, 120), cpts: clean.join(",") });
    const res = await fetch(`/api/outcomes/stats?${qs}`);
    if (!res.ok) return null;
    const json = (await res.json()) as { ok?: boolean; stats?: CodeOutcomeStats[] };
    return json.ok && Array.isArray(json.stats) ? json.stats : null;
  } catch {
    return null;
  }
}
