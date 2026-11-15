"use client";

import { useEffect, useRef, useState } from "react";
import { MAX_UPLOAD_FILES, prepareUploads, type UploadFile } from "@/lib/upload";
import type { HouseholdInput } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { inputClass } from "@/components/ui/Field";
import { Landing } from "./Landing";
import { SummaryBillRequest } from "./SummaryBillRequest";

const PROGRESS = [
  "Reading your bill…",
  "Finding every charge…",
  "Checking dates and amounts…",
  "Almost done…",
];

export const MAX_TEXT = 40000;

function Progress({ onCancel }: { onCancel: () => void }) {
  const [sec, setSec] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSec((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const msg = PROGRESS[Math.min(PROGRESS.length - 1, Math.floor(sec / 5))];
  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center gap-3 py-6 text-center">
      <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-emerald-600 border-t-transparent" aria-hidden />
      <p className="text-lg font-medium text-slate-900">{msg}</p>
      <p className="text-sm text-slate-500">Usually under a minute.</p>
      <button type="button" onClick={onCancel} className="text-sm text-slate-500 underline-offset-4 hover:underline">
        Cancel
      </button>
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
      setError(e instanceof Error ? e.message : "We couldn't read that file.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-3">
      <label
        htmlFor="bill-files"
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
        className={`flex cursor-pointer flex-col items-center gap-3 rounded-3xl px-6 py-10 text-center transition sm:py-14 ${
          drag ? "bg-emerald-50 ring-2 ring-emerald-500" : "bg-slate-50 hover:bg-slate-100"
        } ${disabled || busy ? "pointer-events-none opacity-60" : ""}`}
      >
        <span aria-hidden className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-2xl shadow-sm">
          ↑
        </span>
        <span className="text-lg font-semibold text-slate-900">
          {busy ? "Preparing…" : files.length ? "Add more pages" : "Upload your bill"}
        </span>
        <span className="text-sm text-slate-500">PDF or photos of each page · up to {MAX_UPLOAD_FILES} pages</span>
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
      </label>
      {error ? (
        <p role="alert" className="text-center text-sm text-rose-600">
          {error}
        </p>
      ) : null}
      {files.length ? (
        <ul className="space-y-2">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm">
              <span className="min-w-0 truncate text-slate-800">
                {f.mediaType === "application/pdf" ? "📄" : "🖼️"} {f.name}
              </span>
              <button
                type="button"
                className="shrink-0 text-slate-400 hover:text-rose-600"
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
  loading,
  onText,
  onTrySample,
  onSubmit,
  onManual,
  onCancel,
  error,
}: {
  files: UploadFile[];
  onFiles: (f: UploadFile[]) => void;
  onTour?: () => void;
  text: string;
  household: HouseholdInput;
  loading: boolean;
  onText: (t: string) => void;
  onHousehold: (h: HouseholdInput) => void;
  /** Load a sample bill and check it right away. */
  onTrySample: (id: "A" | "B") => void;
  onSubmit: () => void;
  onManual: () => void;
  onCancel: () => void;
  /** A problem with what was sent (not a medical bill, too large…), shown on the first screen. */
  error?: string | null;
}) {
  const [pasteOpen, setPasteOpen] = useState(text.trim().length > 0);
  const tooLong = text.length > MAX_TEXT;
  const ready = files.length > 0 || (text.trim().length > 0 && !tooLong);

  return (
    <div className="space-y-24 sm:space-y-32">
      {/* First screen: the problem, the upload, a sample. */}
      <section id="check-form" className="mx-auto max-w-2xl scroll-mt-24 space-y-8 pt-2 sm:pt-8">
        <div className="space-y-4 text-center">
          <h1 className="text-balance text-[2.5rem] font-semibold leading-[1.05] tracking-tight text-slate-900 sm:text-6xl">
            Hospital bills are often wrong.
          </h1>
          <p className="text-balance text-lg text-slate-500 sm:text-xl">
            Upload your bill. See what you shouldn&apos;t pay.
          </p>
        </div>

        {loading ? (
          <Progress onCancel={onCancel} />
        ) : (
          <>
            {error ? (
              <p role="alert" className="rounded-2xl bg-rose-50 px-5 py-4 text-center text-rose-700">
                {error}
              </p>
            ) : null}
            <UploadZone files={files} disabled={loading} onFiles={onFiles} />

            {pasteOpen && files.length === 0 ? (
              <div className="space-y-2">
                <label htmlFor="bill-text" className="text-sm font-medium text-slate-700">
                  Paste the text of your bill
                </label>
                <textarea
                  id="bill-text"
                  rows={7}
                  className={`${inputClass} font-mono text-sm`}
                  placeholder={"03/14/2026  70450  CT head  1  $1,980.00\n…"}
                  value={text}
                  onChange={(e) => onText(e.target.value)}
                />
                {tooLong ? (
                  <p className="text-sm text-rose-600">
                    That&apos;s too long. Please paste only the list of charges (max {MAX_TEXT.toLocaleString()} characters).
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="flex flex-col items-center gap-4">
              {ready ? (
                <Button size="lg" data-tour="check" onClick={onSubmit} className="w-full sm:w-auto">
                  Check my bill
                </Button>
              ) : (
                <Button
                  size="lg"
                  variant="secondary"
                  data-tour="sample-A"
                  onClick={() => onTrySample("A")}
                  className="w-full sm:w-auto"
                >
                  Try a sample bill
                </Button>
              )}
              <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-slate-500">
                {files.length === 0 && !pasteOpen ? (
                  <button type="button" className="underline-offset-4 hover:text-slate-900 hover:underline" onClick={() => setPasteOpen(true)}>
                    Paste text instead
                  </button>
                ) : null}
                {ready ? (
                  <button
                    type="button"
                    data-tour="sample-A"
                    className="underline-offset-4 hover:text-slate-900 hover:underline"
                    onClick={() => onTrySample("A")}
                  >
                    Try a sample bill
                  </button>
                ) : null}
              </div>
            </div>
          </>
        )}
      </section>

      {/* Below the first screen. */}
      <Landing onTour={loading ? undefined : onTour} onSampleB={() => onTrySample("B")} />

      <section className="mx-auto max-w-2xl space-y-6">
        <SummaryBillRequest />
        <p className="text-center text-sm text-slate-500">
          No file and no text?{" "}
          <button type="button" className="font-medium text-slate-900 underline-offset-4 hover:underline" onClick={onManual}>
            Type the charges yourself
          </button>
        </p>
      </section>
    </div>
  );
}
