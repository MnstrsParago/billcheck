import { useSyncExternalStore } from "react";

// Demo-only "Pro" flag. No real payment: the paywall's Upgrade button calls setPro(true).
export const PRO_KEY = "bc.pro";
const EVENT = "bc:pro-change";

export function isPro(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(PRO_KEY) === "true";
  } catch {
    return false;
  }
}

export function setPro(value: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (value) window.localStorage.setItem(PRO_KEY, "true");
    else window.localStorage.removeItem(PRO_KEY);
  } catch {
    // storage blocked (private mode etc.) — the in-memory fallback below still unlocks this session
  }
  memoryPro = value;
  window.dispatchEvent(new Event(EVENT));
}

// If localStorage is unavailable, keep the unlock for the current page session.
let memoryPro: boolean | null = null;

function snapshot(): boolean {
  return isPro() || memoryPro === true;
}

function subscribe(onChange: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === PRO_KEY) onChange();
  };
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** React hook: true once the demo Pro unlock is active. Always false during SSR. */
export function usePro(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}
