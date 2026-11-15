"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { US_STATES } from "@/lib/audit/charity";
import { buildItemizedRequest, letterFilename } from "@/lib/letters";
import { setPro, usePro } from "@/lib/pro";
import { parseMoney } from "@/lib/state";
import { ITEMIZED_FOLLOW_UP_DAY } from "@/lib/tracker/status";
import { createDispute } from "@/lib/tracker/store";
import { Button } from "@/components/ui/Button";
import { inputClass } from "@/components/ui/Field";
import { LetterBox } from "./LetterBox";

/** Only a summary bill (no line items): request the itemized bill and track the 14-day follow-up. */
export function SummaryBillRequest() {
  const router = useRouter();
  const pro = usePro();
  const [provider, setProvider] = useState("");
  const [state, setState] = useState("");
  const [total, setTotal] = useState("");
  const [billDate, setBillDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  const billTotal = parseMoney(total);
  const letter = useMemo(
    () => buildItemizedRequest({ provider, billTotal, billDate: billDate || null }),
    [provider, billTotal, billDate],
  );

  const track = () => {
    if (!provider.trim()) {
      setError("Add the hospital name first.");
      return;
    }
    try {
      createDispute({
        provider: provider.trim(),
        state: state || null,
        billTotal: billTotal && billTotal > 0 ? billTotal : 0,
        findings: [],
        kind: "itemized_request",
      });
      router.push("/tracker");
    } catch {
      setError("Couldn't save the request in this browser (storage may be blocked).");
    }
  };

  return (
    <details className="group rounded-lg border border-slate-200 p-3" id="summary-bill">
      <summary className="cursor-pointer select-none text-sm font-medium text-slate-700">
        Only have a summary bill with no line items?
      </summary>
      <div className="mt-3 space-y-3">
        <p className="text-sm text-slate-600">
          You have the right to ask for an itemized bill. Send this request, and we&apos;ll remind you to follow up after{" "}
          {ITEMIZED_FOLLOW_UP_DAY} days if it hasn&apos;t arrived.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Hospital name</span>
            <input className={`${inputClass} mt-1`} value={provider} onChange={(e) => setProvider(e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Hospital state</span>
            <select className={`${inputClass} mt-1`} value={state} onChange={(e) => setState(e.target.value)}>
              <option value="">Unknown</option>
              {US_STATES.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Amount on the summary bill ($)</span>
            <input
              className={`${inputClass} mt-1`}
              inputMode="decimal"
              placeholder="optional"
              value={total}
              onChange={(e) => setTotal(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Date on the bill</span>
            <input type="date" className={`${inputClass} mt-1`} value={billDate} onChange={(e) => setBillDate(e.target.value)} />
          </label>
        </div>

        <LetterBox
          id="itemized-request"
          title="Itemized bill request"
          description="Asks for every line with codes, units and charges, the financial assistance policy, and a hold on collections."
          text={letter}
          filename={letterFilename("itemized-request", provider)}
        />

        <div className="flex flex-wrap items-center gap-3">
          {pro ? (
            <Button onClick={track}>Track this request →</Button>
          ) : (
            <>
              <Button onClick={() => setPro(true)}>Upgrade — $12/mo to track it</Button>
              <span className="rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 ring-1 ring-amber-200">
                Demo unlock — no real charge
              </span>
            </>
          )}
        </div>
        {error ? (
          <p role="alert" className="text-sm text-rose-600">
            {error}
          </p>
        ) : null}
      </div>
    </details>
  );
}
