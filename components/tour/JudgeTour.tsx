"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { resetClock } from "@/lib/tracker/clock";
import { listDisputes } from "@/lib/tracker/store";

/** Start the tour from anywhere: window.dispatchEvent(new Event(TOUR_START_EVENT)). */
export const TOUR_START_EVENT = "bc:tour-start";
const KEY = "bc.tour.v1";

/** True while the Judge tour is running — anything saved then is demo data. */
export function isTourActive(): boolean {
  try {
    return typeof window !== "undefined" && window.localStorage.getItem(KEY) !== null;
  } catch {
    return false;
  }
}

type Saved = { step: number; disputeId: string | null };

function load(): Saved | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}
function save(s: Saved | null) {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  } catch {
    /* storage blocked — the tour still works for this page view */
  }
}

const $ = (sel: string) => document.querySelector<HTMLElement>(sel);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitFor(sel: string, timeoutMs = 15_000): Promise<HTMLElement> {
  const t0 = Date.now();
  for (;;) {
    const el = $(sel);
    if (el) return el;
    if (Date.now() - t0 > timeoutMs) throw new Error("timeout");
    await sleep(150);
  }
}

function scrollTo(el: HTMLElement | null) {
  el?.scrollIntoView({ behavior: "smooth", block: "start" });
  if (el) {
    el.animate(
      [{ boxShadow: "0 0 0 0 rgba(16,185,129,0)" }, { boxShadow: "0 0 0 6px rgba(16,185,129,.45)" }, { boxShadow: "0 0 0 0 rgba(16,185,129,0)" }],
      { duration: 1400, iterations: 2 },
    );
  }
}

function latestDisputeId(): string | null {
  const ds = listDisputes();
  if (!ds.length) return null;
  return [...ds].sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))[0].id;
}

type Ctx = { push: (href: string) => void; disputeId: string | null; setDisputeId: (id: string | null) => void };

type Step = {
  title: string;
  body: string;
  cta?: string;
  run?: (c: Ctx) => Promise<void>;
  /** Steps without a CTA advance when this returns true. */
  done?: (c: Ctx) => boolean;
};

const STEPS: Step[] = [
  {
    title: "A real ER bill",
    body: "We load Sample A, an itemized ER bill, and Claude reads it live into structured lines. Nothing is hardcoded: upload or paste your own bill and you get your own result.",
    cta: "Load Sample A and read it",
    run: async ({ push }) => {
      if (location.pathname !== "/") push("/");
      const first = await waitFor('[data-tour="sample-A"], [data-tour="new-bill"], [data-tour="run-audit"]');
      // Start from a clean input screen.
      if (first.dataset.tour === "new-bill") first.click();
      else if (first.dataset.tour === "run-audit") $('[data-tour="back"]')?.click();
      (await waitFor('[data-tour="sample-A"]')).click(); // loads the sample and starts reading it
      scrollTo(await waitFor('[data-tour="run-audit"]', 80_000));
    },
  },
  {
    title: "Review the lines",
    body: "Every line, CPT code and charge, in an editable table — fix anything the AI misread. The checks that follow are our own deterministic code, not the AI.",
    cta: "Run the audit",
    run: async () => {
      (await waitFor('[data-tour="run-audit"]')).click();
      scrollTo(await waitFor('[data-tour="findings"]'));
    },
  },
  {
    title: "Findings",
    body: "A possible duplicate and prices more than 3× the 2026 Medicare reference add up to the amount you can dispute. Under each finding: what other patients won disputing that code at this hospital, from the shared outcomes database.",
    cta: "Unlock Pro (demo, no charge)",
    run: async () => {
      $('[data-tour="upgrade"]')?.click();
      scrollTo(await waitFor('[data-tour="dispute-letter"]'));
    },
  },
  {
    title: "The dispute letter",
    body: "Pro explains each finding with its rule and source, and writes a ready letter with CPT codes and amounts (Copy or Download .txt). The paywall is a demo unlock — no real charge.",
    cta: "Start the dispute",
    run: async ({ setDisputeId }) => {
      resetClock();
      (await waitFor('[data-tour="start-dispute"]')).click();
      await waitFor('[data-tour="simulate"]');
      const id = latestDisputeId();
      setDisputeId(id);
      scrollTo(id ? await waitFor(`[data-dispute-id="${id}"]`) : null);
    },
  },
  {
    title: "Dispute tracker",
    body: "The letter is logged as sent. Pro tracks day 30 (follow-up) and day 60 (escalation), with calendar reminders (.ics). Let's jump ahead in time.",
    cta: "Simulate +30 days",
    run: async ({ disputeId }) => {
      (await waitFor('[data-tour="simulate"]')).click();
      const sel = disputeId ? `[data-dispute-id="${disputeId}"] [data-tour="tracker-letter"]` : '[data-tour="tracker-letter"]';
      scrollTo(await waitFor(sel));
    },
  },
  {
    title: "Follow-up due",
    body: "Day 30: status moved to Follow-up due and the follow-up letter is ready to send. Now suppose the hospital agreed to lower the bill.",
    cta: "Resolve the dispute",
    run: async ({ disputeId }) => {
      const scope = disputeId ? `[data-dispute-id="${disputeId}"] ` : "";
      (await waitFor(`${scope}[data-tour="resolve"]`)).click();
      scrollTo(await waitFor(`${scope}form`));
    },
  },
  {
    title: "Record the outcome",
    body: "Type the price the hospital agreed to and press “Save as resolved”. The anonymous result — hospital, state, CPT, prices, winning argument — is added to the shared database.",
    done: ({ disputeId }) => {
      const d = disputeId ? listDisputes().find((x) => x.id === disputeId) : null;
      return d?.status === "resolved" || d?.status === "escalated";
    },
  },
  {
    title: "Hospital leaderboard",
    body: "Every closed dispute feeds this ranking of how often each hospital lowers disputed charges, and the per-code stats shown to the next patient. Demo rows are labeled.",
    cta: "Open the leaderboard",
    run: async ({ push }) => {
      push("/hospitals");
      await waitFor("table, ol, [data-leaderboard]", 15_000).catch(() => null);
    },
  },
  {
    title: "That's the whole loop",
    body: "Bill → findings → letter → tracker → outcome → shared data that helps the next patient. Thanks for taking the tour!",
    cta: "Finish",
  },
];

