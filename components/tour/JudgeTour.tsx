"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { resetClock } from "@/lib/tracker/clock";
import { listDisputes } from "@/lib/tracker/store";
import { formatUSD, runAudit } from "@/lib/audit";
import { loadDraft } from "@/lib/state";
import type { Finding } from "@/lib/types";

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
}

function latestDisputeId(): string | null {
  const ds = listDisputes();
  if (!ds.length) return null;
  return [...ds].sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))[0].id;
}

type Ctx = { push: (href: string) => void; disputeId: string | null; setDisputeId: (id: string | null) => void };

/** Live numbers from the current audit, so every step talks about this bill — nothing is hardcoded. */
type Facts = {
  rows: number;
  provider: string;
  total: number | null;
  count: number;
  dup: Finding | null;
  over: Finding | null;
  saved: number | null;
};

function readFacts(disputeId: string | null): Facts {
  const d = loadDraft();
  const audit = d?.auditedLines ? runAudit(d.auditedLines, d.household) : null;
  const findings = audit?.findings ?? [];
  const dup = findings.find((f) => f.type === "duplicate") ?? null;
  // A second example that is not the same item as the duplicate, so the two sentences don't repeat.
  const prices = findings
    .filter((f) => f.type === "above_medicare")
    .sort((a, b) => (b.multiple ?? 0) - (a.multiple ?? 0));
  const over = prices.find((f) => !dup || f.cpt !== dup.cpt) ?? prices[0] ?? null;
  const dispute = disputeId ? listDisputes().find((x) => x.id === disputeId) : null;
  return {
    rows: d?.rows.length ?? 0,
    provider: d?.provider?.trim() || "the hospital",
    total: audit ? audit.totalDisputable : null,
    count: findings.length,
    dup,
    over,
    saved: dispute?.status === "resolved" ? (dispute.savedAmount ?? 0) : null,
  };
}

const money = (n: number) => formatUSD(Math.round(n)).replace(/\.00$/, "");
const item = (f: Finding) => f.description.split(/[,/(&]/)[0].trim().split(/\s+/).slice(0, 3).join(" ") || `code ${f.cpt ?? ""}`;

type Text = string | ((f: Facts) => string);
const show = (t: Text, f: Facts) => (typeof t === "function" ? t(f) : t);

type Step = {
  title: Text;
  body: Text;
  cta?: string;
  run?: (c: Ctx) => Promise<void>;
  /** Steps without a CTA advance when this returns true. */
  done?: (c: Ctx) => boolean;
};

const STEPS: Step[] = [
  {
    title: "Load a sample ER bill.",
    body: "",
    cta: "Load sample",
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
    title: (f) => (f.rows ? `AI found ${f.rows} charges.` : "Here are the charges."),
    body: "",
    cta: "Check bill",
    run: async () => {
      (await waitFor('[data-tour="run-audit"]')).click();
      scrollTo(await waitFor('[data-tour="findings"]'));
    },
  },
  {
    title: (f) =>
      f.total === null
        ? "Here is what we found."
        : `${money(f.total)} to dispute.${f.dup ? ` ${item(f.dup)} billed twice.` : ""}`,
    body: "",
    cta: "Get letter",
    run: async () => {
      $('[data-tour="get-letter"]')?.click();
      (await waitFor('[data-tour="upgrade"], [data-tour="dispute-letter"]')).dataset.tour === "upgrade" &&
        $('[data-tour="upgrade"]')?.click();
      scrollTo(await waitFor('[data-tour="dispute-letter"]'));
    },
  },
  {
    title: "Your letter is ready.",
    body: "",
    cta: "Start dispute",
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
    title: "We remind you on day 30.",
    body: "",
    cta: "Skip 30 days",
    run: async ({ disputeId }) => {
      (await waitFor('[data-tour="simulate"]')).click();
      const scope = disputeId ? `[data-dispute-id="${disputeId}"] ` : "";
      if (!$(`${scope}[data-tour="show-letter"]`)) (await waitFor(`${scope}[data-tour="more"]`)).click();
      (await waitFor(`${scope}[data-tour="show-letter"]`)).click();
      const sel = `${scope}[data-tour="tracker-letter"]`;
      scrollTo(await waitFor(sel));
    },
  },
  {
    title: "Day 30: follow-up letter ready.",
    body: "",
    cta: "Record result",
    run: async ({ disputeId }) => {
      const scope = disputeId ? `[data-dispute-id="${disputeId}"] ` : "";
      (await waitFor(`${scope}[data-tour="resolve"]`)).click();
      scrollTo(await waitFor(`${scope}form`));
    },
  },
  {
    title: "Enter new prices, then press Save.",
    body: "",
    done: ({ disputeId }) => {
      const d = disputeId ? listDisputes().find((x) => x.id === disputeId) : null;
      return d?.status === "resolved" || d?.status === "escalated";
    },
  },
  {
    title: (f) => (f.saved !== null ? `You saved ${money(f.saved)}. Added to ratings.` : "Added to hospital ratings."),
    body: "",
    cta: "See ratings",
    run: async ({ push }) => {
      push("/hospitals");
      await waitFor("table, ol, [data-leaderboard]", 15_000).catch(() => null);
    },
  },
  {
    title: "Done. That's BillCheck.",
    body: "",
    cta: "Done",
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
  const facts = readFacts(state.disputeId);

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
      <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs tabular-nums text-slate-400">
            Tour {state.step + 1}/{STEPS.length}
          </p>
          <button type="button" onClick={() => update(null)} className="text-xs text-slate-400 underline underline-offset-4">
            Exit
          </button>
        </div>
        <h2 className="mt-1 text-lg font-medium text-slate-900">{show(step.title, facts)}</h2>
        {show(step.body, facts) ? <p className="mt-1 text-[15px] text-slate-600">{show(step.body, facts)}</p> : null}
        {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}
        <div className="mt-3 flex items-center gap-3">
          {step.cta ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void next()}
              className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
            >
              {busy ? (state.step === 0 ? "Reading the bill…" : "Working…") : step.cta}
            </button>
          ) : (
            <p className="text-sm text-slate-400">Waiting…</p>
          )}
        </div>
      </div>
    </div>
  );
}
