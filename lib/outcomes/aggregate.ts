import type { CodeOutcomeStats, HospitalRanking, OutcomeRecord, WinningArgument } from "@/lib/types";
import { normalizeHospital } from "./normalize";

/** Hospitals with fewer closed lines than this are left out of the leaderboard. */
export const MIN_RANKING_SAMPLE = 5;

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** (orig - final) / orig * 100, clamped to 0..100. */
export function reductionPct(originalPrice: number, finalPrice: number): number {
  if (!Number.isFinite(originalPrice) || !Number.isFinite(finalPrice) || originalPrice <= 0) return 0;
  const pct = ((originalPrice - finalPrice) / originalPrice) * 100;
  return Math.min(100, Math.max(0, pct));
}

const round1 = (n: number) => Math.round(n * 10) / 10;

const isReduced = (r: OutcomeRecord) => r.finalPrice < r.originalPrice;

/** Median % reduction among lines that were actually lowered (0 if none were). */
export function medianReductionWhenLowered(records: OutcomeRecord[]): number {
  return round1(median(records.filter(isReduced).map((r) => reductionPct(r.originalPrice, r.finalPrice))));
}

const ARG_ORDER: WinningArgument[] = ["above_medicare", "duplicate", "charity_care"];

/** Most frequent argument among lines that actually got a reduction (ties: fixed order). */
export function topArgument(records: OutcomeRecord[]): WinningArgument | null {
  const counts = new Map<WinningArgument, number>();
  for (const r of records) {
    if (r.finalPrice < r.originalPrice) counts.set(r.argument, (counts.get(r.argument) ?? 0) + 1);
  }
  let best: WinningArgument | null = null;
  let bestN = 0;
  for (const a of ARG_ORDER) {
    const n = counts.get(a) ?? 0;
    if (n > bestN) {
      best = a;
      bestN = n;
    }
  }
  return best;
}

function mostFrequent<T>(values: T[]): T | null {
  const counts = new Map<T, number>();
  let best: T | null = null;
  let bestN = 0;
  for (const v of values) {
    const n = (counts.get(v) ?? 0) + 1;
    counts.set(v, n);
    if (n > bestN) {
      best = v;
      bestN = n;
    }
  }
  return best;
}

/** Per-code stats for one hospital. Only codes with at least one record are returned. */
export function codeStats(records: OutcomeRecord[], hospitalKey: string, cpts: string[]): CodeOutcomeStats[] {
  const key = normalizeHospital(hospitalKey);
  if (!key) return [];
  const wanted = new Set(cpts.map((c) => c.trim().toUpperCase()).filter(Boolean));
  const byCpt = new Map<string, OutcomeRecord[]>();
  for (const r of records) {
    if (r.hospitalKey !== key || !r.cpt || !wanted.has(r.cpt)) continue;
    const list = byCpt.get(r.cpt);
    if (list) list.push(r);
    else byCpt.set(r.cpt, [r]);
  }
  const out: CodeOutcomeStats[] = [];
  for (const cpt of wanted) {
    const list = byCpt.get(cpt);
    if (!list || list.length === 0) continue;
    out.push({
      hospitalKey: key,
      cpt,
      count: list.length,
      reducedCount: list.filter(isReduced).length,
      medianReductionPct: medianReductionWhenLowered(list),
      topArgument: topArgument(list),
      demoCount: list.filter((r) => r.demo).length,
    });
  }
  return out;
}

/** Leaderboard: concededPct desc, then medianReductionPct desc, then disputes desc. */
export function rankHospitals(records: OutcomeRecord[], minSample = MIN_RANKING_SAMPLE): HospitalRanking[] {
  const byHospital = new Map<string, OutcomeRecord[]>();
  for (const r of records) {
    if (!r.hospitalKey) continue;
    const list = byHospital.get(r.hospitalKey);
    if (list) list.push(r);
    else byHospital.set(r.hospitalKey, [r]);
  }
  const out: HospitalRanking[] = [];
  for (const [hospitalKey, list] of byHospital) {
    if (list.length < minSample) continue;
    const conceded = list.filter((r) => r.finalPrice < r.originalPrice).length;
    out.push({
      hospitalKey,
      hospital: mostFrequent(list.map((r) => r.hospital)) ?? hospitalKey,
      state: mostFrequent(list.map((r) => r.state).filter((s): s is string => !!s)),
      disputes: list.length,
      concededPct: round1((conceded / list.length) * 100),
      medianReductionPct: medianReductionWhenLowered(list),
      topArgument: topArgument(list),
      demoCount: list.filter((r) => r.demo).length,
    });
  }
  return out.sort(
    (a, b) =>
      b.concededPct - a.concededPct ||
      b.medianReductionPct - a.medianReductionPct ||
      b.disputes - a.disputes ||
      a.hospital.localeCompare(b.hospital),
  );
}

export function totals(records: OutcomeRecord[]): { records: number; demo: number; real: number } {
  const demo = records.filter((r) => r.demo).length;
  return { records: records.length, demo, real: records.length - demo };
}
