"use client";

import { useEffect, useRef, useState } from "react";
import { MAX_UPLOAD_FILES, prepareUploads, type UploadFile } from "@/lib/upload";
import { Landing } from "./Landing";
import { SAMPLES } from "@/lib/samples";
import type { HouseholdInput } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { inputClass } from "@/components/ui/Field";
import { HouseholdFields } from "./HouseholdFields";

const PROGRESS = [
  "Reading your bill…",
  "Finding each line item, CPT code and charge…",
  "Checking dates, units and totals…",
  "Almost done — structuring the lines for review…",
];

export const MAX_TEXT = 40000;

function Progress() {
  const [sec, setSec] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSec((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const msg = PROGRESS[Math.min(PROGRESS.length - 1, Math.floor(sec / 7))];
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
      <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" aria-hidden />
      <span>
        {msg} <span className="text-emerald-700/70">({sec}s — this usually takes 10–30 seconds)</span>
      </span>
    </div>
  );
}

function UploadZone({
  files,
  disabled,
  onFiles,
}: {
  files: UploadFile[];
  disabled: boolean;
  onFiles: (f: UploadFile[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);

  const add = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    setError(null);
    setBusy(true);
    try {
      onFiles(await prepareUploads(files, Array.from(list)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read that file.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          if (!disabled) void add(e.dataTransfer.files);
        }}
        className={`flex flex-col items-center gap-2 rounded-xl border-2 border-dashed p-5 text-center transition ${
          drag ? "border-emerald-500 bg-emerald-50" : "border-slate-300 bg-slate-50"
        }`}
      >
        <p className="font-medium text-slate-800">Upload your itemized bill</p>
        <p className="text-sm text-slate-500">PDF or photos of each page (JPEG/PNG), up to {MAX_UPLOAD_FILES} pages</p>
        <input
          ref={inputRef}
          id="bill-files"
          type="file"
          accept="application/pdf,image/*"
          multiple
          className="sr-only"
          disabled={disabled || busy}
          onChange={(e) => void add(e.target.files)}
        />
        <label
          htmlFor="bill-files"
          className={`inline-flex cursor-pointer items-center rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 ${
            disabled || busy ? "pointer-events-none opacity-50" : ""
          }`}
        >
          {busy ? "Preparing…" : files.length ? "Add more pages" : "Choose PDF or photos"}
        </label>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-rose-600">
          {error}
        </p>
      ) : null}
      {files.length ? (
        <ul className="space-y-1">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-slate-200">
              <span className="min-w-0 truncate">
                {f.mediaType === "application/pdf" ? "📄" : "🖼️"} {f.name}{" "}
                <span className="text-slate-400">({f.sizeKb} KB)</span>
              </span>
              <button
                type="button"
                className="shrink-0 text-slate-500 hover:text-rose-600"
                aria-label={`Remove ${f.name}`}
                disabled={disabled}
                onClick={() => onFiles(files.filter((_, j) => j !== i))}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function InputStep({
  files,
  onFiles,
  onTour,
  text,
  household,
  loading,
  onText,
  onHousehold,
  onSample,
  onSubmit,
  onManual,
  onCancel,
}: {
  files: UploadFile[];
  onFiles: (f: UploadFile[]) => void;
  onTour?: () => void;
  text: string;
  household: HouseholdInput;
  loading: boolean;
  onText: (t: string) => void;
  onHousehold: (h: HouseholdInput) => void;
  onSample: (id: "A" | "B") => void;
  onSubmit: () => void;
  onManual: () => void;
  onCancel: () => void;
}) {
  const hasHousehold = household.annualIncome !== null || household.householdSize !== null || household.state !== null;
  const tooLong = text.length > MAX_TEXT;
  return (
    <div className="space-y-6">
      <Landing onTour={loading ? undefined : onTour} />

      <Card className="scroll-mt-20 space-y-4" id="check-form">
        <UploadZone files={files} disabled={loading} onFiles={onFiles} />
        <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-slate-400" aria-hidden>
          <span className="h-px flex-1 bg-slate-200" /> or paste text <span className="h-px flex-1 bg-slate-200" />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <label htmlFor="bill-text" className="text-sm font-medium text-slate-700">
            Paste the bill text
          </label>
          <div className="flex flex-wrap gap-2">
            {SAMPLES.map((s) => (
              <Button key={s.id} variant="secondary" size="sm" disabled={loading} onClick={() => onSample(s.id)} title={s.label} data-tour={`sample-${s.id}`}>
                Try Sample {s.id} ({s.id === "A" ? "ER visit" : "outpatient"})
              </Button>
            ))}
          </div>
        </div>
        <textarea
          id="bill-text"
          rows={files.length ? 4 : 10}
          className={`${inputClass} font-mono text-xs sm:text-sm`}
          placeholder={"Date | CPT | Description | Units | Charge\n03/14/2026 | 70450 | CT head without contrast | 1 | $1,980.00\n…"}
          value={text}
          disabled={loading || files.length > 0}
          onChange={(e) => onText(e.target.value)}
          aria-describedby="bill-text-hint"
        />
        <p id="bill-text-hint" className={`text-xs ${tooLong ? "text-rose-600" : "text-slate-500"}`}>
          {tooLong
            ? `That's ${text.length.toLocaleString()} characters — please trim to ${MAX_TEXT.toLocaleString()} (just the line items are enough).`
            : files.length
              ? "Your uploaded pages will be read instead of this text. Remove the files to paste text."
              : "Copy the text from your itemized statement (with dates, CPT codes and charges). Remove your name and account number if you like — we don't need them."}
        </p>

        <details className="group rounded-lg border border-slate-200 p-3" open={hasHousehold || undefined}>
          <summary className="cursor-pointer select-none text-sm font-medium text-slate-700">
            Charity care check <span className="font-normal text-slate-500">(optional)</span>
          </summary>
          <p className="mb-3 mt-2 text-xs text-slate-500">
            Nonprofit hospitals must offer financial assistance. We compare your income with the 2026 federal poverty
            guidelines. Nothing leaves your browser.
          </p>
          <HouseholdFields value={household} onChange={onHousehold} idPrefix="in" />
        </details>

        {loading ? (
          <div className="space-y-2">
            <Progress />
            <Button variant="ghost" size="sm" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button size="lg" data-tour="check" onClick={onSubmit} disabled={files.length === 0 && (!text.trim() || tooLong)}>
              Check my bill
            </Button>
            <Button variant="ghost" onClick={onManual}>
              Enter lines manually instead
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
