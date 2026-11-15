"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatUSD } from "@/lib/audit";
import type { GfeInput, GfeResult } from "@/lib/audit/gfe";
import { buildItemizedRequest, letterFilename } from "@/lib/letters";
import { createDispute } from "@/lib/tracker/store";
import type { CharityResult, HouseholdInput } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { inputClass } from "@/components/ui/Field";
import { CHARITY_LABEL } from "./CharityCard";
import { HouseholdFields } from "./HouseholdFields";
import { LetterBox } from "./LetterBox";

type Open = null | "charity" | "gfe" | "summary";

const link = "text-base text-slate-900 underline underline-offset-4";

/** "More ways to save": three one-line options; each opens only its own fields and one button. */
export function MoreWays(props: {
  charity: CharityResult;
  household: HouseholdInput;
  onHousehold: (h: HouseholdInput) => void;
  gfe: GfeResult;
  gfeInput: GfeInput;
  onGfe: (g: GfeInput) => void;
  provider: string;
  hospitalState: string;
  billTotal: number;
  charityLetter: string | null;
  ppdrText: string | null;
  pro: boolean;
  onUnlock: () => void;
}) {
  const [shown, setShown] = useState(false);
  const [open, setOpen] = useState<Open>(null);
  const [letter, setLetter] = useState<null | "charity" | "ppdr" | "summary">(null);
  const router = useRouter();
  const tracking = useRef(false);
  const { charity, gfe } = props;

  const toggle = (o: Open) => {
    setOpen(open === o ? null : o);
    setLetter(null);
  };

  const showLetter = (k: "charity" | "ppdr") => (props.pro ? setLetter(k) : props.onUnlock());

  const trackSummary = () => {
    if (tracking.current) return;
    tracking.current = true;
    try {
      createDispute({
        provider: props.provider.trim() || "Hospital",
        state: props.hospitalState || null,
        billTotal: props.billTotal,
        findings: [],
        kind: "itemized_request",
      });
      try {
        sessionStorage.setItem("bc.justStarted", "1");
      } catch {
        /* ignore */
      }
      router.push("/tracker?started=1");
    } catch {
      tracking.current = false;
    }
  };

  if (!shown) {
    return (
      <div className="text-center">
        <button type="button" className={link} onClick={() => setShown(true)}>
          More ways to save
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-3">
        <li>
          <button type="button" className={link} onClick={() => toggle("charity")}>
            Charity care
          </button>
          {open === "charity" ? (
            <div className="mt-3 space-y-3">
              <HouseholdFields value={props.household} onChange={props.onHousehold} idPrefix="more" />
              <p className="text-slate-600">
                {CHARITY_LABEL[charity.status]}
                {charity.fplPercent !== null ? ` · ${Math.round(charity.fplPercent)}% of poverty line` : ""}
              </p>
              {charity.status === "likely" || charity.status === "possibly" ? (
                <Button variant="secondary" onClick={() => showLetter("charity")}>
                  Get discount letter
                </Button>
              ) : null}
              {letter === "charity" && props.charityLetter ? (
                <LetterBox
                  id="charity-letter"
                  title="Discount request"
                  description=""
                  text={props.charityLetter}
                  filename={letterFilename("charity", props.provider)}
                />
              ) : null}
            </div>
          ) : null}
        </li>

        <li>
          <button type="button" className={link} onClick={() => toggle("gfe")}>
            Good Faith Estimate
          </button>
          {open === "gfe" ? (
            <div className="mt-3 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  aria-label="Estimate total ($)"
                  placeholder="Estimate total ($)"
                  className={inputClass}
                  value={props.gfeInput.gfeAmount ?? ""}
                  onChange={(e) => {
                    const v = e.target.value === "" ? null : Number(e.target.value);
                    props.onGfe({ ...props.gfeInput, gfeAmount: v !== null && Number.isFinite(v) ? v : null });
                  }}
                />
                <input
                  type="date"
                  aria-label="Date on the bill"
                  className={inputClass}
                  value={props.gfeInput.billDate ?? ""}
                  onChange={(e) => props.onGfe({ ...props.gfeInput, billDate: e.target.value || null })}
                />
              </div>
              <p className="text-slate-600">
                {gfe.status === "eligible" && gfe.deadline
                  ? `${formatUSD(gfe.difference ?? 0)} over · file by ${gfe.deadline}`
                  : gfe.status === "below_threshold"
                    ? "Under $400 over the estimate"
                    : gfe.status === "deadline_passed"
                      ? "120-day deadline passed"
                      : gfe.status === "insured"
                        ? "Only without insurance"
                        : "Enter the estimate and bill date"}
              </p>
              {gfe.status === "eligible" ? (
                <Button variant="secondary" onClick={() => showLetter("ppdr")}>
                  Get federal dispute form
                </Button>
              ) : null}
              {letter === "ppdr" && props.ppdrText ? (
                <LetterBox
                  id="ppdr-request"
                  title="Federal dispute ($25)"
                  description=""
                  text={props.ppdrText}
                  filename={letterFilename("ppdr", props.provider)}
                />
              ) : null}
            </div>
          ) : null}
        </li>

        <li>
          <button type="button" className={link} onClick={() => toggle("summary")}>
            Summary bill only
          </button>
          {open === "summary" ? (
            <div className="mt-3 space-y-3">
              <Button variant="secondary" onClick={() => setLetter("summary")}>
                Get itemized bill request
              </Button>
              {letter === "summary" ? (
                <>
                  <LetterBox
                    id="itemized-request"
                    title="Itemized bill request"
                    description=""
                    text={buildItemizedRequest({ provider: props.provider, billTotal: props.billTotal })}
                    filename={letterFilename("itemized-request", props.provider)}
                  />
                  {props.pro ? (
                    <button type="button" className={link} onClick={trackSummary}>
                      Track this request
                    </button>
                  ) : null}
                </>
              ) : null}
            </div>
          ) : null}
        </li>
      </ul>
    </div>
  );
}
