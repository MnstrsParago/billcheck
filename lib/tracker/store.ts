// localStorage-backed dispute store. Every access is guarded; SSR-safe.

import { useSyncExternalStore } from "react";
import type { Dispute, DisputeEvent, DisputeLine, Finding, WinningArgument } from "@/lib/types";
import { getNow, getOffsetDays, subscribeClock } from "./clock";
import { computeStatus } from "./status";

export const DISPUTES_KEY = "bc.disputes";
const DISPUTES_EVENT = "bc:disputes";

const round2 = (n: number) => Math.round(n * 100) / 100;

function readRaw(): string {
  try {
    if (typeof window === "undefined") return "[]";
    return window.localStorage.getItem(DISPUTES_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

function parse(raw: string): Dispute[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? (v.filter((d) => d && typeof d.id === "string") as Dispute[]) : [];
  } catch {
    return [];
  }
}

function writeAll(list: Dispute[]): void {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(DISPUTES_KEY, JSON.stringify(list));
  } catch {
    // quota / disabled storage: nothing we can do
  }
  try {
    window.dispatchEvent(new Event(DISPUTES_EVENT));
  } catch {
    // ignore
  }
}

/** Stored disputes with `status` recomputed against the virtual clock. */
function withLiveStatus(list: Dispute[], now: Date): Dispute[] {
  return list.map((d) => {
    const status = computeStatus(d, now);
    return status === d.status ? d : { ...d, status };
  });
}

export function listDisputes(): Dispute[] {
  return withLiveStatus(parse(readRaw()), getNow());
}

export function getDispute(id: string): Dispute | null {
  return listDisputes().find((d) => d.id === id) ?? null;
}

function newId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  } catch {
    // fall through
  }
  return `d_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export type CreateDisputeInput = {
  provider: string;
  state: string | null;
  billTotal: number;
  findings: Finding[];
  kind?: Dispute["kind"];
  ppdr?: Dispute["ppdr"];
  demo?: boolean;
};

export function createDispute(input: CreateDisputeInput): Dispute {
  const at = getNow().toISOString();
  const lines: DisputeLine[] = [];
  const seen = new Set<string>();
  for (const f of input.findings) {
    if (seen.has(f.lineId)) continue; // one dispute line per bill line
    seen.add(f.lineId);
    lines.push({
      lineId: f.lineId,
      cpt: f.cpt,
      description: f.description,
      originalPrice: f.charge,
      argument: f.type,
    });
  }
  const dispute: Dispute = {
    id: newId(),
    provider: input.provider.trim() || "Unknown provider",
    state: input.state,
    amountDisputed: round2(input.findings.reduce((s, f) => s + (f.disputeAmount || 0), 0)),
    billTotal: input.billTotal,
    startedAt: at,
    status: "letter_sent",
    events: [{ at, type: "letter_sent" }],
    lines,
    findings: input.findings,
    ...(input.kind ? { kind: input.kind } : {}),
    ...(input.ppdr ? { ppdr: input.ppdr } : {}),
    ...(input.demo ? { demo: true } : {}),
  };
  writeAll([dispute, ...parse(readRaw())]);
  return dispute;
}

export function updateDispute(
  id: string,
  patch: Partial<Dispute> | ((d: Dispute) => Dispute),
): Dispute | null {
  const list = parse(readRaw());
  const i = list.findIndex((d) => d.id === id);
  if (i < 0) return null;
  const next = typeof patch === "function" ? patch(list[i]) : { ...list[i], ...patch, id };
  list[i] = next;
  writeAll(list);
  const status = computeStatus(next, getNow());
  return status === next.status ? next : { ...next, status };
}

export function deleteDispute(id: string): void {
  writeAll(parse(readRaw()).filter((d) => d.id !== id));
}

function event(type: DisputeEvent["type"], note?: string): DisputeEvent {
  return note ? { at: getNow().toISOString(), type, note } : { at: getNow().toISOString(), type };
}

export function markFollowUpSent(id: string): Dispute | null {
  return updateDispute(id, (d) => ({ ...d, events: [...d.events, event("follow_up_sent")] }));
}

export function markPpdrFiled(id: string): Dispute | null {
  return updateDispute(id, (d) => ({ ...d, events: [...d.events, event("ppdr_filed")] }));
}

/** Close an itemized-bill request once the bill arrives (nothing to share: no prices were disputed). */
export function markItemizedReceived(id: string): Dispute | null {
  return updateDispute(id, (d) => {
    const at = getNow().toISOString();
    return {
      ...d,
      status: "resolved",
      savedAmount: 0,
      closedAt: at,
      outcomeShared: true,
      events: [...d.events, { at, type: "itemized_received" }],
    };
  });
}

export type LineResolution = { finalPrice: number; argument: WinningArgument };

/** Close as Resolved. finalPrice is clamped to [0, originalPrice]. */
export function resolveDispute(id: string, resolutions: Record<string, LineResolution>): Dispute | null {
  return updateDispute(id, (d) => {
    if (d.status === "resolved" || d.status === "escalated") return d; // already closed (double click)
    const lines = d.lines.map((l) => {
      const r = resolutions[l.lineId];
      const raw = r && Number.isFinite(r.finalPrice) ? r.finalPrice : l.originalPrice;
      const finalPrice = round2(Math.min(l.originalPrice, Math.max(0, raw)));
      return { ...l, finalPrice, argument: r?.argument ?? l.argument };
    });
    const savedAmount = round2(lines.reduce((s, l) => s + (l.originalPrice - (l.finalPrice ?? l.originalPrice)), 0));
    const at = getNow().toISOString();
    return {
      ...d,
      lines,
      savedAmount,
      status: "resolved",
      closedAt: at,
      outcomeShared: false,
      events: [...d.events, { at, type: "resolved", note: `Saved $${savedAmount.toFixed(2)}` }],
    };
  });
}

/** Close as Escalated: provider did not concede, final = original. */
export function escalateDispute(id: string): Dispute | null {
  return updateDispute(id, (d) => {
    if (d.status === "resolved" || d.status === "escalated") return d;
    const at = getNow().toISOString();
    return {
      ...d,
      lines: d.lines.map((l) => ({ ...l, finalPrice: l.originalPrice })),
      savedAmount: 0,
      status: "escalated",
      closedAt: at,
      outcomeShared: false,
      events: [...d.events, { at, type: "escalated" }],
    };
  });
}

export function setOutcomeShared(id: string, shared: boolean): Dispute | null {
  return updateDispute(id, { outcomeShared: shared });
}

/** Sum of savedAmount over resolved disputes. */
export function savedSoFar(disputes: Dispute[] = listDisputes()): number {
  return round2(
    disputes.reduce((s, d) => s + (d.status === "resolved" ? d.savedAmount ?? 0 : 0), 0),
  );
}

function subscribe(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === DISPUTES_KEY) cb();
  };
  window.addEventListener(DISPUTES_EVENT, cb);
  window.addEventListener("storage", onStorage);
  const unClock = subscribeClock(cb);
  return () => {
    window.removeEventListener(DISPUTES_EVENT, cb);
    window.removeEventListener("storage", onStorage);
    unClock();
  };
}

// Snapshot cache: useSyncExternalStore needs a stable reference per state.
let cacheKey = "";
let cacheVal: Dispute[] = [];
function getSnapshot(): Dispute[] {
  const raw = readRaw();
  const offset = getOffsetDays();
  // Status depends on the day; include the current virtual day in the key.
  const day = Math.floor(getNow().getTime() / 86_400_000);
  const key = `${offset}|${day}|${raw}`;
  if (key !== cacheKey) {
    cacheKey = key;
    cacheVal = withLiveStatus(parse(raw), getNow());
  }
  return cacheVal;
}
const EMPTY: Dispute[] = [];
const getServerSnapshot = () => EMPTY;

/** React hook: all disputes (live status), re-renders on change incl. other tabs and clock changes. */
export function useDisputes(): Dispute[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
