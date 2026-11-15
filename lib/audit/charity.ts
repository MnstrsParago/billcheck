import type { CharityResult, FplRegion, HouseholdInput } from "@/lib/types";
import fpl from "@/data/fpl-2026.json";

export const US_STATES: { code: string; name: string }[] = [
  ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"], ["CA", "California"],
  ["CO", "Colorado"], ["CT", "Connecticut"], ["DE", "Delaware"], ["DC", "District of Columbia"], ["FL", "Florida"],
  ["GA", "Georgia"], ["HI", "Hawaii"], ["ID", "Idaho"], ["IL", "Illinois"], ["IN", "Indiana"],
  ["IA", "Iowa"], ["KS", "Kansas"], ["KY", "Kentucky"], ["LA", "Louisiana"], ["ME", "Maine"],
  ["MD", "Maryland"], ["MA", "Massachusetts"], ["MI", "Michigan"], ["MN", "Minnesota"], ["MS", "Mississippi"],
  ["MO", "Missouri"], ["MT", "Montana"], ["NE", "Nebraska"], ["NV", "Nevada"], ["NH", "New Hampshire"],
  ["NJ", "New Jersey"], ["NM", "New Mexico"], ["NY", "New York"], ["NC", "North Carolina"], ["ND", "North Dakota"],
  ["OH", "Ohio"], ["OK", "Oklahoma"], ["OR", "Oregon"], ["PA", "Pennsylvania"], ["RI", "Rhode Island"],
  ["SC", "South Carolina"], ["SD", "South Dakota"], ["TN", "Tennessee"], ["TX", "Texas"], ["UT", "Utah"],
  ["VT", "Vermont"], ["VA", "Virginia"], ["WA", "Washington"], ["WV", "West Virginia"], ["WI", "Wisconsin"], ["WY", "Wyoming"],
].map(([code, name]) => ({ code, name }));

export const CHARITY_NOTE =
  "Nonprofit hospitals must have a Financial Assistance Policy (IRS §501(r)). Eligibility thresholds differ by hospital, so check your hospital's FAP. This is a rough estimate based on the 2026 HHS poverty guidelines, not a determination.";

export const CHARITY_COPY: Record<CharityResult["status"], string> = {
  likely: "Likely eligible: income at or below 200% of the federal poverty level, where care is often free or heavily discounted.",
  possibly: "Possibly eligible: income between 200% and 400% of the federal poverty level, where partial discounts are common.",
  not_likely: "Not likely eligible: income above 400% of the federal poverty level.",
  not_checked: "Not checked: enter household size and annual income to estimate eligibility.",
};

export function stateToRegion(state: string | null | undefined): FplRegion {
  const s = (state ?? "").trim().toUpperCase();
  if (s === "AK") return "alaska";
  if (s === "HI") return "hawaii";
  return "contiguous48AndDC";
}

type Table = Record<string, number>;
const G = fpl.guidelines as unknown as Record<FplRegion, Table>;

export function getGuideline(size: number, region: FplRegion): number {
  const t = G[region];
  const n = Math.floor(size);
  if (n <= 8) return t[String(n)];
  return t["8"] + (n - 8) * t.perAdditionalPerson;
}

export function checkCharity(input: HouseholdInput): CharityResult {
  const region = stateToRegion(input?.state);
  const size = input?.householdSize ?? null;
  const income = input?.annualIncome ?? null;
  const base = { householdSize: size, annualIncome: income, region };
  if (size === null || income === null || !Number.isFinite(size) || !Number.isFinite(income) || size < 1 || income < 0) {
    return { status: "not_checked", fplPercent: null, guideline: null, ...base };
  }
  const guideline = getGuideline(size, region);
  const pct = (income / guideline) * 100;
  const status = pct <= 200 ? "likely" : pct <= 400 ? "possibly" : "not_likely";
  return { status, fplPercent: Math.round(pct * 10) / 10, guideline, ...base };
}
