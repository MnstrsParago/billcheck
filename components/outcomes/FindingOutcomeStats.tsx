"use client";

import { useEffect, useMemo, useState } from "react";
import type { CodeOutcomeStats } from "@/lib/types";
import { fetchCodeStats } from "@/lib/outcomes/client";
import { argumentLabel } from "@/lib/outcomes/labels";

/**
 * Fetch shared-outcome stats once for all codes of a bill.
 * Returns Map<cpt, CodeOutcomeStats>, or null while loading / on failure / when the DB is not configured.
 */
export function useCodeStats(hospital: string | null | undefined, cpts: (string | null | undefined)[]): Map<string, CodeOutcomeStats> | null {
  const cptKey = useMemo(
    () =>
      [...new Set(cpts.filter((c): c is string => !!c).map((c) => c.trim().toUpperCase()))]
        .sort()
        .join(","),
    [cpts],
  );
  const h = hospital?.trim() ?? "";
  const requestKey = h && cptKey ? `${h}\u0000${cptKey}` : null;
  const [result, setResult] = useState<{ key: string; map: Map<string, CodeOutcomeStats> | null } | null>(null);

  useEffect(() => {
    if (!requestKey) return;
    let cancelled = false;
    fetchCodeStats(h, cptKey.split(",")).then((stats) => {
      if (cancelled) return;
      setResult({ key: requestKey, map: stats ? new Map(stats.map((s) => [s.cpt, s])) : null });
    });
    return () => {
      cancelled = true;
    };
  }, [requestKey, h, cptKey]);

  return result && result.key === requestKey ? result.map : null;
}

type Props = {
  hospital: string | null;
  cpt: string | null;
  /** Pass from useCodeStats(...).get(cpt). If omitted, the component fetches on its own. */
  stats?: CodeOutcomeStats;
};

export function FindingOutcomeStats({ hospital, cpt, stats }: Props) {
  const fetched = useCodeStats(stats ? null : hospital, stats ? [] : [cpt]);
  const s = stats ?? (cpt ? fetched?.get(cpt.trim().toUpperCase()) : undefined);
  if (!s || s.count <= 0) return null;

  const people = s.count === 1 ? "1 person" : `${s.count} people`;
  return (
    <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
      <span>
        At this hospital, {people} disputed this code, median reduction{" "}
        <strong className="font-semibold">{Math.round(s.medianReductionPct)}%</strong>
        {s.topArgument ? <>, winning argument: {argumentLabel(s.topArgument)}</> : null}.
      </span>
      {s.demoCount > 0 ? (
        <span
          className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-amber-800"
          title={`${s.demoCount} of ${s.count} outcomes are demo data`}
        >
          includes demo data
        </span>
      ) : null}
    </p>
  );
}

export default FindingOutcomeStats;
