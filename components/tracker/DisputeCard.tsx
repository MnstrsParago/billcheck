"use client";

import { useRef, useState } from "react";
import type { Dispute, DisputeEvent, DisputeStatus } from "@/lib/types";
import { shareOutcome } from "@/lib/outcomes/client";
import { downloadIcs, downloadText } from "@/lib/tracker/ics";
import { escalationLetter, followUpLetter, itemizedFollowUpLetter } from "@/lib/tracker/letters";
import { buildPpdrRequest } from "@/lib/letters";
import { PPDR_FEE, PPDR_PORTAL_URL, PPDR_SOURCE_URL } from "@/lib/audit/gfe";
import { formatDate, usd } from "@/lib/tracker/format";
import {
  ESCALATION_DAY,
  FOLLOW_UP_DAY,
  ITEMIZED_FOLLOW_UP_DAY,
  STATUS_LABEL,
  addDays,
  hasPpdrFiled,
  isClosed,
  isItemizedRequest,
  nextStepFor,
  ppdrDeadline,
} from "@/lib/tracker/status";
import {
  deleteDispute,
  escalateDispute,
  markFollowUpSent,
  markItemizedReceived,
  markPpdrFiled,
  resolveDispute,
  setOutcomeShared,
  type LineResolution,
} from "@/lib/tracker/store";
import ResolveForm from "./ResolveForm";
import EmailReminders from "./EmailReminders";
import { cancelScheduled } from "@/lib/email/client";

const BADGE: Record<DisputeStatus, string> = {
  letter_sent: "bg-slate-100 text-slate-700 ring-slate-200",
  waiting: "bg-sky-50 text-sky-700 ring-sky-200",
  follow_up_due: "bg-amber-50 text-amber-800 ring-amber-200",
  escalation_due: "bg-rose-50 text-rose-700 ring-rose-200",
  resolved: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  escalated: "bg-slate-800 text-white ring-slate-800",
};

const EVENT_LABEL: Record<DisputeEvent["type"], string> = {
  letter_sent: "Dispute letter sent",
  follow_up_due: "Follow-up due",
  follow_up_sent: "Follow-up letter sent",
  escalation_due: "Escalation due",
  resolved: "Resolved",
  escalated: "Escalated",
  ppdr_filed: "Federal Good Faith Estimate dispute filed",
  itemized_received: "Itemized bill received",
  note: "Note",
};

function eventLabel(d: Dispute, e: DisputeEvent): string {
  if (isItemizedRequest(d)) {
    if (e.type === "letter_sent") return "Itemized bill requested";
    if (e.type === "follow_up_sent") return "Second request sent";
  }
  return EVENT_LABEL[e.type];
}

/** Stored events plus the day-30 / day-60 milestones that have been reached. */
function timeline(d: Dispute, now: Date): DisputeEvent[] {
  const end = d.closedAt ? new Date(d.closedAt) : now;
  const out = [...d.events];
  const itemized = isItemizedRequest(d);
  const fu = addDays(d.startedAt, itemized ? ITEMIZED_FOLLOW_UP_DAY : FOLLOW_UP_DAY);
  if (fu <= end && !out.some((e) => e.type === "follow_up_due")) out.push({ at: fu.toISOString(), type: "follow_up_due" });
  const esc = addDays(d.startedAt, ESCALATION_DAY);
  if (!itemized && esc <= end && !out.some((e) => e.type === "escalation_due"))
    out.push({ at: esc.toISOString(), type: "escalation_due" });
  return out.sort((a, b) => a.at.localeCompare(b.at));
}

type Share = "idle" | "sharing" | "failed";

