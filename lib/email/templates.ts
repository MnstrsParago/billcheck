// Plain email templates (no LLM). Built on the server from the dispute summary the browser sends.
import type { Dispute } from "@/lib/types";
import { escalationLetter, followUpLetter, formatDate } from "@/lib/tracker/letters";
import { ESCALATION_DAY, FOLLOW_UP_DAY } from "./plan";

const DAY = 86_400_000;
const usd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const APP_URL = "https://billcheck-six.vercel.app/tracker";

function wrap(title: string, paragraphs: string[], pre?: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f8fafc;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a">
<div style="max-width:560px;margin:0 auto;padding:32px 20px">
<p style="font-weight:600;font-size:18px;margin:0 0 24px">Bill<span style="color:#059669">Check</span></p>
<h1 style="font-size:22px;margin:0 0 16px">${esc(title)}</h1>
${paragraphs.map((p) => `<p style="font-size:16px;line-height:1.5;margin:0 0 12px">${esc(p)}</p>`).join("\n")}
${pre ? `<pre style="white-space:pre-wrap;background:#fff;border-radius:12px;padding:16px;font-size:13px;line-height:1.5">${esc(pre)}</pre>` : ""}
<p style="margin:24px 0 0"><a href="${APP_URL}" style="background:#059669;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:600">Open my tracker</a></p>
<p style="font-size:12px;color:#94a3b8;margin:24px 0 0">You asked BillCheck to remind you about this bill. BillCheck is not legal or medical advice.</p>
</div></body></html>`;
}

export type Email = { subject: string; text: string; html: string };

export function confirmationEmail(d: Dispute, plan: { followUpAt: Date | null; escalationAt: Date | null }): Email {
  const fu = new Date(Date.parse(d.startedAt) + FOLLOW_UP_DAY * DAY);
  const esd = new Date(Date.parse(d.startedAt) + ESCALATION_DAY * DAY);
  const lines = [
    `You're disputing ${usd(d.amountDisputed)} on your ${usd(d.billTotal)} bill from ${d.provider}.`,
    `Day 30 — ${formatDate(fu)}: if the hospital hasn't answered, send the follow-up letter. ${plan.followUpAt ? "We'll email it to you that day." : "Open your tracker that day."}`,
    `Day 60 — ${formatDate(esd)}: if it's still not fixed, escalate. ${plan.escalationAt ? "We'll email you that day." : "We'll schedule this email when it's within 30 days (next time you open the tracker)."}`,
  ];
  return {
    subject: `Your dispute with ${d.provider}: reminders are on`,
    text: [...lines, "", APP_URL].join("\n"),
    html: wrap("Your reminders are on", lines),
  };
}

export function followUpEmail(d: Dispute, now: Date): Email {
  const letter = followUpLetter(d, now);
  const intro = [
    `It's been 30 days since you sent your dispute to ${d.provider}.`,
    "If you haven't received a written answer, send this follow-up letter today (copy it, add your details, send it by certified mail or the billing website):",
  ];
  return { subject: `Day 30: follow up with ${d.provider}`, text: [...intro, "", letter, "", APP_URL].join("\n"), html: wrap("Time to follow up", intro, letter) };
}

export function escalationEmail(d: Dispute, now: Date): Email {
  const letter = escalationLetter(d, now);
  const intro = [
    `It's been 60 days since you disputed your bill from ${d.provider}.`,
    "If it still isn't fixed, send this escalation letter and ask for a formal review:",
  ];
  return { subject: `Day 60: escalate your dispute with ${d.provider}`, text: [...intro, "", letter, "", APP_URL].join("\n"), html: wrap("Time to escalate", intro, letter) };
}
