"use client";

import { resetClock, simulateDays, useClockOffset, useNow } from "@/lib/tracker/clock";
import { formatDate } from "@/lib/tracker/format";

export default function DemoClock() {
  const offset = useClockOffset();
  const now = useNow();
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-dashed border-slate-300 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-sm">
        <span className="mr-2 rounded bg-slate-900 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white">
          Demo clock
        </span>
        <span className="font-medium text-slate-900">{formatDate(now)}</span>
        {offset !== 0 && <span className="ml-1 text-slate-500">(+{offset} days simulated)</span>}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          data-tour="simulate"
          onClick={() => simulateDays(30)}
          className="flex-1 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 sm:flex-none"
        >
          Simulate +30 days
        </button>
        {offset !== 0 && (
          <button
            type="button"
            onClick={() => resetClock()}
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:flex-none"
          >
            Reset clock
          </button>
        )}
      </div>
    </div>
  );
}