export default function DisputeCard({ dispute: d, now }: { dispute: Dispute; now: Date }) {
  const [resolving, setResolving] = useState(false);
  const [share, setShare] = useState<Share>("idle");
  const [copied, setCopied] = useState(false);

  const closed = isClosed(d);
  const itemized = isItemizedRequest(d);
  const step = nextStepFor(d, now);
  const deadline = ppdrDeadline(d);
  const daysLeft = deadline ? Math.ceil((deadline.getTime() - now.getTime()) / 86_400_000) : null;
  const ppdrText = d.ppdr
    ? buildPpdrRequest({ provider: d.provider, providerState: d.state, ...d.ppdr, date: now })
    : null;
  const letter =
    d.status === "follow_up_due" && itemized
      ? { title: "Second request for the itemized bill", text: itemizedFollowUpLetter(d, now), file: "itemized-bill-second-request.txt" }
      : d.status === "follow_up_due"
      ? { title: "Follow-up letter", text: followUpLetter(d, now), file: "follow-up-letter.txt" }
      : d.status === "escalation_due"
        ? { title: "Escalation letter", text: escalationLetter(d, now), file: "escalation-letter.txt" }
        : null;

  async function doShare(closedDispute: Dispute | null) {
    if (!closedDispute) return;
    setShare("sharing");
    let ok = false;
    try {
      ok = (await shareOutcome(closedDispute)).ok;
    } catch {
      ok = false;
    }
    if (ok) {
      setOutcomeShared(closedDispute.id, true);
      setShare("idle");
    } else {
      setShare("failed");
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const closing = useRef(false);
  function onResolve(r: Record<string, LineResolution>) {
    if (closing.current || isClosed(d)) return; // double click on Save
    closing.current = true;
    setResolving(false);
    void cancelScheduled(d);
    void doShare(resolveDispute(d.id, r));
  }

  function onEscalate() {
    if (closing.current || isClosed(d)) return;
    if (!window.confirm("Close this dispute as escalated? Final prices will stay as billed.")) return;
    closing.current = true;
    void cancelScheduled(d);
    void doShare(escalateDispute(d.id));
  }

  function onDelete() {
    if (!window.confirm(`Delete the dispute with ${d.provider}? This can't be undone.`)) return;
    void cancelScheduled(d);
    deleteDispute(d.id);
  }

  // Failed earlier (e.g. previous visit) or failed just now.
  const showRetry = closed && d.outcomeShared !== true && share !== "sharing";

  const btn = "rounded-full px-4 py-2 text-sm font-medium";
  const primary = `${btn} bg-emerald-600 text-white hover:bg-emerald-700`;
  const secondary = `${btn} bg-slate-900/5 text-slate-800 hover:bg-slate-900/10`;

  return (
    <article data-dispute-id={d.id} className="scroll-mt-20 space-y-5 rounded-3xl bg-slate-50 p-5 sm:p-7">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate text-xl font-semibold tracking-tight text-slate-900">{d.provider}</h2>
          <p className="text-xs text-slate-500">
            {itemized ? "Itemized bill request · " : ""}Started {formatDate(d.startedAt)}
            {d.state ? ` · ${d.state}` : ""}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${BADGE[d.status]}`}>
          {itemized && d.status === "resolved"
            ? "Bill received"
            : itemized && d.status === "letter_sent"
              ? "Requested"
              : STATUS_LABEL[d.status]}
        </span>
      </header>

      <dl className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl bg-white p-3">
          <dt className="text-[11px] text-slate-500">Bill total</dt>
          <dd className="text-sm font-semibold text-slate-900">{usd(d.billTotal)}</dd>
        </div>
        <div className="rounded-2xl bg-white p-3">
          <dt className="text-[11px] text-slate-500">Disputed</dt>
          <dd className="text-sm font-semibold text-slate-900">{itemized ? "—" : usd(d.amountDisputed)}</dd>
        </div>
        <div className="rounded-2xl bg-emerald-50 p-3">
          <dt className="text-[11px] text-slate-500">Saved</dt>
          <dd className="text-sm font-semibold text-emerald-700">
            {d.status === "resolved" && !itemized ? usd(d.savedAmount ?? 0) : "—"}
          </dd>
        </div>
      </dl>

      {d.lines.length > 0 && (
        <ul className="divide-y divide-slate-100 text-sm">
          {d.lines.map((l) => (
            <li key={l.lineId} className="flex items-baseline justify-between gap-3 py-1.5">
              <span className="min-w-0 text-slate-700">
                <span className="font-mono text-xs text-slate-500">{l.cpt ?? "—"}</span> {l.description}
              </span>
              <span className="shrink-0 text-right text-slate-900">
                {l.finalPrice !== undefined && l.finalPrice !== l.originalPrice ? (
                  <>
                    <span className="mr-1 text-xs text-slate-400 line-through">{usd(l.originalPrice)}</span>
                    {usd(l.finalPrice)}
                  </>
                ) : (
                  usd(l.originalPrice)
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      <ol className="space-y-1.5 border-l-2 border-slate-200 pl-4">
        {timeline(d, now).map((e, i) => (
          <li key={`${e.type}-${i}`} className="relative text-sm">
            <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-slate-400" />
            <span className="text-slate-500">{formatDate(e.at)}</span>{" "}
            <span className="text-slate-800">{eventLabel(d, e)}</span>
            {e.note && <span className="text-slate-500"> — {e.note}</span>}
          </li>
        ))}
        {step && (
          <li className="relative text-sm">
            <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full border-2 border-emerald-500 bg-white" />
            <span className="text-slate-500">{formatDate(step.dueDate)}</span>{" "}
            <span className="font-medium text-emerald-700">Next: {step.label}</span>
          </li>
        )}
      </ol>

      {letter && (
        <section data-tour="tracker-letter" className="scroll-mt-20 space-y-3 rounded-2xl bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-900">{letter.title} — ready to send</h3>
          <textarea
            readOnly
            value={letter.text}
            rows={8}
            className="block w-full resize-y rounded-xl bg-slate-50 p-3 font-mono text-xs text-slate-800"
          />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => copy(letter.text)} className={secondary}>
              {copied ? "Copied" : "Copy letter"}
            </button>
            <button type="button" onClick={() => downloadText(letter.file, letter.text)} className={secondary}>
              Download .txt
            </button>
            {d.status === "follow_up_due" && (
              <button type="button" onClick={() => markFollowUpSent(d.id)} className={primary}>
                Mark follow-up sent
              </button>
            )}
          </div>
        </section>
      )}

      {!closed && !itemized && <EmailReminders dispute={d} />}

      {d.ppdr && ppdrText && !closed && (
        <section className="space-y-3 rounded-2xl bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-900">
            Federal Good Faith Estimate dispute (No Surprises Act)
          </h3>
          <p className="text-sm text-slate-700">
            Billed {usd(d.ppdr.billed)} vs. estimate {usd(d.ppdr.gfeAmount)} — {usd(d.ppdr.difference)} over.{" "}
            {hasPpdrFiled(d) ? (
              <strong className="text-emerald-700">Filed.</strong>
            ) : (
              <>
                File by <strong>{formatDate(`${d.ppdr.deadline}T00:00:00Z`)}</strong>
                {daysLeft !== null && daysLeft >= 0 ? ` (${daysLeft} day${daysLeft === 1 ? "" : "s"} left)` : " (deadline passed)"}
                . ${PPDR_FEE} fee.
              </>
            )}
          </p>
          {!hasPpdrFiled(d) && (
            <>
              <textarea
                readOnly
                value={ppdrText}
                rows={6}
                aria-label="Federal dispute request text"
                className="block w-full resize-y rounded-xl bg-slate-50 p-3 font-mono text-xs text-slate-800"
              />
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => copy(ppdrText)} className={secondary}>
                  {copied ? "Copied" : "Copy request"}
                </button>
                <button type="button" onClick={() => downloadText("ppdr-request.txt", ppdrText)} className={secondary}>
                  Download .txt
                </button>
                <a href={PPDR_PORTAL_URL} target="_blank" rel="noopener noreferrer" className={secondary}>
                  Open CMS dispute portal ↗
                </a>
                <button type="button" onClick={() => markPpdrFiled(d.id)} className={primary}>
                  Mark as filed
                </button>
              </div>
            </>
          )}
          <p className="text-xs text-slate-500">
            Source:{" "}
            <a className="underline" href={PPDR_SOURCE_URL} target="_blank" rel="noopener noreferrer">
              CMS — Dispute a medical bill
            </a>
          </p>
        </section>
      )}

      {resolving && !closed && (
        <ResolveForm dispute={d} onSubmit={onResolve} onCancel={() => setResolving(false)} />
      )}

      {closed && itemized && (
        <a href="/" className="inline-block text-sm font-medium text-emerald-700 hover:underline">
          Check the itemized bill now →
        </a>
      )}

      {closed && share === "sharing" && <p className="text-xs text-slate-500">Sharing anonymous result…</p>}
      {showRetry && (
        <p className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
          Couldn&apos;t share anonymously.
          <button
            type="button"
            onClick={() => void doShare(d)}
            className="rounded border border-slate-300 px-2 py-0.5 font-medium text-slate-700 hover:bg-slate-50"
          >
            Retry
          </button>
        </p>
      )}

      <footer className="flex flex-wrap gap-2 pt-1">
        {!closed && (
          <>
            <button type="button" onClick={() => downloadIcs(d)} className={secondary}>
              Add to calendar
            </button>
            {itemized ? (
              <button type="button" onClick={() => markItemizedReceived(d.id)} className={primary}>
                Itemized bill received
              </button>
            ) : (
              <>
                {!resolving && (
                  <button type="button" data-tour="resolve" onClick={() => setResolving(true)} className={primary}>
                    Resolve
                  </button>
                )}
                <button type="button" onClick={onEscalate} className={secondary}>
                  Escalate
                </button>
              </>
            )}
          </>
        )}
        <button type="button" onClick={onDelete} className={`${btn} ml-auto text-rose-600 hover:bg-rose-50`}>
          Delete
        </button>
      </footer>
    </article>
  );
}
