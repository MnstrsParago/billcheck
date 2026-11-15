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
    <p className="mt-3 text-sm leading-relaxed text-emerald-800">
      <span aria-hidden className="mr-1.5">●</span>
      {people} at this hospital disputed this charge
      {s.reducedCount > 0 ? (
        <>
          {" "}
          · {s.reducedCount} got it lowered, usually by{" "}
          <strong className="font-semibold">{Math.round(s.medianReductionPct)}%</strong>
          {s.topArgument ? <> (most often for: {argumentLabel(s.topArgument)})</> : null}
        </>
      ) : (
        <> · no one got it lowered yet</>
      )}
      {s.demoCount > 0 ? (
        <span className="ml-1.5 text-slate-400" title={`${s.demoCount} of ${s.count} outcomes are demo data`}>
          (includes demo data)
        </span>
      ) : null}
    </p>
  );
}

export default FindingOutcomeStats;