export function JudgeTour() {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<Saved | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    setState(load());
    const start = () => {
      const s = { step: 0, disputeId: null };
      save(s);
      setError(null);
      setState(s);
    };
    window.addEventListener(TOUR_START_EVENT, start);
    return () => window.removeEventListener(TOUR_START_EVENT, start);
  }, []);

  const update = useCallback((s: Saved | null) => {
    save(s);
    setState(s);
  }, []);

  // Wait-steps advance on their own (e.g. when the dispute is resolved).
  const step = state ? STEPS[state.step] : null;
  useEffect(() => {
    if (!state || !step?.done) return;
    const ctx: Ctx = { push: router.push, disputeId: state.disputeId, setDisputeId: () => {} };
    const t = setInterval(() => {
      if (step.done!(ctx)) update({ ...state, step: state.step + 1 });
    }, 500);
    return () => clearInterval(t);
  }, [state, step, router, update, pathname]);

  // Leave room so the panel never covers the page's last controls.
  useEffect(() => {
    document.body.style.paddingBottom = state ? "13rem" : "";
    return () => {
      document.body.style.paddingBottom = "";
    };
  }, [state]);

  if (!state || !step) return null;

  const next = async () => {
    setError(null);
    if (!step.run) {
      update(state.step + 1 < STEPS.length ? { ...state, step: state.step + 1 } : null);
      return;
    }
    setBusy(true);
    let disputeId = state.disputeId;
    try {
      await step.run({ push: router.push, disputeId, setDisputeId: (id) => (disputeId = id) });
      const alert = $('[role="alert"]');
      if (state.step === 0 && alert && /couldn.t read/i.test(alert.innerText)) {
        setError("Live reading is unavailable right now — enter a few lines by hand, then press “Run the audit”.");
      }
      update({ step: state.step + 1, disputeId });
    } catch {
      setError("That step didn't finish. Press the button again, or continue manually on the page.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-label="Judge tour"
      className="fixed inset-x-0 bottom-0 z-50 px-3 pb-3 sm:px-4 sm:pb-4"
    >
      <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl ring-1 ring-black/5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            Judge tour · step {state.step + 1} of {STEPS.length}
          </p>
          <button type="button" onClick={() => update(null)} className="text-xs text-slate-500 hover:text-slate-900">
            Exit tour
          </button>
        </div>
        <div className="mt-1 h-1 w-full overflow-hidden rounded bg-slate-100">
          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${((state.step + 1) / STEPS.length) * 100}%` }} />
        </div>
        <h2 className="mt-2 font-semibold text-slate-900">{step.title}</h2>
        <p className="mt-1 text-sm text-slate-600">{step.body}</p>
        {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}
        <div className="mt-3 flex items-center gap-3">
          {step.cta ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void next()}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {busy ? (state.step === 0 ? "Reading the bill…" : "Working…") : step.cta}
            </button>
          ) : (
            <p className="text-sm text-emerald-800">Waiting for you to save…</p>
          )}
        </div>
      </div>
    </div>
  );
}
