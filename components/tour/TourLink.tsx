"use client";

import { TOUR_START_EVENT } from "./JudgeTour";

/** Always-visible header link that starts the Judge tour from any page or step. */
export function TourLink() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(TOUR_START_EVENT))}
      className="whitespace-nowrap rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-slate-700 sm:px-3 sm:text-xs"
    >
      Judge? 60-sec tour
    </button>
  );
}
