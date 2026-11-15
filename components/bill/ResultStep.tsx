"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatUSD } from "@/lib/audit";
import {
  buildCharityLetter,
  buildDisputeLetter,
  buildItemizedRequest,
  buildPpdrRequest,
  canBuildCharityLetter,
  letterFilename,
} from "@/lib/letters";
import { checkGfe, type GfeInput } from "@/lib/audit/gfe";
import { useNow } from "@/lib/tracker/clock";
import { isTourActive } from "@/components/tour/JudgeTour";
import { setPro, usePro } from "@/lib/pro";
import { createDispute } from "@/lib/tracker/store";
import type { AuditResult, BillLine, HouseholdInput } from "@/lib/types";
import { useCodeStats } from "@/components/outcomes/FindingOutcomeStats";
import { Button } from "@/components/ui/Button";
import { ProBadge } from "@/components/ui/ProBadge";
import { CharityCard } from "./CharityCard";
import { CoverageNote } from "./CoverageNote";
import { FindingItem } from "./FindingItem";
import { GfeCard } from "./GfeCard";
import { LetterBox } from "./LetterBox";
import { Paywall, PAYWALL_ID } from "./Paywall";

/** Whole dollars for headline amounts ("$5,943"). */
const usd0 = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

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
  fromSample,
  onEditLines,
  onNewBill,
}: {
  fromSample: boolean;
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

  const started = useRef(false);
  const startDispute = () => {
    if (started.current) return; // a double click must not create two disputes
    started.current = true;
    try {
      const demo = fromSample || isTourActive();
      createDispute({ provider: provider.trim(), state: hospitalState || null, billTotal, findings, demo, ...(ppdr ? { ppdr } : {}) });
      router.push("/tracker");
    } catch {
      started.current = false;
      setStartError("We couldn't save the dispute in this browser. Storage may be blocked.");
    }
  };

  const upgrade = () => setPro(true);
  const [showNext, setShowNext] = useState(false);
  const openNext = () => {
    setShowNext(true);
    requestAnimationFrame(() =>
      document.getElementById("next-steps")?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  };
  const noCodes = lines.length > 0 && lineStatus.filter((x) => x.status === "no_cpt").length * 2 >= lines.length;
  const n = findings.length;
  const name = provider.trim();
  const fromWhom = name ? ` from ${name}` : "";

  return (
    <div className="space-y-14 sm:space-y-20">
      <header>
        <div className="flex items-center justify-between gap-3">
          <p className="flex min-w-0 items-center gap-2 whitespace-nowrap text-base font-medium text-slate-500">
            Your bill check
            <span className="hidden sm:inline-flex">
              <ProBadge />
            </span>
          </p>
          <div className="flex shrink-0 gap-1">
            <Button variant="ghost" size="sm" onClick={onEditLines}>
              Edit lines
            </Button>
            <Button variant="ghost" size="sm" data-tour="new-bill" onClick={onNewBill}>
              New bill
            </Button>
          </div>
        </div>
        {n > 0 ? (
          <>
            <h1 className="mt-6 text-6xl font-bold tracking-tight tabular-nums text-emerald-600 sm:text-8xl">
              {usd0(totalDisputable)}
            </h1>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">you can dispute</p>
            <p className="mt-4 max-w-xl text-lg text-slate-600">
              We found {n} problem{n === 1 ? "" : "s"} on your {usd0(billTotal)} bill{fromWhom}.
            </p>
          </>
        ) : (
          <>
            <h1 className="mt-6 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">No problems found</h1>
            <p className="mt-4 max-w-xl text-lg text-slate-600">
              We checked your {usd0(billTotal)} bill{fromWhom} and found nothing billed twice and no price far above what
              Medicare pays. That doesn&apos;t prove the bill is right. You may still get free or cheaper care — see below.
            </p>
          </>
        )}
        {noCodes ? (
          <p className="mt-3 text-base text-amber-800">
            Your bill has no billing codes, so we could only look for charges billed twice. See “More ways to save” below.
          </p>
        ) : null}
      </header>

      {n > 0 && (
        <section aria-labelledby="findings-title" data-tour="findings" className="scroll-mt-20 space-y-5">
          <h2 id="findings-title" className="text-3xl font-bold tracking-tight text-slate-900">
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
                      ? `${orig.description}${orig.cpt ? ` (code ${orig.cpt})` : ""} on ${orig.dateOfService ?? "the same date"}, ${formatUSD(orig.charge)}`
                      : undefined
                  }
                  onUnlock={openNext}
                />
              );
            })}
          </ol>
        </section>
      )}

      {(n > 0 || ppdr) && !showNext ? (
        <div className="flex justify-center">
          <Button size="lg" data-tour="get-letter" className="w-full sm:w-auto" onClick={openNext}>
            Get my dispute letter
          </Button>
        </div>
      ) : null}

      {!showNext ? null : !pro ? (
        <div id="next-steps" className="scroll-mt-20">
          <Paywall disputable={totalDisputable} onUpgrade={upgrade} />
        </div>
      ) : (
        <section id="next-steps" aria-labelledby="pro-title" className="scroll-mt-20 space-y-5">
          <h2 id="pro-title" className="flex flex-wrap items-center gap-3 text-3xl font-bold tracking-tight text-slate-900">
            Your next steps <ProBadge />
          </h2>

          {disputeLetter && (
            <LetterBox
              id="dispute-letter"
              title="Letter to the hospital"
              description={`Lists the ${n} problem${n === 1 ? "" : "s"} with codes and amounts, and asks for a corrected bill and a pause on collections.`}
              text={disputeLetter}
              filename={letterFilename("dispute", provider)}
            />
          )}

          {(n > 0 || ppdr) && (
            <div className="flex flex-col gap-5 rounded-3xl bg-emerald-50 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
              <div>
                <p className="text-lg font-semibold tracking-tight text-slate-900">Track your dispute</p>
                <p className="mt-1 text-base text-slate-600">
                  We&apos;ll save {usd0(totalDisputable)} to your tracker and remind you to follow up after 30 days, and again
                  after 60 days if needed{ppdr ? ". We'll also track the federal review deadline" : ""}.
                </p>
                {startError && (
                  <p className="mt-2 text-sm text-rose-600" role="alert">
                    {startError}
                  </p>
                )}
              </div>
              <Button size="lg" className="shrink-0" data-tour="start-dispute" onClick={startDispute}>
                Start dispute →
              </Button>
            </div>
          )}

          <details className="rounded-3xl bg-slate-50 p-5 sm:p-7">
            <summary className="cursor-pointer select-none text-base font-semibold text-slate-900">More options</summary>
            <div className="mt-5 space-y-5">
          {ppdrText && (
            <LetterBox
              id="ppdr-request"
              title="Request for a federal review"
              description="Everything the government form asks for: the estimate, the bill and the difference. Submit it at nsa-idr.cms.gov/billdisputes and pay the $25 fee."
              text={ppdrText}
              filename={letterFilename("ppdr", provider)}
            />
          )}

          {charityLetter ? (
            <LetterBox
              id="charity-letter"
              title="Request for free or cheaper care"
              description="Asks the hospital's financial help office for its application form and a discount on your bill."
              text={charityLetter}
              filename={letterFilename("charity", provider)}
            />
          ) : (
            <p className="text-base text-slate-500">
              Add your household size and income under &quot;Free or cheaper care&quot; below to get a letter asking for a
              discount.
            </p>
          )}

          <p className="text-sm text-slate-500">
            Pro is unlocked as a demo — no real charge.{" "}
            <button type="button" className="underline hover:text-slate-700" onClick={() => setPro(false)}>
              Lock again
            </button>
          </p>
            </div>
          </details>
        </section>
      )}

      <details className="group rounded-3xl bg-slate-50 p-5 sm:p-7">
        <summary className="cursor-pointer select-none list-none">
          <span className="text-xl font-semibold tracking-tight text-slate-900">More ways to save</span>
          <span className="mt-1 block text-base text-slate-600">
            Free or cheaper care, a price estimate you were given, a bill with no codes.
          </span>
        </summary>
        <div className="mt-6 space-y-5">
      {lines.length > 0 && lineStatus.filter((x) => x.status === "no_cpt").length * 2 >= lines.length && (
        <section className="space-y-4 rounded-3xl bg-white p-5 sm:p-7">
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">Your bill has no billing codes</h2>
          <p className="text-slate-700">
            Most charges have no code (like “70450”), so we could only look for charges billed twice — we can&apos;t compare
            prices with Medicare. Ask the hospital for an itemized bill with codes. Here is a letter you can send:
          </p>
          <LetterBox
            id="itemized-request"
            title="Request for an itemized bill"
            description="Asks for every charge with its code, quantity and price."
            text={buildItemizedRequest({ provider, billTotal })}
            filename={letterFilename("itemized-request", provider)}
          />
        </section>
      )}


        <CharityCard charity={charity} household={household} onHousehold={onHousehold} />
        <GfeCard gfe={gfe} input={gfeInput} onInput={onGfe} />
        <CoverageNote lineStatus={lineStatus} lines={lines} />
        </div>
      </details>
    </div>
  );
}
