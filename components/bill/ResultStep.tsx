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
import { MoreWays } from "./MoreWays";

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
  onTrySample,
}: {
  onTrySample: (id: "A" | "B") => void;
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
      try {
        sessionStorage.setItem("bc.justStarted", "1");
      } catch {
        /* ignore */
      }
      router.push("/tracker?started=1");
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
    <div className="space-y-14">
      <div className="flex justify-center gap-6 text-sm">
        <button type="button" data-tour="sample-A" className="underline underline-offset-4" onClick={() => onTrySample("A")}>
          Try a sample bill
        </button>
        <button type="button" data-tour="new-bill" className="underline underline-offset-4" onClick={onNewBill}>
          Start over
        </button>
      </div>

      <header className="text-center">
        <h1 className="text-6xl font-semibold tracking-tight tabular-nums text-slate-900 sm:text-8xl">
          {usd0(totalDisputable)}
        </h1>
        <p className="mt-2 text-xl text-slate-900">you can dispute</p>
        <p className="mt-3 text-sm text-slate-400">
          {name || "Your bill"} · {usd0(billTotal)}
          {noCodes ? " · no codes on this bill" : ""} ·{" "}
          <button type="button" onClick={onEditLines} className="underline underline-offset-4">
            Edit
          </button>
        </p>
      </header>

      {n > 0 && (
        <section aria-label="What we found" data-tour="findings" className="scroll-mt-20">
          <ol className="divide-y divide-slate-100">
            {findings.map((f, i) => (
              <FindingItem
                key={f.id}
                finding={f}
                index={i}
                pro={pro}
                hospital={provider}
                stats={f.cpt ? stats?.get(f.cpt.trim().toUpperCase()) : undefined}
                onUnlock={openNext}
              />
            ))}
          </ol>
        </section>
      )}

      {(n > 0 || ppdr) && !showNext ? (
        <div className="text-center">
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
        <section id="next-steps" aria-label="Your letter" className="scroll-mt-20 space-y-6">
          {disputeLetter && (
            <LetterBox
              id="dispute-letter"
              title="Letter to the hospital"
              description=""
              text={disputeLetter}
              filename={letterFilename("dispute", provider)}
            />
          )}
          <div className="text-center">
            <Button size="lg" className="w-full sm:w-auto" data-tour="start-dispute" onClick={startDispute}>
              Start dispute
            </Button>
            {startError ? (
              <p className="mt-2 text-sm text-rose-600" role="alert">
                {startError}
              </p>
            ) : null}
          </div>
        </section>
      )}

      <MoreWays
        charity={charity}
        household={household}
        onHousehold={onHousehold}
        gfe={gfe}
        gfeInput={gfeInput}
        onGfe={onGfe}
        provider={provider}
        hospitalState={hospitalState}
        billTotal={billTotal}
        charityLetter={charityLetter}
        ppdrText={ppdrText}
        pro={pro}
        onUnlock={openNext}
      />
    </div>
  );
}
