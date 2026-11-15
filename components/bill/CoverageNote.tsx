import { MEDICARE_DISCLAIMER, MEDICARE_MULTIPLIER, OPPS_DISCLAIMER, OPPS_MULTIPLIER } from "@/lib/audit/medicare";
import type { BillLine, LineCheckStatus } from "@/lib/types";

function friendlyReason(reason: string): string {
  const r = reason.toLowerCase();
  if (r.includes("status x") || r.includes("lab")) return "lab tests (we can't check lab prices yet)";
  if (r.includes("not applicable") || r.includes("(na)")) return "hospital-only services with no separate Medicare price";
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

  const checkedPrices = pfs + opps;
  return (
    <details className="group rounded-3xl bg-slate-50 px-5 py-4 sm:px-7 sm:py-5">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-base font-semibold text-slate-900 [&::-webkit-details-marker]:hidden">
        What we checked
        <span aria-hidden className="text-slate-400 transition-transform group-open:rotate-45">
          +
        </span>
      </summary>
      <div className="mt-4 space-y-4">
        <ul className="space-y-2 text-base text-slate-600">
          <li>
            We compared <strong className="font-semibold text-slate-900 tabular-nums">{checkedPrices}</strong> of {n}{" "}
            charge{n === 1 ? "" : "s"} with what Medicare pays in 2026
            {opps > 0 ? (
              <>
                {" "}
                ({pfs} with the doctor price list, {opps} with the hospital price list)
              </>
            ) : null}
            .
          </li>
          <li>We looked at all {n} charges for anything billed twice.</li>
          {notCovered > 0 && (
            <li>
              <strong className="font-semibold text-slate-900 tabular-nums">{notCovered}</strong> charge
              {notCovered === 1 ? " has" : "s have"} no Medicare price we could compare
              {excludedGroups.size > 0 && (
                <>
                  :{" "}
                  {[...excludedGroups.entries()].map(([label, cpts], i) => (
                    <span key={label}>
                      {i > 0 ? "; " : ""}
                      {label}
                      {codes(cpts) ? ` — code ${codes(cpts)}` : ""}
                    </span>
                  ))}
                </>
              )}
              {noRef.length > 0 && (
                <>
                  {excludedGroups.size > 0 ? "; " : ": "}
                  {noRef.length} code{noRef.length === 1 ? " is" : "s are"} not in the 2026 Medicare price list
                  {codes(noRef.map((s) => byId.get(s.lineId)?.cpt ?? "")) &&
                    ` — ${codes(noRef.map((s) => byId.get(s.lineId)?.cpt ?? ""))}`}
                </>
              )}
              .
            </li>
          )}
          {noCpt > 0 && (
            <li>
              <strong className="font-semibold text-slate-900 tabular-nums">{noCpt}</strong> charge
              {noCpt === 1 ? " has" : "s have"} no code, so we could only check it for being billed twice.
            </li>
          )}
          <li>
            We flag a doctor charge when it is more than {MEDICARE_MULTIPLIER} times the Medicare price
            {opps > 0 ? <>, and a hospital fee when it is more than {OPPS_MULTIPLIER} times</> : null}.
          </li>
        </ul>
        <div className="space-y-2 text-xs leading-relaxed text-slate-400">
          <p>
            {MEDICARE_DISCLAIMER} Source: CMS PFS RVU26D (CY2026).
          </p>
          <p>
            {OPPS_DISCLAIMER} Source: CMS OPPS Addendum B, October 2026.
          </p>
        </div>
      </div>
    </details>
  );
}
