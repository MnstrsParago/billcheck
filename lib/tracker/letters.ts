// Template letters (no LLM). Pure.

import type { Dispute, DisputeLine } from "@/lib/types";

const ARG_TEXT: Record<DisputeLine["argument"], string> = {
  duplicate: "appears to be billed more than once",
  above_medicare: "is priced far above the Medicare reference rate",
  charity_care: "should be covered under your financial assistance (charity care) policy",
};

export function formatDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

const usd = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function lineList(d: Dispute): string {
  if (d.lines.length === 0) return "- (see my original letter)";
  return d.lines
    .map((l) => `- CPT ${l.cpt ?? "n/a"}, ${l.description}: billed ${usd(l.originalPrice)}; this charge ${ARG_TEXT[l.argument]}.`)
    .join("\n");
}

function followUpSentDate(d: Dispute): string | null {
  const e = d.events.find((x) => x.type === "follow_up_sent");
  return e ? formatDate(e.at) : null;
}

export function followUpLetter(d: Dispute, now: Date): string {
  const sent = formatDate(d.startedAt);
  return `${formatDate(now)}

To: Billing Department, ${d.provider}
Re: Follow-up on my billing dispute sent ${sent}

Dear Billing Department,

On ${sent} I sent you a written dispute of my bill (total billed: ${usd(d.billTotal)}). I have not yet received a written response. I am following up on the following charges, totaling ${usd(d.amountDisputed)} in dispute:

${lineList(d)}

Please send me, in writing within 30 days:
1. A corrected itemized bill, or a written explanation of why each charge above is correct.
2. Confirmation that this account is on hold and will not be sent to collections while the dispute is open.

I am also asking you to review my eligibility for financial assistance under your charity care policy, if it applies.

Thank you for your prompt attention.

Sincerely,
[Your name]
[Account / patient number]
[Phone or email]`;
}

export function escalationLetter(d: Dispute, now: Date): string {
  const sent = formatDate(d.startedAt);
  const fu = followUpSentDate(d);
  const history = fu
    ? `I sent a written dispute on ${sent} and a follow-up on ${fu}.`
    : `I sent a written dispute on ${sent}.`;
  const state = d.state ? ` (${d.state})` : "";
  return `${formatDate(now)}

To: Patient Financial Services / Compliance Office, ${d.provider}
Re: Request for formal itemized review of disputed charges — dispute opened ${sent}

Dear Compliance Office,

${history} I have not received a satisfactory written response. I am requesting a formal itemized review of the following charges, totaling ${usd(d.amountDisputed)}:

${lineList(d)}

Please provide, within 30 days:
1. A formal itemized review with the medical record documentation supporting each charge above.
2. The name of the person handling my case and a written decision.
3. Confirmation that the account is on hold and not reported to collections or credit bureaus during this review.

If this is not resolved, I intend to file a consumer complaint with my state attorney general's consumer protection office${state} and with my state department of insurance or department of health consumer line, and to include copies of this correspondence.

Sincerely,
[Your name]
[Account / patient number]
[Phone or email]`;
}
