import type { Metadata } from "next";
import Link from "next/link";
import type { HospitalRanking } from "@/lib/types";
import { MIN_RANKING_SAMPLE, rankHospitals, totals } from "@/lib/outcomes/aggregate";
import { argumentLabel } from "@/lib/outcomes/labels";
import { getAllOutcomes, isOutcomesConfigured } from "@/lib/outcomes/store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Hospital leaderboard — BillCheck",
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

function DemoBadge({ r }: { r: HospitalRanking }) {
  if (r.demoCount === 0) return null;
  const all = r.demoCount === r.disputes;
  return (
    <span
      className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-amber-800"
      title={`${r.demoCount} of ${r.disputes} outcomes are demo data`}
    >
      {all ? "demo" : "incl. demo"}
    </span>
  );
}

function Bar({ pct }: { pct: number }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-slate-100" aria-hidden>
      <div className="h-1.5 rounded-full bg-emerald-500" style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  );
}

const pct = (n: number) => `${Math.round(n)}%`;

export default async function HospitalsPage() {
  const data = await load();

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Hospital leaderboard</h1>
        <p className="text-slate-600">How often hospitals lower disputed charges, based on anonymous outcomes shared by BillCheck users.</p>
      </header>

      {!data ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-slate-600">
          <p className="font-medium text-slate-900">Leaderboard is unavailable right now.</p>
          <p className="mt-1 text-sm">The shared outcomes database is not reachable. You can still check your bill and track your dispute.</p>
          <Link href="/" className="mt-4 inline-block text-sm font-medium text-emerald-700 hover:text-emerald-800">
            Check a bill →
          </Link>
        </div>
      ) : (
        <>
          <p className="text-sm text-slate-600">
            <strong className="font-semibold text-slate-900">{data.totals.records}</strong> outcomes ({data.totals.real} real,{" "}
            {data.totals.demo} demo)
          </p>

          {data.rankings.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
              No hospital has {MIN_RANKING_SAMPLE}+ closed disputed lines yet.
            </div>
          ) : (
            <>
              {/* Mobile: cards */}
              <ol className="space-y-3 md:hidden">
                {data.rankings.map((r, i) => (
                  <li key={r.hospitalKey} className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-900">
                          <span className="mr-1 text-slate-400">{i + 1}.</span>
                          {r.hospital}
                        </p>
                        <p className="text-xs text-slate-500">
                          {r.state ?? "—"} · {r.disputes} disputed lines
                        </p>
                      </div>
                      <DemoBadge r={r} />
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <dt className="text-xs text-slate-500">Conceded</dt>
                        <dd className="font-semibold text-emerald-700">{pct(r.concededPct)}</dd>
                        <Bar pct={r.concededPct} />
                      </div>
                      <div>
                        <dt className="text-xs text-slate-500">Median reduction</dt>
                        <dd className="font-semibold text-slate-900">{pct(r.medianReductionPct)}</dd>
                      </div>
                      <div className="col-span-2">
                        <dt className="text-xs text-slate-500">Top winning argument</dt>
                        <dd className="text-slate-800">{argumentLabel(r.topArgument)}</dd>
                      </div>
                    </dl>
                  </li>
                ))}
              </ol>

              {/* Desktop: table */}
              <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white md:block">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">#</th>
                      <th className="px-4 py-3 font-medium">Hospital</th>
                      <th className="px-4 py-3 font-medium">State</th>
                      <th className="px-4 py-3 text-right font-medium">Disputes</th>
                      <th className="px-4 py-3 font-medium">Conceded</th>
                      <th className="px-4 py-3 text-right font-medium">Median reduction</th>
                      <th className="px-4 py-3 font-medium">Top winning argument</th>
                      <th className="px-4 py-3 font-medium">
                        <span className="sr-only">Data</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.rankings.map((r, i) => (
                      <tr key={r.hospitalKey}>
                        <td className="px-4 py-3 text-slate-400">{i + 1}</td>
                        <td className="px-4 py-3 font-medium text-slate-900">{r.hospital}</td>
                        <td className="px-4 py-3 text-slate-600">{r.state ?? "—"}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{r.disputes}</td>
                        <td className="w-40 px-4 py-3">
                          <span className="font-semibold tabular-nums text-emerald-700">{pct(r.concededPct)}</span>
                          <Bar pct={r.concededPct} />
                        </td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums">{pct(r.medianReductionPct)}</td>
                        <td className="px-4 py-3 text-slate-700">{argumentLabel(r.topArgument)}</td>
                        <td className="px-4 py-3">
                          <DemoBadge r={r} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 sm:p-6">
        <h2 className="font-semibold text-slate-900">Methodology</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            When a dispute in the BillCheck tracker is closed (resolved or escalated), one anonymous row is saved per disputed
            line: hospital, state, CPT code, original price, final price and the argument that won. No names, dates of
            service or free text are stored.
          </li>
          <li>
            <strong>Conceded</strong> = share of disputed lines where the final price was lower than the original.{" "}
            <strong>Median reduction</strong> = median of (original − final) / original across all lines, escalated lines
            counting as 0%.
          </li>
          <li>Hospitals with fewer than {MIN_RANKING_SAMPLE} closed lines are not ranked. Ordering: conceded %, then median reduction.</li>
          <li>
            Rows marked <em>demo</em> are a synthetic sample for fictional hospitals, shown so the leaderboard is not empty.
            They are not real outcomes.
          </li>
        </ul>
      </section>
    </div>
  );
}
