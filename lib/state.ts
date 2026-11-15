// Persisted draft of the bill-check flow (localStorage, SSR-safe, all access in try/catch).
import type { BillLine, HouseholdInput } from "./types";
import { EMPTY_GFE, type GfeInput } from "./audit/gfe";

export const DRAFT_KEY = "bc.draft.v1";

export type FlowStep = "input" | "lines" | "result";

/** A table row as typed by the user. Numbers stay strings until "Run audit". */
export type EditableLine = {
  id: string;
  dateOfService: string; // yyyy-mm-dd or ""
  cpt: string;
  modifiers: string; // comma/space separated
  description: string;
  units: string;
  charge: string;
};

export type Draft = {
  step: FlowStep;
  text: string;
  household: HouseholdInput;
  /** No Surprises Act Good Faith Estimate (uninsured / self-pay). */
  gfe: GfeInput;
  hospitalState: string; // where the hospital is; used for the outcomes DB
  provider: string;
  rows: EditableLine[];
  dropped: { index: number; reason: string }[];
  extractError: string | null;
  /** Lines committed by "Run audit" — the result screen audits exactly these. */
  auditedLines: BillLine[] | null;
};

export const EMPTY_HOUSEHOLD: HouseholdInput = { householdSize: null, annualIncome: null, state: null };

export function emptyDraft(): Draft {
  return {
    step: "input",
    text: "",
    household: { ...EMPTY_HOUSEHOLD },
    gfe: { ...EMPTY_GFE },
    hospitalState: "",
    provider: "",
    rows: [],
    dropped: [],
    extractError: null,
    auditedLines: null,
  };
}

export function newId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  } catch {
    // fall through
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function emptyRow(): EditableLine {
  return { id: newId(), dateOfService: "", cpt: "", modifiers: "", description: "", units: "1", charge: "" };
}

export function lineToRow(l: Omit<BillLine, "id"> & { id?: string }): EditableLine {
  return {
    id: l.id ?? newId(),
    dateOfService: l.dateOfService ?? "",
    cpt: l.cpt ?? "",
    modifiers: (l.modifiers ?? []).join(", "),
    description: l.description ?? "",
    units: String(l.units ?? 1),
    charge: Number.isFinite(l.charge) ? String(l.charge) : "",
  };
}

export function parseMoney(s: string): number | null {
  const cleaned = s.replace(/[$,\s]/g, "");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export type RowErrors = Partial<Record<"description" | "units" | "charge" | "cpt" | "dateOfService", string>>;

export function validateRow(r: EditableLine): RowErrors {
  const e: RowErrors = {};
  if (!r.description.trim() && !r.cpt.trim()) e.description = "Add a description or CPT code";
  const units = Number(r.units.trim() === "" ? "1" : r.units);
  if (!Number.isFinite(units) || units <= 0) e.units = "Units must be a positive number";
  const charge = parseMoney(r.charge);
  if (charge === null) e.charge = "Enter the line charge";
  else if (charge < 0) e.charge = "Charge can't be negative";
  if (r.cpt.trim() && !/^[A-Za-z0-9]{5}$/.test(r.cpt.trim())) e.cpt = "CPT/HCPCS codes have 5 characters";
  if (r.dateOfService.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(r.dateOfService.trim())) e.dateOfService = "Use yyyy-mm-dd";
  return e;
}

export function rowToLine(r: EditableLine): BillLine {
  const units = Number(r.units.trim() === "" ? "1" : r.units);
  return {
    id: r.id,
    dateOfService: r.dateOfService.trim() || null,
    cpt: r.cpt.trim() ? r.cpt.trim().toUpperCase() : null,
    modifiers: r.modifiers
      .split(/[,\s]+/)
      .map((m) => m.trim().toUpperCase())
      .filter(Boolean),
    description: r.description.trim() || (r.cpt.trim() ? `CPT ${r.cpt.trim().toUpperCase()}` : ""),
    units: Number.isFinite(units) && units > 0 ? units : 1,
    charge: parseMoney(r.charge) ?? 0,
  };
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

export function loadDraft(): Draft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isObj(parsed)) return null;
    const base = emptyDraft();
    const d = { ...base, ...(parsed as Partial<Draft>) };
    if (!["input", "lines", "result"].includes(d.step)) d.step = "input";
    if (!Array.isArray(d.rows)) d.rows = [];
    if (!Array.isArray(d.dropped)) d.dropped = [];
    if (!isObj(d.household)) d.household = { ...EMPTY_HOUSEHOLD };
    if (!isObj(d.gfe)) d.gfe = { ...EMPTY_GFE };
    if (d.auditedLines !== null && !Array.isArray(d.auditedLines)) d.auditedLines = null;
    if (d.step === "result" && !d.auditedLines) d.step = d.rows.length ? "lines" : "input";
    if (typeof d.text !== "string") d.text = "";
    if (typeof d.provider !== "string") d.provider = "";
    if (typeof d.hospitalState !== "string") d.hospitalState = "";
    return d;
  } catch {
    return null;
  }
}

export function saveDraft(d: Draft): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
  } catch {
    // quota / blocked storage — the flow keeps working in memory
  }
}

export function clearDraft(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}
