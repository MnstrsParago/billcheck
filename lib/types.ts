// Shared contracts for BillCheck. All modules import from here.
// Changing a type here affects every part of the app — coordinate before editing.

/** One line of an itemized bill as the user sees/edits it in the table. */
export type BillLine = {
  id: string; // stable client-side id (e.g. crypto.randomUUID())
  dateOfService: string | null; // ISO yyyy-mm-dd
  cpt: string | null; // 5-char CPT/HCPCS code; never a revenue code
  modifiers: string[];
  description: string;
  units: number; // default 1
  charge: number; // line total, USD
};

/** What /api/extract returns from the LLM (after zod validation). */
export type ExtractedLine = Omit<BillLine, "id">;
export type ExtractedBill = {
  provider: string | null;
  providerState: string | null; // 2-letter US state code if printed on the bill
  patientBalance: number | null;
  totalCharges: number | null;
  lines: ExtractedLine[];
};

export type ExtractResponse =
  | { ok: true; bill: ExtractedBill; dropped: { index: number; reason: string }[] }
  | { ok: false; error: string };

/** FPL region keys match data/fpl-2026.json → guidelines. */
export type FplRegion = "contiguous48AndDC" | "alaska" | "hawaii";

export type HouseholdInput = {
  householdSize: number | null;
  annualIncome: number | null;
  state: string | null; // 2-letter US state code (incl. "DC"); AK/HI select their own FPL table
};

export type FindingType = "duplicate" | "above_medicare";

/** pfs = Physician Fee Schedule national non-facility rate; opps = hospital outpatient (OPPS) facility rate. */
export type ReferenceKind = "pfs" | "opps";

export type Finding = {
  id: string; // `${type}:${lineId}`
  type: FindingType;
  lineId: string;
  cpt: string | null;
  description: string;
  dateOfService: string | null;
  charge: number; // line charge
  units: number;
  disputeAmount: number; // dollars counted toward "$X you can dispute"
  title: string; // short label, e.g. "Possible duplicate charge"
  explanation: string; // what is wrong, in plain English
  ruleRef: string; // rule / policy reference
  source: string; // where numbers come from
  referenceKind?: ReferenceKind; // which Medicare table the price was compared with
  medicareRate?: number; // per-unit reference rate (PFS non-facility or OPPS facility)
  multiple?: number; // charge per unit / medicareRate
  duplicateOfLineId?: string;
};

export type LineCheckStatus =
  | { lineId: string; status: "reference"; kind: ReferenceKind; medicareRate: number; multiple: number }
  | { lineId: string; status: "no_reference" } // CPT not in our table
  | { lineId: string; status: "excluded"; reason: string } // in excluded list (ER visits, labs…)
  | { lineId: string; status: "no_cpt" };

export type CharityStatus = "likely" | "possibly" | "not_likely" | "not_checked";

export type CharityResult = {
  status: CharityStatus;
  fplPercent: number | null; // rounded to 1 decimal
  guideline: number | null; // HHS guideline for that household size/region
  householdSize: number | null;
  annualIncome: number | null;
  region: FplRegion;
};

export type AuditResult = {
  findings: Finding[];
  totalDisputable: number; // (A)+(B), no double counting
  billTotal: number; // sum of line charges
  lineStatus: LineCheckStatus[];
  charity: CharityResult;
};

/** The argument that won the dispute for a given line. */
export type WinningArgument = "duplicate" | "above_medicare" | "charity_care";

export type DisputeStatus =
  | "letter_sent"
  | "waiting"
  | "follow_up_due"
  | "escalation_due"
  | "resolved"
  | "escalated";

export type DisputeEvent = {
  at: string; // ISO datetime (virtual clock)
  type:
    | "letter_sent"
    | "follow_up_due"
    | "follow_up_sent"
    | "escalation_due"
    | "resolved"
    | "escalated"
    | "ppdr_filed"
    | "itemized_received"
    | "note";
  note?: string;
};

export type DisputeLine = {
  lineId: string;
  cpt: string | null;
  description: string;
  originalPrice: number;
  argument: WinningArgument; // pre-filled from the finding type, editable on resolve
  finalPrice?: number; // entered on resolve
};

export type Dispute = {
  id: string;
  provider: string;
  state: string | null;
  amountDisputed: number;
  billTotal: number;
  startedAt: string; // ISO (virtual clock)
  status: DisputeStatus;
  events: DisputeEvent[];
  lines: DisputeLine[];
  findings: Finding[];
  savedAmount?: number; // set on Resolved
  closedAt?: string;
  outcomeShared?: boolean; // true once written to the shared outcomes DB
  /** "itemized_request": only a summary bill — we asked the hospital for the itemized bill (14-day follow-up). */
  kind?: "dispute" | "itemized_request";
  /** Started during the Judge tour or from a sample bill: its outcome is saved as demo data, not as a real result. */
  demo?: boolean;
  /** Email reminders (address stays in this browser and Resend only; never in our database). */
  email?: EmailReminders;
  /** No Surprises Act: federal patient-provider dispute (PPDR) data, when the bill exceeds the GFE by $400+. */
  ppdr?: PpdrInfo;
};

export type PpdrInfo = {
  gfeAmount: number;
  billDate: string; // yyyy-mm-dd (initial bill)
  billed: number;
  difference: number;
  deadline: string; // yyyy-mm-dd = billDate + 120 days
};

/** One anonymous row in the shared outcomes DB (one per disputed line). */
export type OutcomeRecord = {
  id: string; // `${disputeId}:${lineId}` for idempotency
  hospitalKey: string; // normalized name (see lib/outcomes/normalize.ts)
  hospital: string; // display name
  state: string | null;
  cpt: string | null;
  originalPrice: number;
  finalPrice: number;
  argument: WinningArgument;
  status: "resolved" | "escalated";
  demo: boolean;
  createdAt: string;
};

export type CodeOutcomeStats = {
  hospitalKey: string;
  cpt: string;
  count: number; // number of disputes for this code at this hospital
  reducedCount: number; // how many of them got a lower final price
  medianReductionPct: number; // 0..100, median among lines that were lowered (0 if none)
  topArgument: WinningArgument | null;
  demoCount: number;
};

export type HospitalRanking = {
  hospitalKey: string;
  hospital: string;
  state: string | null;
  disputes: number; // distinct closed disputed lines
  concededPct: number; // share of lines with finalPrice < originalPrice, 0..100
  medianReductionPct: number; // median among lines that were lowered (0 if none)
  topArgument: WinningArgument | null;
  demoCount: number;
};

export type EmailReminders = {
  address: string;
  confirmedAt: string;
  followUp?: { id: string; at: string };
  escalation?: { id: string; at: string };
  lastSentNowAt?: string;
};
