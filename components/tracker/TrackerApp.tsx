"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
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

function useJustStarted(): boolean {
  const [v, setV] = useState(false);
  useEffect(() => {
    let flag = false;
    try {
      flag = sessionStorage.getItem("bc.justStarted") === "1";
      sessionStorage.removeItem("bc.justStarted");
    } catch {
      /* storage blocked */
    }
    setV(flag || new URLSearchParams(window.location.search).has("started"));
  }, []);
  return v;
}

export default function TrackerApp() {
  const started = useJustStarted();
  const hydrated = useHydrated();
  const pro = usePro();
  const disputes = useDisputes();
  const now = useNow();

  if (!hydrated) return <div className="h-40 animate-pulse rounded-xl bg-slate-100" aria-hidden />;

  if (!pro) {
    return (
      <div className="text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-slate-900">My disputes</h1>
        <p className="mt-2 text-slate-500">Part of Pro.</p>
        <Link
          href="/"
          className="mt-4 inline-block text-slate-900 underline underline-offset-4"
        >
          Upgrade to Pro
        </Link>
      </div>
    );
  }

  const open = disputes.filter((d) => d.status !== "resolved" && d.status !== "escalated").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">My disputes</h1>
        <p className="mt-2 text-base text-slate-500">We remind you when the hospital is late.</p>
        {disputes.length > 0 ? (
          <p className="mt-1 text-sm text-slate-400">
            {open} open · saved {usd(savedSoFar(disputes))}
          </p>
        ) : null}
      </div>

      {started && open > 0 ? (
        <p role="status" className="text-base font-medium text-slate-900">
          Dispute started. We&apos;ll tell you when to follow up.
        </p>
      ) : null}

      {disputes.length === 0 ? (
        <p className="text-slate-500">
          No disputes yet.{" "}
          <Link href="/" className="text-slate-900 underline underline-offset-4">
            Check a bill
          </Link>
        </p>
      ) : (
        <div>
          {disputes.map((d) => (
            <DisputeCard key={d.id} dispute={d} now={now} />
          ))}
        </div>
      )}
      <details>
        <summary className="cursor-pointer select-none list-none text-sm text-slate-400 underline underline-offset-4">
          Demo clock
        </summary>
        <div className="mt-4">
          <DemoClock />
        </div>
      </details>
    </div>
  );
}
