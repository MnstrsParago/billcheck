"use client";

import { useEffect, useRef, useState } from "react";
import type { Dispute } from "@/lib/types";
import { reminderTime, ESCALATION_DAY } from "@/lib/email/plan";
import { scheduleEscalation, sendFollowUpNow, subscribeReminders } from "@/lib/email/client";
import { setDisputeEmail } from "@/lib/tracker/store";
import { formatDate } from "@/lib/tracker/format";

const btn = "rounded-full px-4 py-2 text-sm font-medium disabled:opacity-50";
const primary = `${btn} bg-emerald-600 text-white hover:bg-emerald-700`;
const secondary = `${btn} bg-slate-900/5 text-slate-800 hover:bg-slate-900/10`;

/** "Remind me by email": confirmation now, follow-up and escalation scheduled with Resend (no cron of our own). */
export default function EmailReminders({ dispute: d }: { dispute: Dispute }) {
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState<null | "subscribe" | "now">(null);
  const [error, setError] = useState<string | null>(null);
  const [restricted, setRestricted] = useState(false);
  const [sentNow, setSentNow] = useState(false);
  const escTried = useRef(false);
  const e = d.email;

  // Day-60 email: Resend schedules at most 30 days ahead, so it is booked once it falls inside that window.
  useEffect(() => {
    if (!e || e.escalation || escTried.current) return;
    if (!reminderTime(d.startedAt, ESCALATION_DAY, new Date())) return;
    escTried.current = true;
    void scheduleEscalation(d, e.address).then((r) => {
      if (r.ok && r.scheduled && r.id && r.at) setDisputeEmail(d.id, { ...e, escalation: { id: r.id, at: r.at } });
    });
  }, [d, e]);

  async function subscribe() {
    if (busy) return;
    const a = address.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a)) {
      setError("Please enter a valid email address.");
      return;
    }
    setBusy("subscribe");
    setError(null);
    const r = await subscribeReminders(d, a);
    setBusy(null);
    if (!r.ok) {
      setRestricted(r.code === "demo_restricted");
      setError(r.error ?? "We couldn't turn on email reminders.");
      return;
    }
    setDisputeEmail(d.id, {
      address: a,
      confirmedAt: new Date().toISOString(),
      ...(r.followUp ? { followUp: r.followUp } : {}),
      ...(r.escalation ? { escalation: r.escalation } : {}),
    });
  }

  async function sendNow() {
    if (!e || busy) return;
    setBusy("now");
    setError(null);
    const r = await sendFollowUpNow(d, e.address);
    setBusy(null);
    if (!r.ok) {
      setRestricted(r.code === "demo_restricted");
      setError(r.error ?? "The email could not be sent.");
      return;
    }
    setSentNow(true);
    setDisputeEmail(d.id, { ...e, lastSentNowAt: new Date().toISOString() });
  }

  return (
    <section className="space-y-3 rounded-2xl bg-white p-4">
      <h3 className="text-base font-semibold text-slate-900">Remind me by email</h3>
      {!e ? (
        <>
          <p className="text-sm text-slate-600">
            Emails on day 30 and day 60.
          </p>
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(ev) => {
              ev.preventDefault();
              void subscribe();
            }}
          >
            <label htmlFor={`email-${d.id}`} className="sr-only">
              Email address
            </label>
            <input
              id={`email-${d.id}`}
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={address}
              onChange={(ev) => setAddress(ev.target.value)}
              className="min-w-0 flex-1 rounded-full border border-slate-200 bg-white px-4 py-2 text-[15px] focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
            <button type="submit" disabled={busy !== null} className={primary}>
              {busy === "subscribe" ? "Sending…" : "Remind me"}
            </button>
          </form>
        </>
      ) : (
        <>
          <p className="text-sm text-slate-700">
            Reminders on for <strong>{e.address}</strong>. Confirmation sent.
          </p>
          <ul className="space-y-1 text-sm text-slate-600">
            <li>
              Day 30 follow-up email:{" "}
              {e.followUp ? <strong>{formatDate(e.followUp.at)}</strong> : "booked later"}
            </li>
            <li>
              Day 60 escalation email:{" "}
              {e.escalation ? (
                <strong>scheduled for {formatDate(e.escalation.at)}</strong>
              ) : (
                "booked automatically 30 days before"
              )}
            </li>
          </ul>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => void sendNow()} disabled={busy !== null} className={secondary}>
              {busy === "now" ? "Sending…" : "Send me the follow-up email now"}
            </button>
            {sentNow ? <span className="text-sm text-emerald-700">Sent. Check your inbox (and spam).</span> : null}
          </div>
        </>
      )}
      {error ? (
        <p role="alert" className={`rounded-xl px-3 py-2 text-sm ${restricted ? "bg-amber-50 text-amber-900" : "bg-rose-50 text-rose-700"}`}>
          {error}
        </p>
      ) : null}
      <p className="text-xs text-slate-400">
        Demo sender onboarding@resend.dev; your address stays in this browser.
      </p>
    </section>
  );
}
