// Letter templates. Plain string templates filled from the audit — no LLM involved.
import type { CharityResult, Finding } from "./types";

const usdFmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
export function usd(n: number): string {
  return usdFmt.format(Number.isFinite(n) ? n : 0);
}

function longDate(d: Date): string {
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

function providerName(p: string | null | undefined): string {
  const t = (p ?? "").trim();
  return t || "[Hospital name]";
}

const SIGNATURE = ["Sincerely,", "", "[Your name]", "[Your address]", "[Phone / email]"];

export type DisputeLetterInput = {
  provider: string | null;
  findings: Finding[];
  billTotal: number;
  totalDisputable: number;
  /** Letter date; defaults to today. */
  date?: Date;
  accountNumber?: string | null;
  patientName?: string | null;
};

function findingLine(f: Finding, i: number): string[] {
  const code = f.cpt ? `CPT ${f.cpt}` : "No CPT code";
  const when = f.dateOfService ? `date of service ${f.dateOfService}` : "date of service not listed";
  const out = [
    `${i + 1}. ${code} — ${f.description} (${when})`,
    `   Charged: ${usd(f.charge)}${f.units > 1 ? ` for ${f.units} units` : ""}`,
  ];
  if (f.type === "duplicate") {
    out.push(
      "   Issue: Possible duplicate charge. This line appears to repeat another line with the same code, date and amount, " +
        "and no modifier indicating a legitimately repeated procedure (59, 76, 77, 91, XE, XS, XP, XU).",
    );
  } else {
    const rate = f.medicareRate !== undefined ? usd(f.medicareRate) : "the Medicare reference rate";
    const opps = f.referenceKind === "opps";
    const mult = f.multiple !== undefined ? `${f.multiple.toFixed(1)}x` : opps ? "more than 4x" : "more than 3x";
    const table = opps
      ? "the 2026 Medicare hospital outpatient (OPPS) national payment rate"
      : "the 2026 Medicare national non-facility rate";
    out.push(
      `   Issue: The price per unit is ${mult} ${table} for this code (${rate} per unit). ` +
        "I am asking you to justify this price or reduce it to a reasonable amount.",
    );
  }
  out.push(`   Amount in question: ${usd(f.disputeAmount)}`);
  return out;
}

export function buildDisputeLetter(input: DisputeLetterInput): string {
  const date = input.date ?? new Date();
  const provider = providerName(input.provider);
  const hasDup = input.findings.some((f) => f.type === "duplicate");
  const hasPrice = input.findings.some((f) => f.type === "above_medicare");

  const lines: string[] = [
    longDate(date),
    "",
    `${provider}`,
    "Attn: Patient Financial Services / Billing Department",
    "",
    `Re: Request for itemized bill review — Account ${input.accountNumber?.trim() || "[Account number]"}`,
    `Patient: ${input.patientName?.trim() || "[Patient name]"}`,
    "",
    "To whom it may concern,",
    "",
    `I am writing to dispute charges on my bill from ${provider}. The bill totals ${usd(input.billTotal)}. ` +
      `After reviewing the itemized statement line by line, I found ${input.findings.length} ` +
      `charge${input.findings.length === 1 ? "" : "s"} that I believe ${input.findings.length === 1 ? "is" : "are"} ` +
      `incorrect or unreasonable, totaling ${usd(input.totalDisputable)}:`,
    "",
  ];

  if (input.findings.length === 0) {
    lines.push("(No specific line items listed.)", "");
  } else {
    input.findings.forEach((f, i) => {
      lines.push(...findingLine(f, i), "");
    });
    lines.push(`Total amount in question: ${usd(input.totalDisputable)}`, "");
  }

  if (hasPrice) {
    lines.push(
      "Reference prices are the CMS Medicare Physician Fee Schedule, CY2026, national non-facility rates " +
        "(RVU26D, conversion factor $33.4009). I understand these are a reference point, not a binding price, " +
        "but charges several times higher deserve an explanation.",
      "",
    );
  }

  lines.push("I respectfully request that you:", "");
  const asks = [
    "Conduct an itemized review of my account, including the medical records supporting each charge listed above.",
    hasDup ? "Remove any duplicate charges that cannot be supported by the medical record." : null,
    hasPrice ? "Explain or adjust the charges listed above that are far above reference prices." : null,
    "Send me a corrected, itemized bill reflecting the outcome of your review.",
    "Place my account on hold and do not refer it to a collection agency or report it to credit bureaus while this dispute is under review.",
    "Respond in writing within 30 days of receiving this letter.",
  ].filter((s): s is string => s !== null);
  asks.forEach((a, i) => lines.push(`${i + 1}. ${a}`));
  lines.push(
    "",
    "I am willing to pay the charges that are accurate and fairly priced once this review is complete.",
    "",
    ...SIGNATURE,
  );
  return lines.join("\n");
}

export type CharityLetterInput = {
  provider: string | null;
  charity: CharityResult;
  state?: string | null;
  billTotal: number;
  date?: Date;
  accountNumber?: string | null;
  patientName?: string | null;
};

/** True when the charity care letter can be generated (income + household entered and %FPL computed). */
export function canBuildCharityLetter(c: CharityResult): boolean {
  return c.status !== "not_checked" && c.fplPercent !== null && c.annualIncome !== null && c.householdSize !== null;
}

export function buildCharityLetter(input: CharityLetterInput): string {
  const { charity } = input;
  if (!canBuildCharityLetter(charity)) {
    throw new Error("Charity care letter needs household size and annual income");
  }
  const date = input.date ?? new Date();
  const provider = providerName(input.provider);
  const size = charity.householdSize as number;
  const income = charity.annualIncome as number;
  const pct = charity.fplPercent as number;
  const guideline = charity.guideline;

  const lines: string[] = [
    longDate(date),
    "",
    provider,
    "Attn: Financial Assistance / Charity Care Office",
    "",
    `Re: Request for financial assistance — Account ${input.accountNumber?.trim() || "[Account number]"}`,
    `Patient: ${input.patientName?.trim() || "[Patient name]"}`,
    "",
    "To whom it may concern,",
    "",
    `I am requesting financial assistance (charity care) for my bill from ${provider}, which totals ${usd(input.billTotal)}.`,
    "",
    "My household information:",
    `- Household size: ${size} ${size === 1 ? "person" : "people"}`,
    `- Annual household income: ${usd(income)}`,
    `- Income as a share of the 2026 HHS Federal Poverty Guideline: ${pct.toFixed(1)}% FPL` +
      (guideline !== null ? ` (guideline for my household: ${usd(guideline)})` : ""),
  ];
  if (input.state?.trim()) lines.push(`- State of residence: ${input.state.trim().toUpperCase()}`);
  lines.push(
    "",
    "Under Section 501(r) of the Internal Revenue Code, nonprofit hospitals must maintain a written Financial Assistance " +
      "Policy (FAP), make it widely available, and limit charges for patients who qualify. Based on my income, I believe I may " +
      "qualify for free or discounted care under your policy.",
    "",
    "I respectfully request that you:",
    "",
    "1. Send me your Financial Assistance Policy, the plain-language summary, and the application form.",
    "2. Review my account for a full or partial discount under your FAP, and apply it to all eligible charges.",
    "3. Place my account on hold and suspend any extraordinary collection actions (including referral to collections or credit reporting) while my application is pending.",
    "4. Tell me in writing which documents you need to verify my income.",
    "",
    "I can provide proof of income (pay stubs, tax return or benefit letters) on request.",
    "",
    ...SIGNATURE,
  );
  return lines.join("\n");
}

/** Safe file name for a downloaded letter, e.g. "dispute-letter-st-mary-hospital.txt". */
export function letterFilename(kind: "dispute" | "charity" | "ppdr" | "itemized-request", provider: string | null): string {
  const slug = (provider ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const base = kind === "dispute" ? "dispute-letter" : "charity-care-request";
  return `${base}${slug ? `-${slug}` : ""}.txt`;
}

// ---------------------------------------------------------------------------
// No Surprises Act — federal patient-provider dispute resolution (PPDR) request.
// Rules: https://www.cms.gov/medical-bill-rights/help/dispute-a-bill

export type PpdrRequestInput = {
  provider: string | null;
  providerState?: string | null;
  gfeAmount: number;
  billDate: string; // yyyy-mm-dd
  billed: number;
  deadline: string; // yyyy-mm-dd
  date?: Date;
};

const ymdLong = (ymd: string) => longDate(new Date(`${ymd}T00:00:00Z`));

/** Text for the PPDR submission (online portal or mail/fax form): the facts the dispute rests on. */
export function buildPpdrRequest(input: PpdrRequestInput): string {
  const provider = providerName(input.provider);
  const diff = Math.round((input.billed - input.gfeAmount) * 100) / 100;
  return [
    "PATIENT-PROVIDER DISPUTE RESOLUTION REQUEST (No Surprises Act)",
    `Prepared ${longDate(input.date ?? new Date())}`,
    "",
    "Submit at https://nsa-idr.cms.gov/billdisputes (or with the CMS mail/fax form).",
    `Deadline: ${ymdLong(input.deadline)} (120 calendar days from the date on the initial bill).`,
    "Administrative fee: $25, non-refundable, paid when you submit.",
    "",
    "Patient",
    "  Name: [Your name]",
    "  Address / phone / email: [Your contact details]",
    "",
    "Provider or facility",
    `  Name: ${provider}`,
    `  State: ${input.providerState?.trim() || "[State]"}`,
    "  Address / phone: [From the bill]",
    "",
    "Facts",
    "  - I did not have, or did not use, health insurance for this care and told the provider so before the care.",
    "  - Before the care, I received a Good Faith Estimate from this provider.",
    `  - Good Faith Estimate total: ${usd(input.gfeAmount)}`,
    `  - Date on the initial bill: ${ymdLong(input.billDate)}`,
    `  - Amount billed: ${usd(input.billed)}`,
    `  - Billed above the estimate: ${usd(diff)} (the threshold is $400 or more)`,
    "",
    "Request",
    "  I am asking a selected dispute resolution entity to determine the amount I should pay for these items and",
    "  services. While the dispute is in progress, the provider may not move this bill into collections or threaten",
    "  to do so, must stop pursuing payment if it is already in collections, and may not collect late fees.",
    "",
    "Attach",
    "  - A copy of the Good Faith Estimate",
    "  - A copy of the bill (itemized, if you have it)",
    "",
    "Source: CMS, “Dispute a medical bill” — https://www.cms.gov/medical-bill-rights/help/dispute-a-bill",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Only a summary bill: ask the hospital for the itemized bill.

export type ItemizedRequestInput = {
  provider: string | null;
  billTotal: number | null;
  billDate?: string | null; // yyyy-mm-dd
  date?: Date;
};

export function buildItemizedRequest(input: ItemizedRequestInput): string {
  const provider = providerName(input.provider);
  const total = input.billTotal !== null && Number.isFinite(input.billTotal) && input.billTotal > 0 ? usd(input.billTotal) : null;
  return [
    longDate(input.date ?? new Date()),
    "",
    provider,
    "Attn: Patient Financial Services / Billing Department",
    "",
    "Re: Request for an itemized bill — Account [Account number]",
    "Patient: [Patient name]",
    "",
    "To whom it may concern,",
    "",
    `I received a summary statement from ${provider}${input.billDate ? ` dated ${ymdLong(input.billDate)}` : ""}${total ? ` for ${total}` : ""}. ` +
      "Before I pay, I am requesting a complete itemized bill for this account.",
    "",
    "Please include, for every charge:",
    "  1. The date of service",
    "  2. The CPT or HCPCS code (and any modifiers) and the revenue code",
    "  3. A description of the service, supply or drug",
    "  4. The number of units and the charge per line",
    "  5. Any payments, adjustments and discounts applied",
    "",
    "Please also send a copy of your Financial Assistance Policy and its application form.",
    "",
    "I ask that this account be placed on hold and not be referred to collections until I receive the itemized bill and have",
    "had a reasonable time to review it. Please send it within 14 days by mail or to the email address below.",
    "",
    ...SIGNATURE,
  ].join("\n");
}
