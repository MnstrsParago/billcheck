// (D) No Surprises Act — Good Faith Estimate check for uninsured / self-pay patients.
// Rules checked against https://www.cms.gov/medical-bill-rights/help/dispute-a-bill (Nov 2026):
//  - billed at least $400 more than the provider's Good Faith Estimate,
//  - initial bill dated within the last 120 calendar days,
//  - $25 non-refundable administrative fee; filed via the federal patient-provider dispute resolution (PPDR) process.

export const PPDR_THRESHOLD = 400;
export const PPDR_WINDOW_DAYS = 120;
export const PPDR_FEE = 25;
export const PPDR_SOURCE_URL = "https://www.cms.gov/medical-bill-rights/help/dispute-a-bill";
export const PPDR_PORTAL_URL = "https://nsa-idr.cms.gov/billdisputes";

export type GfeInput = {
  gfeAmount: number | null; // total on the Good Faith Estimate from this provider
  billDate: string | null; // date on the initial bill, yyyy-mm-dd
  selfPay: boolean; // didn't have or didn't use insurance for this care
};

export type GfeStatus = "not_checked" | "insured" | "below_threshold" | "eligible" | "deadline_passed";

export type GfeResult = {
  status: GfeStatus;
  billed: number;
  gfeAmount: number | null;
  difference: number | null; // billed − GFE
  deadline: string | null; // yyyy-mm-dd, bill date + 120 days
  daysLeft: number | null;
};

const DAY = 86_400_000;
const parseYmd = (s: string | null): number | null => {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const t = Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
  return Number.isFinite(t) ? t : null;
};
const toYmd = (t: number) => new Date(t).toISOString().slice(0, 10);

export const EMPTY_GFE: GfeInput = { gfeAmount: null, billDate: null, selfPay: true };

export function checkGfe(input: GfeInput, billed: number, now: Date): GfeResult {
  const gfe = input.gfeAmount;
  const bill = parseYmd(input.billDate);
  const base: GfeResult = { status: "not_checked", billed, gfeAmount: gfe, difference: null, deadline: null, daysLeft: null };
  if (gfe === null || !Number.isFinite(gfe) || gfe < 0 || bill === null) return base;

  const difference = Math.round((billed - gfe) * 100) / 100;
  const deadlineT = bill + PPDR_WINDOW_DAYS * DAY;
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const daysLeft = Math.round((deadlineT - today) / DAY);
  const r = { ...base, difference, deadline: toYmd(deadlineT), daysLeft };

  if (!input.selfPay) return { ...r, status: "insured" };
  if (difference < PPDR_THRESHOLD) return { ...r, status: "below_threshold" };
  if (daysLeft < 0) return { ...r, status: "deadline_passed" };
  return { ...r, status: "eligible" };
}

export const GFE_LABEL: Record<GfeStatus, string> = {
  not_checked: "Not checked",
  insured: "Not applicable (insurance used)",
  below_threshold: "Under the $400 threshold",
  eligible: "You can file a federal dispute",
  deadline_passed: "120-day deadline passed",
};
