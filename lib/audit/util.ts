import type { BillLine } from "@/lib/types";

export function formatUSD(n: number): string {
  const v = Number.isFinite(n) ? n : 0;
  return v.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export function normalizeCpt(cpt: string | null | undefined): string | null {
  if (typeof cpt !== "string") return null;
  const c = cpt.trim().toUpperCase();
  return c === "" ? null : c;
}

export function normalizeUnits(units: number): number {
  return Number.isFinite(units) && units > 0 ? units : 1;
}

export function validCharge(line: BillLine): boolean {
  return typeof line.charge === "number" && Number.isFinite(line.charge);
}
