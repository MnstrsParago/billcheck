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

  const lowered = Math.round((s.reducedCount / s.count) * 100);
  return (
    <p
      className="text-sm text-slate-400"
      title={`${s.reducedCount} of ${s.count} got it lowered, median cut ${Math.round(s.medianReductionPct)}%${
        s.topArgument ? `, most often for: ${argumentLabel(s.topArgument)}` : ""
      }${s.demoCount > 0 ? `. Includes ${s.demoCount} demo results.` : ""}`}
    >
      {s.count} disputed here · {lowered}% lowered{s.demoCount > 0 ? " · demo" : ""}
    </p>
  );
}

export default FindingOutcomeStats;
