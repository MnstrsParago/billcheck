/**
 * Deterministic DEMO outcomes for the shared database. Every row is demo:true.
 * All hospitals are FICTIONAL. "Riverside General Hospital" (TX) and
 * "Lakeview Medical Center" (OH) match the app's sample bills.
 */
import type { OutcomeRecord, WinningArgument } from "@/lib/types";
import pfs from "@/data/medicare-pfs-2026.json";
import { normalizeHospital } from "./normalize";

type Rate = { cpt: string; nationalNonFacilityRate: number };
const RATES: Rate[] = (pfs as { rates: Rate[] }).rates;
const RATE_BY_CPT = new Map(RATES.map((r) => [r.cpt, r.nationalNonFacilityRate]));

/** mulberry32 — tiny seeded PRNG. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Profile = {
  name: string;
  state: string;
  lines: number; // target number of disputed lines
  escalateRate: number; // share of disputes that end escalated (no change)
  concedeRate: number; // within resolved disputes, share of lines reduced
  reduction: [number, number]; // above_medicare reduction range, fraction
  args: [WinningArgument, number][]; // weights
  focus?: string[]; // codes this hospital bills often (half of its lines)
};

const COMMON = ["99213", "99214", "99204", "99203", "71046", "74177", "70450", "93000", "96372", "96374", "76700", "12002", "73610", "72148"];

export const DEMO_HOSPITALS: Profile[] = [
  { name: "Riverside General Hospital", state: "TX", lines: 64, focus: ["70450", "71046", "74177", "93000", "96374"], escalateRate: 0.15, concedeRate: 0.8, reduction: [0.25, 0.6], args: [["above_medicare", 6], ["duplicate", 3], ["charity_care", 1]] },
  { name: "Lakeview Medical Center", state: "OH", lines: 50, focus: ["76700", "45378", "93306", "43239", "93000"], escalateRate: 0.35, concedeRate: 0.6, reduction: [0.1, 0.35], args: [["above_medicare", 5], ["duplicate", 4], ["charity_care", 1]] },
  { name: "Cedar Hollow Regional Medical Center", state: "CO", lines: 20, escalateRate: 0.05, concedeRate: 0.95, reduction: [0.4, 0.7], args: [["above_medicare", 7], ["duplicate", 2], ["charity_care", 1]] },
  { name: "Saint Brigid Community Hospital", state: "MN", lines: 18, escalateRate: 0.1, concedeRate: 0.9, reduction: [0.3, 0.55], args: [["charity_care", 6], ["above_medicare", 3], ["duplicate", 1]] },
  { name: "Copperfield Regional Hospital", state: "NV", lines: 16, escalateRate: 0.5, concedeRate: 0.5, reduction: [0.05, 0.25], args: [["duplicate", 6], ["above_medicare", 3], ["charity_care", 1]] },
  { name: "Maple Crest Medical Center", state: "PA", lines: 18, escalateRate: 0.2, concedeRate: 0.75, reduction: [0.2, 0.45], args: [["above_medicare", 5], ["duplicate", 3], ["charity_care", 2]] },
  { name: "Bluewater Bend Hospital", state: "FL", lines: 20, escalateRate: 0.4, concedeRate: 0.55, reduction: [0.1, 0.3], args: [["above_medicare", 4], ["duplicate", 4], ["charity_care", 1]] },
  { name: "Silver Mesa Health Center", state: "NM", lines: 14, escalateRate: 0.15, concedeRate: 0.85, reduction: [0.35, 0.65], args: [["charity_care", 4], ["above_medicare", 4], ["duplicate", 1]] },
  { name: "Ashgrove Memorial Hospital", state: "NC", lines: 16, escalateRate: 0.25, concedeRate: 0.7, reduction: [0.15, 0.5], args: [["above_medicare", 5], ["duplicate", 2], ["charity_care", 2]] },
  { name: "Redstone Prairie Medical Center", state: "KS", lines: 14, escalateRate: 0.6, concedeRate: 0.4, reduction: [0.05, 0.2], args: [["duplicate", 3], ["above_medicare", 3], ["charity_care", 1]] },
];

function pickWeighted<T>(rand: () => number, items: [T, number][]): T {
  const total = items.reduce((s, [, w]) => s + w, 0);
  let x = rand() * total;
  for (const [v, w] of items) {
    x -= w;
    if (x < 0) return v;
  }
  return items[items.length - 1][0];
}

const cents = (n: number) => Math.round(n * 100) / 100;
const BASE_DATE = Date.UTC(2026, 2, 1); // 2026-03-01

export function generateDemoOutcomes(seed = 20260301): OutcomeRecord[] {
  const rand = mulberry32(seed);
  const out: OutcomeRecord[] = [];
  DEMO_HOSPITALS.forEach((h, hi) => {
    const hospitalKey = normalizeHospital(h.name);
    let made = 0;
    let d = 0;
    while (made < h.lines) {
      d++;
      const nLines = Math.min(h.lines - made, 1 + Math.floor(rand() * 4));
      const escalated = rand() < h.escalateRate;
      const createdAt = new Date(BASE_DATE + Math.floor(rand() * 250) * 86_400_000).toISOString();
      const used = new Set<string>();
      for (let li = 0; li < nLines; li++) {
        let cpt = "";
        for (let tries = 0; tries < 10 && (!cpt || used.has(cpt)); tries++) {
          cpt = h.focus && rand() < 0.55 ? h.focus[Math.floor(rand() * h.focus.length)] : rand() < 0.7 ? COMMON[Math.floor(rand() * COMMON.length)] : RATES[Math.floor(rand() * RATES.length)].cpt;
        }
        used.add(cpt);
        const rate = RATE_BY_CPT.get(cpt) ?? 100;
        const units = rand() < 0.15 ? 2 : 1;
        const originalPrice = cents(rate * units * (3 + rand() * 9)); // 3–12× Medicare
        const argument = pickWeighted(rand, h.args);
        let finalPrice = originalPrice;
        if (!escalated && rand() < h.concedeRate) {
          let frac: number;
          if (argument === "duplicate") frac = rand() < 0.85 ? 1 : 0.5; // duplicate usually removed entirely
          else if (argument === "charity_care") frac = 0.5 + rand() * 0.5;
          else frac = h.reduction[0] + rand() * (h.reduction[1] - h.reduction[0]);
          finalPrice = cents(originalPrice * (1 - frac));
        }
        out.push({
          id: `demo~h${hi}~d${d}:l${li}`,
          hospitalKey,
          hospital: h.name,
          state: h.state,
          cpt,
          originalPrice,
          finalPrice,
          argument,
          status: escalated ? "escalated" : "resolved",
          demo: true,
          createdAt,
        });
        made++;
      }
    }
  });
  return out;
}
