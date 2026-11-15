import * as z from "zod/v4";
import type { ExtractedBill, ExtractedLine } from "@/lib/types";

export const MAX_TEXT_CHARS = 40_000;

/** Uploads: up to 6 files, ~4.2M base64 chars in total (Vercel body limit is 4.5 MB). */
export const MAX_FILES = 6;
export const MAX_FILES_BASE64_CHARS = 4_200_000;
export const UPLOAD_MEDIA_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;
export type UploadMediaType = (typeof UPLOAD_MEDIA_TYPES)[number];

const TextRequest = z.strictObject({
  text: z
    .string({ error: "Missing bill text" })
    .trim()
    .min(1, "Bill text is empty")
    .max(MAX_TEXT_CHARS, `Bill text is too long (max ${MAX_TEXT_CHARS.toLocaleString("en-US")} characters)`),
});

const FileSchema = z.strictObject({
  mediaType: z.enum(UPLOAD_MEDIA_TYPES, { error: "Only PDF, JPEG, PNG or WebP files are supported" }),
  data: z
    .string()
    .min(16, "File is empty")
    .regex(/^[A-Za-z0-9+/]+={0,2}$/, "File data must be base64"),
});

const FilesRequest = z.strictObject({
  files: z
    .array(FileSchema)
    .min(1, "No file uploaded")
    .max(MAX_FILES, `Upload at most ${MAX_FILES} files`)
    .refine((fs) => fs.reduce((n, f) => n + f.data.length, 0) <= MAX_FILES_BASE64_CHARS, {
      message: "Files are too large (max about 3 MB in total). Try fewer pages or smaller photos.",
    })
    .refine((fs) => fs.filter((f) => f.mediaType === "application/pdf").length <= 1, {
      message: "Upload one PDF at a time",
    }),
});

/** Request body for POST /api/extract: either pasted text or uploaded PDF/photos. */
export const ExtractRequestSchema = z.union([TextRequest, FilesRequest], { error: "Send bill text or a PDF/photo" });
export type ExtractRequest = z.infer<typeof ExtractRequestSchema>;

/**
 * Loose schema sent to Claude as the structured-output format.
 * Deliberately permissive (nullable numbers etc.) so the SDK-level parse rarely fails;
 * strict per-line validation happens afterwards in normalizeBill().
 */
export const LlmLineSchema = z.object({
  dateOfService: z.string().nullable(),
  cpt: z.string().nullable(),
  modifiers: z.array(z.string()),
  description: z.string(),
  units: z.number().nullable(),
  charge: z.number().nullable(),
});

export const LlmBillSchema = z.object({
  provider: z.string().nullable(),
  providerState: z.string().nullable(),
  patientBalance: z.number().nullable(),
  totalCharges: z.number().nullable(),
  lines: z.array(LlmLineSchema),
});

export type LlmBill = z.infer<typeof LlmBillSchema>;

const US_STATES = new Set(
  (
    "AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND " +
    "OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY PR GU VI AS MP"
  ).split(" "),
);

const CPT_RE = /^[A-Z0-9]{5}$/;
const MODIFIER_RE = /^[A-Z0-9]{2}$/;
const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Parse a number that may arrive as a number or a money-ish string ("$1,234.50"). */
export function toNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const cleaned = v.replace(/[$,\s]/g, "");
    if (cleaned === "" || !/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Round to cents to avoid float noise like 1234.5000000001. */
function cents(n: number): number {
  return Math.round(n * 100) / 100;
}

export function normalizeCpt(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim().toUpperCase();
  return CPT_RE.test(s) ? s : null;
}

export function normalizeDate(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  const m = ISO_DATE_RE.exec(s);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  if (y < 1900 || y > 2100) return null;
  return s;
}

export function normalizeModifiers(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const m of v) {
    if (typeof m !== "string") continue;
    const s = m.trim().toUpperCase();
    if (MODIFIER_RE.test(s) && !out.includes(s)) out.push(s);
  }
  return out;
}

export function normalizeState(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim().toUpperCase();
  return US_STATES.has(s) ? s : null;
}

function normalizeMoney(v: unknown): number | null {
  const n = toNumber(v);
  return n !== null && n >= 0 ? cents(n) : null;
}

function normalizeText(v: unknown, max = 500): string | null {
  if (typeof v !== "string") return null;
  const s = v.replace(/\s+/g, " ").trim();
  return s ? s.slice(0, max) : null;
}

export type LineResult = { ok: true; line: ExtractedLine } | { ok: false; reason: string };

/** Strictly validate and normalize one raw line from the model. */
export function normalizeLine(raw: unknown): LineResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, reason: "Line is not an object" };
  }
  const r = raw as Record<string, unknown>;

  const description = normalizeText(r.description);
  if (!description) return { ok: false, reason: "Missing description" };

  const charge = toNumber(r.charge);
  if (charge === null) return { ok: false, reason: "Missing or non-numeric charge" };
  if (charge < 0) return { ok: false, reason: "Negative charge (credit/adjustment)" };

  let units = 1;
  if (r.units !== null && r.units !== undefined) {
    const u = toNumber(r.units);
    if (u === null || !Number.isInteger(u) || u <= 0) {
      return { ok: false, reason: "Units must be a positive whole number" };
    }
    units = u;
  }

  return {
    ok: true,
    line: {
      dateOfService: normalizeDate(r.dateOfService),
      cpt: normalizeCpt(r.cpt),
      modifiers: normalizeModifiers(r.modifiers),
      description,
      units,
      charge: cents(charge),
    },
  };
}

export type NormalizedBill = {
  bill: ExtractedBill;
  dropped: { index: number; reason: string }[];
};

/** Normalize the whole (loosely-typed) model output into an ExtractedBill. */
export function normalizeBill(raw: unknown): NormalizedBill {
  const r = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const rawLines = Array.isArray(r.lines) ? r.lines : [];

  const lines: ExtractedLine[] = [];
  const dropped: { index: number; reason: string }[] = [];
  rawLines.forEach((l, index) => {
    const res = normalizeLine(l);
    if (res.ok) lines.push(res.line);
    else dropped.push({ index, reason: res.reason });
  });

  return {
    bill: {
      provider: titleCaseIfShouting(normalizeText(r.provider, 200)),
      providerState: normalizeState(r.providerState),
      patientBalance: normalizeMoney(r.patientBalance),
      totalCharges: normalizeMoney(r.totalCharges),
      lines,
    },
    dropped,
  };
}

const SMALL_WORDS = new Set(["of", "and", "the", "at", "in", "for", "on"]);

/** "RIVERSIDE GENERAL HOSPITAL" -> "Riverside General Hospital". Mixed-case names are kept as printed. */
export function titleCaseIfShouting(name: string | null): string | null {
  if (!name || name !== name.toUpperCase() || !/[A-Z]/.test(name)) return name;
  return name
    .toLowerCase()
    .split(" ")
    .map((w, i) => (i > 0 && SMALL_WORDS.has(w) ? w : w.replace(/(^|[-.(])([a-z])/g, (_, p, c) => p + c.toUpperCase())))
    .join(" ");
}
