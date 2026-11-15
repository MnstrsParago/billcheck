"use client";

import { TOUR_START_EVENT } from "./JudgeTour";

/** Always-visible header link that starts the Judge tour from any page or step. */
export function TourLink() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(TOUR_START_EVENT))}
      className="whitespace-nowrap text-sm text-slate-500 underline underline-offset-4 hover:text-slate-900"
    >
      Judge? 60-sec tour
    </button>
  );
}
