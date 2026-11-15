"use client";

import Link from "next/link";
import { useNow } from "@/lib/tracker/clock";
import { formatDate, usd } from "@/lib/tracker/format";
import { nextAction } from "@/lib/tracker/status";
import { savedSoFar, useDisputes } from "@/lib/tracker/store";

/** Home-page banner: nearest dispute step + "Saved so far". Renders nothing without disputes. */
export default NextActionBanner;
export function NextActionBanner() {
  const disputes = useDisputes();
  const now = useNow();
  if (disputes.length === 0) return null;

  const action = nextAction(disputes, now);
  const saved = savedSoFar(disputes);
  const overdue = action ? action.dueDate.getTime() <= now.getTime() : false;

  return (
    <Link
      href="/tracker"
      className="block rounded-2xl bg-emerald-50 px-5 py-4 transition hover:bg-emerald-100/70"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          {action ? (
            <p className="text-sm text-slate-800">
              <span className="font-semibold">Next action:</span> {action.label}{" "}
              <span className={overdue ? "font-medium text-amber-700" : "text-slate-600"}>
                {overdue ? `(due since ${formatDate(action.dueDate)})` : `by ${formatDate(action.dueDate)}`}
              </span>
            </p>
          ) : (
            <p className="text-sm text-slate-800">
              <span className="font-semibold">All disputes closed.</span> Nice work.
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-3 text-sm">
          <span className="text-slate-700">
            Saved so far: <span className="font-semibold text-emerald-700">{usd(saved)}</span>
          </span>
          <span className="font-medium text-emerald-700">My disputes →</span>
        </div>
      </div>
    </Link>
  );
}
