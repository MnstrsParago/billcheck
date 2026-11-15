"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { usePro } from "@/lib/pro";
import { useNow } from "@/lib/tracker/clock";
import { usd } from "@/lib/tracker/format";
import { savedSoFar, useDisputes } from "@/lib/tracker/store";
import DemoClock from "./DemoClock";
import DisputeCard from "./DisputeCard";

const noop = () => () => {};
/** false during SSR and hydration, true after — avoids flashing the Pro gate. */
function useHydrated(): boolean {
  return useSyncExternalStore(noop, () => true, () => false);
}

export default function TrackerApp() {
  const hydrated = useHydrated();
  const pro = usePro();
  const disputes = useDisputes();
  const now = useNow();

  if (!hydrated) return <div className="h-40 animate-pulse rounded-xl bg-slate-100" aria-hidden />;

  if (!pro) {
    return (
      <div className="mx-auto max-w-md rounded-3xl bg-slate-50 p-8 text-center">
        <h1 className="text-lg font-semibold text-slate-900">The dispute tracker is a Pro feature</h1>
        <p className="mt-2 text-sm text-slate-600">
          Pro tracks every dispute, reminds you at day 30 and day 60, and writes the follow-up and escalation letters.
        </p>
        <Link
          href="/"
          className="mt-4 inline-block rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          Upgrade to Pro
        </Link>
      </div>
    );
  }

  const open = disputes.filter((d) => d.status !== "resolved" && d.status !== "escalated").length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Your disputes</h1>
          <p className="text-sm text-slate-600">
            {disputes.length === 0
              ? "No disputes yet."
              : `${open} open · ${disputes.length - open} closed`}
          </p>
        </div>
        {disputes.length > 0 && (
          <p className="text-sm text-slate-700">
            Saved so far: <span className="font-semibold text-emerald-700">{usd(savedSoFar(disputes))}</span>
          </p>
        )}
      </div>


      {disputes.length === 0 ? (
        <div className="rounded-3xl bg-slate-50 p-8 text-center text-slate-600">
          Check a bill and send the dispute letter — it will show up here with reminders at day 30 and day 60.
          <div className="mt-3">
            <Link href="/" className="font-medium text-emerald-700 hover:underline">
              Check a bill →
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {disputes.map((d) => (
            <DisputeCard key={d.id} dispute={d} now={now} />
          ))}
        </div>
      )}
      <details className="rounded-3xl bg-slate-50 p-5">
        <summary className="cursor-pointer select-none text-sm font-medium text-slate-600">
          Demo clock (for judges): skip ahead to see reminders
        </summary>
        <div className="mt-4">
          <DemoClock />
        </div>
      </details>
    </div>
  );
}
