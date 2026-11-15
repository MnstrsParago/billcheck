import { MEDICARE_DISCLAIMER, MEDICARE_MULTIPLIER, OPPS_DISCLAIMER, OPPS_MULTIPLIER } from "@/lib/audit/medicare";
import type { BillLine, LineCheckStatus } from "@/lib/types";
import { Card } from "@/components/ui/Card";

function friendlyReason(reason: string): string {
  const r = reason.toLowerCase();
  if (r.includes("status x") || r.includes("lab")) return "lab tests (priced on the Clinical Lab Fee Schedule, not covered yet)";
  if (r.includes("not applicable") || r.includes("(na)")) return "facility-only services with no separate Medicare outpatient rate";
  return reason;
}

/** Honest per-line coverage: how many lines we could actually compare to a reference price. */
export function CoverageNote({ lineStatus, lines }: { lineStatus: LineCheckStatus[]; lines: BillLine[] }) {
  const byId = new Map(lines.map((l) => [l.id, l]));
  const pfs = lineStatus.filter((s) => s.status === "reference" && s.kind === "pfs").length;
  const opps = lineStatus.filter((s) => s.status === "reference" && s.kind === "opps").length;
  const noRef = lineStatus.filter((s) => s.status === "no_reference");
  const noCpt = lineStatus.filter((s) => s.status === "no_cpt").length;

  const excludedGroups = new Map<string, string[]>();
  for (const s of lineStatus) {
    if (s.status !== "excluded") continue;
    const key = friendlyReason(s.reason);
    const cpt = byId.get(s.lineId)?.cpt ?? "";
    excludedGroups.set(key, [...(excludedGroups.get(key) ?? []), cpt]);
  }
  const notCovered = noRef.length + [...excludedGroups.values()].reduce((n, a) => n + a.length, 0);
  const codes = (arr: string[]) => [...new Set(arr.filter(Boolean))].join(", ");
  const n = lineStatus.length;

  return (
    <Card className="space-y-3">
      <h2 className="text-base font-semibold">What we could check</h2>
      <ul className="space-y-1.5 text-sm text-slate-700">
        <li className="flex gap-2">
          <span aria-hidden className="text-emerald-600">●</span>
          <span>
            <strong className="tabular-nums">{pfs + opps}</strong> of {n} line{n === 1 ? "" : "s"} compared with a 2026
            Medicare reference price
            {opps > 0 ? (
              <>
                {" "}
                ({pfs} with the physician fee schedule, {opps} with the hospital outpatient rate)
              </>
            ) : null}
            .
          </span>
        </li>
        <li className="flex gap-2">
          <span aria-hidden className="text-emerald-600">●</span>
          <span>All {n} lines checked for possible duplicates.</span>
        </li>
        {notCovered > 0 && (
          <li className="flex gap-2">
            <span aria-hidden className="text-amber-500">●</span>
            <span>
              <strong className="tabular-nums">{notCovered}</strong> line{notCovered === 1 ? " has" : "s have"} no
              reference price
              {excludedGroups.size > 0 && (
                <>
                  :{" "}
                  {[...excludedGroups.entries()].map(([label, cpts], i) => (
                    <span key={label}>
                      {i > 0 ? "; " : ""}
                      {label}
                      {codes(cpts) ? ` — ${codes(cpts)}` : ""}
                    </span>
                  ))}
                </>
              )}
              {noRef.length > 0 && (
                <>
                  {excludedGroups.size > 0 ? "; " : ": "}
                  {noRef.length} code{noRef.length === 1 ? " is" : "s are"} not priced in the 2026 Medicare tables
                  {codes(noRef.map((s) => byId.get(s.lineId)?.cpt ?? "")) &&
                    ` — ${codes(noRef.map((s) => byId.get(s.lineId)?.cpt ?? ""))}`}
                </>
              )}
              .
            </span>
          </li>
        )}
        {noCpt > 0 && (
          <li className="flex gap-2">
            <span aria-hidden className="text-slate-400">●</span>
            <span>
              <strong className="tabular-nums">{noCpt}</strong> line{noCpt === 1 ? " has" : "s have"} no CPT code, so only
              the duplicate check applies.
            </span>
          </li>
        )}
      </ul>
      <div className="space-y-1 text-xs text-slate-500">
        <p>
          <strong className="font-medium">Physician fees:</strong> {MEDICARE_DISCLAIMER} A line is flagged when its price
          per unit is more than {MEDICARE_MULTIPLIER}× that reference. Source: CMS PFS RVU26D (CY2026).
        </p>
        {opps > 0 ? (
          <p>
            <strong className="font-medium">Hospital facility fees</strong> (used when a code has no physician non-facility
            rate, e.g. ER visits 99281–99285): {OPPS_DISCLAIMER} A line is flagged when its price per unit is more than{" "}
            {OPPS_MULTIPLIER}× that rate. Source: CMS OPPS Addendum B, October 2026.
          </p>
        ) : null}
      </div>
    </Card>
  );
}
