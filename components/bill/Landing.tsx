import { formatUSD } from "@/lib/audit";
import { competitorFees, sampleAuditSummary } from "@/lib/sampleStats";

const usd0 = (n: number) => formatUSD(Math.round(n)).replace(/\.00$/, "");

const STEPS = [
  { title: "Upload your bill", body: "PDF or photo." },
  { title: "We check every charge", body: "Billed twice? Far above Medicare?" },
  { title: "Get it fixed", body: "Letter and reminders." },
];

/** Everything below the first screen: how it works, proof, price, the judge tour. */
export function Landing({ onTour, onSampleB }: { onTour?: () => void; onSampleB?: () => void }) {
  const { average, count } = sampleAuditSummary();
  const fees = competitorFees(average);
  const ours = 12 * 3; // $12/mo over a typical 3-month dispute

  return (
    <div className="mx-auto max-w-3xl space-y-24 sm:space-y-32">
      <section aria-labelledby="how-title" className="space-y-10">
        <h2 id="how-title" className="text-center text-3xl font-semibold tracking-tight sm:text-4xl">
          How it works
        </h2>
        <ol className="grid gap-10 sm:grid-cols-3 sm:gap-8">
          {STEPS.map((s, i) => (
            <li key={s.title} className="space-y-2 text-center">
              <span className="text-4xl font-semibold text-emerald-600">{i + 1}</span>
              <h3 className="text-lg font-semibold text-slate-900">{s.title}</h3>
              <p className="text-slate-500">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-3 text-center">
        <p className="text-6xl font-semibold tracking-tight text-emerald-600 sm:text-7xl">{usd0(average)}</p>
        <p className="text-lg text-slate-600">found on average on our {count} sample bills</p>
        {onSampleB ? (
          <button
            type="button"
            className="text-sm text-slate-500 underline-offset-4 hover:text-slate-900 hover:underline"
            onClick={onSampleB}
          >
            Try the second sample
          </button>
        ) : null}
      </section>

      <section aria-labelledby="price-title" className="space-y-8">
        <div className="space-y-2 text-center">
          <h2 id="price-title" className="text-3xl font-semibold tracking-tight sm:text-4xl">
            You keep what you save
          </h2>
          <p className="text-slate-500">Cost to dispute {usd0(average)}:</p>
        </div>
        <dl className="mx-auto max-w-xl divide-y divide-slate-100">
          <div className="flex items-baseline justify-between gap-4 py-4">
            <dt>
              <span className="font-semibold text-slate-900">BillCheck</span>
              <span className="block text-sm text-slate-500">$12 a month, cancel anytime</span>
            </dt>
            <dd className="text-2xl font-semibold text-emerald-600">{usd0(ours)}*</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 py-4">
            <dt>
              <span className="font-medium text-slate-900">Goodbill</span>
              <span className="block text-sm text-slate-500">20% of what you save, max $1,000</span>
            </dt>
            <dd className="text-2xl font-semibold text-slate-400">{usd0(fees.goodbill)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 py-4">
            <dt>
              <span className="font-medium text-slate-900">Resolve</span>
              <span className="block text-sm text-slate-500">10–25% of what you save</span>
            </dt>
            <dd className="text-2xl font-semibold text-slate-400">{usd0(fees.resolve)}</dd>
          </div>
        </dl>
        <p className="mx-auto max-w-xl text-center text-xs text-slate-400">
          *3 months. Competitor fees as published, Nov 2026.
        </p>
      </section>

      {onTour ? (
        <section className="space-y-4 rounded-3xl bg-slate-900 px-6 py-12 text-center text-white">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">New here? See it all in 60 seconds.</h2>
          <button
            type="button"
            onClick={onTour}
            className="rounded-full bg-white px-7 py-3.5 font-semibold text-slate-900 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            ▶ Judge tour (60 sec)
          </button>
        </section>
      ) : null}
    </div>
  );
}
