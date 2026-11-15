import { formatUSD } from "@/lib/audit";
import { competitorFees, sampleAuditSummary } from "@/lib/sampleStats";

const usd0 = (n: number) => formatUSD(Math.round(n)).replace(/\.00$/, "");

const STEPS = [
  {
    title: "Upload your bill",
    body: "A PDF or photos of your itemized statement — or paste the text. AI reads every line, you check it.",
  },
  {
    title: "We check every line",
    body: "Possible duplicates, prices more than 3× the 2026 Medicare reference, and whether you may qualify for charity care.",
  },
  {
    title: "Dispute and follow through",
    body: "A ready letter, 30/60-day follow-ups with calendar reminders, and what other patients won at the same hospital.",
  },
];

export function Landing({ onTour }: { onTour?: () => void }) {
  const { average, count } = sampleAuditSummary();
  const fees = competitorFees(average);
  const ours = 12 * 3; // $12/mo over a typical 3-month dispute

  return (
    <section className="space-y-6" aria-labelledby="landing-title">
      <div className="space-y-3">
        <h1 id="landing-title" className="text-2xl font-semibold tracking-tight sm:text-4xl">
          Hospital bills hide overcharges. Most people just pay them.
        </h1>
        <p className="max-w-2xl text-slate-600">
          BillCheck finds duplicate charges and prices far above Medicare in your itemized bill in about a minute — then
          walks you through the dispute until the bill is fixed.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            <strong className="text-lg font-semibold">{usd0(average)}</strong> found on average on our {count} sample
            bills
          </p>
          {onTour ? (
            <button
              type="button"
              onClick={onTour}
              className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
            >
              ▶ Judge tour (60 sec)
            </button>
          ) : null}
        </div>
      </div>

      <ol className="grid gap-3 sm:grid-cols-3">
        {STEPS.map((s, i) => (
          <li key={s.title} className="rounded-xl border border-slate-200 bg-white p-4">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-sm font-semibold text-white">
              {i + 1}
            </span>
            <h2 className="mt-2 font-semibold">{s.title}</h2>
            <p className="mt-1 text-sm text-slate-600">{s.body}</p>
          </li>
        ))}
      </ol>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="font-semibold">You keep the savings</h2>
          <p className="text-sm text-slate-600">
            What you would pay to dispute a bill with {usd0(average)} in savings (our sample average):
          </p>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Service</th>
              <th className="px-4 py-2 font-medium">Pricing</th>
              <th className="px-4 py-2 text-right font-medium">You pay</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <tr className="bg-emerald-50/60">
              <td className="px-4 py-2.5 font-semibold">BillCheck</td>
              <td className="px-4 py-2.5">$12/mo flat, cancel anytime</td>
              <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{usd0(ours)}*</td>
            </tr>
            <tr>
              <td className="px-4 py-2.5">Goodbill</td>
              <td className="px-4 py-2.5">20% of savings, max $1,000</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{usd0(fees.goodbill)}</td>
            </tr>
            <tr>
              <td className="px-4 py-2.5">Resolve</td>
              <td className="px-4 py-2.5">10–25% of savings</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{usd0(fees.resolve)}</td>
            </tr>
          </tbody>
        </table>
        <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
          *3 months of Pro for a typical 30–90 day dispute. Goodbill and Resolve negotiate on your behalf; BillCheck gives
          you the tools to do it yourself. Fees as published by each company (Nov 2026): Goodbill 20% of savings capped at
          $1,000; Resolve 25% of savings with a $1,000 minimum fee on bills under $15,000 (10% with a $2,500 minimum above).
        </p>
      </div>
    </section>
  );
}
