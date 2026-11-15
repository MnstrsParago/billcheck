"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatUSD } from "@/lib/audit";
import { buildCharityLetter, buildDisputeLetter, buildPpdrRequest, canBuildCharityLetter, letterFilename } from "@/lib/letters";
import { checkGfe, GFE_LABEL, type GfeInput } from "@/lib/audit/gfe";
import { useNow } from "@/lib/tracker/clock";
import { setPro, usePro } from "@/lib/pro";
import { createDispute } from "@/lib/tracker/store";
import type { AuditResult, BillLine, HouseholdInput } from "@/lib/types";
import { useCodeStats } from "@/components/outcomes/FindingOutcomeStats";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ProBadge } from "@/components/ui/ProBadge";
import { CharityCard, CHARITY_LABEL } from "./CharityCard";
import { CoverageNote } from "./CoverageNote";
import { FindingItem } from "./FindingItem";
import { GfeCard } from "./GfeCard";
import { LetterBox } from "./LetterBox";
import { Paywall, PAYWALL_ID } from "./Paywall";

function scrollToPaywall() {
  const el = document.getElementById(PAYWALL_ID);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.focus({ preventScroll: true });
}

export function ResultStep({
  result,
  lines,
  provider,
  hospitalState,
  household,
  onHousehold,
  gfeInput,
  onGfe,
  onEditLines,
  onNewBill,
}: {
  gfeInput: GfeInput;
  onGfe: (g: GfeInput) => void;
  result: AuditResult;
  lines: BillLine[];
  provider: string;
  hospitalState: string;
  household: HouseholdInput;
  onHousehold: (h: HouseholdInput) => void;
  onEditLines: () => void;
  onNewBill: () => void;
}) {
  const pro = usePro();
  const router = useRouter();
  const [startError, setStartError] = useState<string | null>(null);
  const { findings, totalDisputable, billTotal, charity, lineStatus } = result;
  const now = useNow();
  const gfe = useMemo(() => checkGfe(gfeInput, billTotal, now), [gfeInput, billTotal, now]);
  const ppdr =
    gfe.status === "eligible" && gfe.deadline && gfe.gfeAmount !== null && gfeInput.billDate
      ? { gfeAmount: gfe.gfeAmount, billDate: gfeInput.billDate, billed: gfe.billed, difference: gfe.difference ?? 0, deadline: gfe.deadline }
      : null;
  const ppdrText = useMemo(
    () => (pro && ppdr ? buildPpdrRequest({ provider, providerState: hospitalState, ...ppdr }) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pro, provider, hospitalState, ppdr?.gfeAmount, ppdr?.billDate, ppdr?.billed, ppdr?.deadline],
  );

  const cpts = useMemo(() => findings.map((f) => f.cpt), [findings]);
  const stats = useCodeStats(provider, cpts);
  const lineById = useMemo(() => new Map(lines.map((l) => [l.id, l])), [lines]);

  const disputeLetter = useMemo(
    () => (pro && findings.length > 0 ? buildDisputeLetter({ provider, findings, billTotal, totalDisputable }) : null),
    [pro, provider, findings, billTotal, totalDisputable],
  );
  const charityLetter = useMemo(
    () =>
      pro && canBuildCharityLetter(charity)
        ? buildCharityLetter({ provider, charity, state: household.state, billTotal })
        : null,
    [pro, provider, charity, household.state, billTotal],
  );

  const startDispute = () => {
    try {
      createDispute({ provider: provider.trim(), state: hospitalState || null, billTotal, findings, ...(ppdr ? { ppdr } : {}) });
      router.push("/tracker");
    } catch {
      setStartError("Couldn't save the dispute in this browser (storage may be blocked).");
    }
  };

  const upgrade = () => setPro(true);
  const n = findings.length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight sm:text-2xl">
            Your bill check <ProBadge />
          </h1>
          <p className="truncate text-sm text-slate-500">
            {provider.trim() || "Unknown provider"} · {lines.length} line{lines.length === 1 ? "" : "s"} · bill total{" "}
            {formatUSD(billTotal)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={onEditLines}>
            Edit lines
          </Button>
          <Button variant="ghost" size="sm" data-tour="new-bill" onClick={onNewBill}>
            New bill
          </Button>
        </div>
      </div>

      <Card className="text-center sm:text-left">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">
              {n === 0 ? "No issues found" : `${n} possible issue${n === 1 ? "" : "s"} found`}
            </p>
            <p className="mt-1 text-4xl font-bold tracking-tight tabular-nums text-emerald-700 sm:text-5xl">
              {formatUSD(totalDisputable)}
            </p>
            <p className="mt-1 text-base font-medium text-slate-800">you can dispute</p>
          </div>
          <div className="text-sm text-slate-600 sm:text-right">
            <p>
              {billTotal > 0 ? `${Math.round((totalDisputable / billTotal) * 100)}% of the ${formatUSD(billTotal)} bill` : null}
            </p>
            <p>
              Charity care: <strong>{CHARITY_LABEL[charity.status]}</strong>
            </p>
            <p>
              Good Faith Estimate: <strong>{GFE_LABEL[gfe.status]}</strong>
            </p>
          </div>
        </div>
        {n === 0 && (
          <p className="mt-4 text-left text-sm text-slate-600">
            We found no possible duplicates and no prices above 3× the Medicare reference in the lines we could check.
            That doesn&apos;t mean the bill is right — see what we could check below, and the charity care estimate.
          </p>
        )}
      </Card>

      {n > 0 && (
        <section aria-labelledby="findings-title" data-tour="findings" className="scroll-mt-20 space-y-3">
          <h2 id="findings-title" className="text-base font-semibold">
            What we found
          </h2>
          <ol className="space-y-3">
            {findings.map((f, i) => {
              const orig = f.duplicateOfLineId ? lineById.get(f.duplicateOfLineId) : undefined;
              return (
                <FindingItem
                  key={f.id}
                  finding={f}
                  index={i}
                  pro={pro}
                  hospital={provider}
                  stats={f.cpt ? stats?.get(f.cpt.trim().toUpperCase()) : undefined}
                  duplicateOf={
                    orig
                      ? `${orig.cpt ?? "line"} ${orig.description} on ${orig.dateOfService ?? "the same date"}, ${formatUSD(orig.charge)}`
                      : undefined
                  }
                  onUnlock={scrollToPaywall}
                />
              );
            })}
          </ol>
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <CharityCard charity={charity} household={household} onHousehold={onHousehold} />
        <GfeCard gfe={gfe} input={gfeInput} onInput={onGfe} />
      </div>
      <CoverageNote lineStatus={lineStatus} lines={lines} />

      {!pro ? (
        <Paywall disputable={totalDisputable} onUpgrade={upgrade} />
      ) : (
        <section aria-labelledby="pro-title" className="space-y-4">
          <div className="flex items-center gap-2">
            <h2 id="pro-title" className="text-base font-semibold">
              Your next steps
            </h2>
            <ProBadge />
          </div>

          {(n > 0 || ppdr) && (
            <Card className="flex flex-col gap-3 border-emerald-200 bg-emerald-50/60 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-slate-900">Track this dispute</p>
                <p className="text-sm text-slate-600">
                  Adds {formatUSD(totalDisputable)} to your tracker with a day-30 follow-up and day-60 escalation
                  {ppdr ? ", plus the federal dispute deadline" : ""}.
                </p>
                {startError && (
                  <p className="mt-1 text-sm text-rose-600" role="alert">
                    {startError}
                  </p>
                )}
              </div>
              <Button size="lg" data-tour="start-dispute" onClick={startDispute}>
                Start dispute →
              </Button>
            </Card>
          )}

          {disputeLetter && (
            <LetterBox
              id="dispute-letter"
              title="Dispute letter"
              description={`Lists all ${n} finding${n === 1 ? "" : "s"} with CPT codes and amounts, and asks for an itemized review, a corrected bill and a hold on collections.`}
              text={disputeLetter}
              filename={letterFilename("dispute", provider)}
            />
          )}

          {ppdrText && (
            <LetterBox
              id="ppdr-request"
              title="Federal Good Faith Estimate dispute — request text"
              description="Everything the CMS patient-provider dispute form asks for: the estimate, the bill, the difference and your request. Submit it at nsa-idr.cms.gov/billdisputes with the $25 fee."
              text={ppdrText}
              filename={letterFilename("ppdr", provider)}
            />
          )}

          {charityLetter ? (
            <LetterBox
              id="charity-letter"
              title="Charity care request"
              description="Asks the hospital's financial assistance office for its FAP application and a discount under IRS §501(r)."
              text={charityLetter}
              filename={letterFilename("charity", provider)}
            />
          ) : (
            <p className="rounded-lg border border-dashed border-slate-300 bg-white p-3 text-sm text-slate-600">
              Enter household size and income in the charity care card above to generate a charity care request letter.
            </p>
          )}

          <p className="text-xs text-slate-500">
            Pro is unlocked in demo mode — no real charge.{" "}
            <button type="button" className="underline hover:text-slate-700" onClick={() => setPro(false)}>
              Lock again
            </button>
          </p>
        </section>
      )}
    </div>
  );
}
