import { MEDICARE_DISCLAIMER } from "@/lib/audit/medicare";
import type { BillLine, LineCheckStatus } from "@/lib/types";
import { Card } from "@/components/ui/Card";

function friendlyReason(reason: string): string {
  const r = reason.toLowerCase();
  if (r.includes("status x") || r.includes("lab")) return "lab tests (priced on the Clinical Lab Fee Schedule, not covered yet)";
  if (r.includes("not applicable") || r.includes("(na)") || r.includes("facility")) return "ER visits and facility-only services (no Medicare non-facility price)";
  return reason;
}

/** Honest per-line coverage: how many lines we could actually compare to a reference price. */
export function CoverageNote({ lineStatus, lines }: { lineStatus: LineCheckStatus[]; lines: BillLine[] }) {
  const byId = new Map(lines.map((l) => [l.id, l]));
  const reference = lineStatus.filter((s) => s.status === "reference").length;
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

  return (
    <Card className="space-y-3">
      <h2 className="text-base font-semibold">What we could check</h2>
      <ul className="space-y-1.5 text-sm text-slate-700">
        <li className="flex gap-2">
          <span aria-hidden className="text-emerald-600">●</span>
          <span>
            <strong className="tabular-nums">{reference}</strong> of {lineStatus.length} line
            {lineStatus.length === 1 ? "" : "s"} compared with the 2026 Medicare reference price.
          </span>
        </li>
        <li className="flex gap-2">
          <span aria-hidden className="text-emerald-600">●</span>
          <span>All {lineStatus.length} lines checked for possible duplicates.</span>
        </li>
        {notCovered > 0 && (
          <li className="flex gap-2">
            <span aria-hidden className="text-amber-500">●</span>
            <span>
              <strong className="tabular-nums">{notCovered}</strong> line{notCovered === 1 ? " has" : "s have"} no
              reference price yet
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
                  {noRef.length} code{noRef.length === 1 ? "" : "s"} not in our 48-code table yet
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
      <p className="text-xs text-slate-500">
        {MEDICARE_DISCLAIMER} A line is flagged only when its price per unit is more than 3× that reference.
      </p>
    </Card>
  );
}
