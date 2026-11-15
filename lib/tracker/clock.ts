// Virtual clock for the dispute tracker. Real time + a day offset stored in
// localStorage, so the jury demo can "Simulate +30 days" without waiting.
// SSR-safe: no window access at module top level.

import { useSyncExternalStore } from "react";

export const CLOCK_KEY = "bc.clockOffsetDays";
const CLOCK_EVENT = "bc:clock";
export const DAY_MS = 86_400_000;

export function getOffsetDays(): number {
  try {
    if (typeof window === "undefined") return 0;
    const raw = window.localStorage.getItem(CLOCK_KEY);
    const n = raw == null ? 0 : Number(raw);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function setOffsetDays(n: number): void {
  try {
    if (typeof window === "undefined") return;
    if (n === 0) window.localStorage.removeItem(CLOCK_KEY);
    else window.localStorage.setItem(CLOCK_KEY, String(n));
  } catch {
    // storage unavailable: clock stays at real time
  }
  try {
    window.dispatchEvent(new Event(CLOCK_EVENT));
  } catch {
    // ignore
  }
}

/** Real now + virtual offset. */
export function getNow(): Date {
  return new Date(Date.now() + getOffsetDays() * DAY_MS);
}

export function simulateDays(n: number): void {
  setOffsetDays(getOffsetDays() + n);
}

export function resetClock(): void {
  setOffsetDays(0);
}

/** Subscribe to clock changes (this tab and other tabs). Returns unsubscribe. */
export function subscribeClock(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === CLOCK_KEY) cb();
  };
  window.addEventListener(CLOCK_EVENT, cb);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CLOCK_EVENT, cb);
    window.removeEventListener("storage", onStorage);
  };
}

/** React hook: current offset in days (0 on the server). */
export function useClockOffset(): number {
  return useSyncExternalStore(subscribeClock, getOffsetDays, () => 0);
}

/** React hook: virtual "now", re-rendered when the offset changes. */
export function useNow(): Date {
  const offset = useClockOffset();
  return new Date(Date.now() + offset * DAY_MS);
}
