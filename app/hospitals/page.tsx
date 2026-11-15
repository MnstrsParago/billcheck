import type { Metadata } from "next";
import Link from "next/link";
import type { HospitalRanking } from "@/lib/types";
import { MIN_RANKING_SAMPLE, rankHospitals, totals } from "@/lib/outcomes/aggregate";
import { getAllOutcomes, isOutcomesConfigured } from "@/lib/outcomes/store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Hospital ratings — BillCheck",
  description: "How often hospitals lower disputed charges, from anonymous BillCheck dispute outcomes.",
};

type Data = { rankings: HospitalRanking[]; totals: { records: number; demo: number; real: number } } | null;

async function load(): Promise<Data> {
  if (!isOutcomesConfigured()) return null;
  try {
    const records = await getAllOutcomes();
    return { rankings: rankHospitals(records), totals: totals(records) };
  } catch (err) {
    console.error("[hospitals] load failed", err);
    return null;
  }
}

const pct = (n: number) => `${Math.round(n)}%`;

export default async function HospitalsPage() {
  const data = await load();

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Hospital ratings</h1>
      </header>

      {!data ? (
        <div className="rounded-3xl bg-slate-50 p-6 text-slate-600">
          <p className="font-medium text-slate-900">Ratings are unavailable right now.</p>
          <Link href="/" className="mt-3 inline-block text-sm font-medium text-emerald-700 hover:text-emerald-800">
            Check a bill →
          </Link>
        </div>
      ) : data.rankings.length === 0 ? (
        <div className="rounded-3xl bg-slate-50 p-6 text-sm text-slate-600">No ratings yet.</div>
      ) : (
        <div>
          <table className="w-full table-fixed text-left text-sm">
            <thead className="text-[11px] text-slate-500 sm:text-xs">
              <tr>
                <th className="w-[40%] px-3 py-3 font-medium sm:px-5">Hospital</th>
                <th className="w-[10%] px-1 py-3 font-medium">State</th>
                <th className="w-[17%] px-1 py-3 text-right font-medium">Disputes</th>
                <th className="w-[16%] px-1 py-3 text-right font-medium">Lowered</th>
                <th className="w-[17%] px-3 py-3 text-right font-medium sm:px-5">Cut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.rankings.map((r) => (
                <tr key={r.hospitalKey}>
                  <td className="truncate px-3 py-3 font-medium text-slate-900 sm:px-5" title={r.hospital}>
                    {r.hospital}
                    {r.demoCount > 0 ? <span className="ml-1.5 text-xs font-normal text-slate-400">demo</span> : null}
                  </td>
                  <td className="px-1 py-3 text-slate-600">{r.state ?? "—"}</td>
                  <td className="px-1 py-3 text-right tabular-nums text-slate-600">{r.disputes}</td>
                  <td className="px-1 py-3 text-right font-semibold tabular-nums text-emerald-700">{pct(r.concededPct)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-900 sm:px-5">{pct(r.medianReductionPct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <details className="text-sm text-slate-500">
        <summary className="cursor-pointer select-none list-none text-slate-400 underline underline-offset-4">How we count</summary>
        <ul className="mt-3 space-y-1">
          <li>Anonymous closed disputes. Lowered: share with a lower price. Cut: median cut.</li>
          {data ? (
            <li>
              {data.totals.real} real, {data.totals.demo} demo results.
            </li>
          ) : null}
        </ul>
      </details>
    </div>
  );
}
