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
    const t = setInterval(() => setSec((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div role="status" aria-live="polite" className="space-y-3 py-6 text-center">
      <p className="text-lg text-slate-900">Reading your bill… {sec}s</p>
      <button type="button" onClick={onCancel} className="text-sm text-slate-500 underline underline-offset-4">
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
    <div
      className="space-y-3 text-center"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (!disabled) void add(e.dataTransfer.files);
      }}
    >
      <label
        htmlFor="bill-files"
        className={`inline-flex w-full cursor-pointer items-center justify-center rounded-full bg-slate-900 px-7 py-4 text-base font-medium text-white hover:bg-slate-700 sm:w-auto ${
          disabled || busy ? "pointer-events-none opacity-50" : ""
        }`}
      >
        {busy ? "Preparing…" : files.length ? "Add more pages" : "Upload your bill"}
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
      <p className="text-sm text-slate-400">PDF or photo, up to {MAX_UPLOAD_FILES} pages</p>
      {error ? (
        <p role="alert" className="text-sm text-rose-600">
          {error}
        </p>
      ) : null}
      {files.length ? (
        <ul className="space-y-1 text-sm text-slate-600">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`}>
              {f.name}{" "}
              <button
                type="button"
                className="text-slate-400 underline underline-offset-4"
                aria-label={`Remove ${f.name}`}
                disabled={disabled}
                onClick={() => onFiles(files.filter((_, j) => j !== i))}
              >
                remove
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
    <section id="check-form" className="mx-auto max-w-xl scroll-mt-24 space-y-10 pt-6 text-center sm:pt-16">
      <h1 className="text-balance text-4xl font-semibold tracking-tight text-slate-900 sm:text-6xl">
        Is your hospital bill wrong?
      </h1>

      {loading ? (
        <Progress onCancel={onCancel} />
      ) : (
        <div className="space-y-6">
          {error ? (
            <p role="alert" className="text-rose-600">
              {error}
            </p>
          ) : null}
          <UploadZone files={files} disabled={loading} onFiles={onFiles} />

          {pasteOpen && files.length === 0 ? (
            <div className="space-y-2 text-left">
              <label htmlFor="bill-text" className="sr-only">
                Bill text
              </label>
              <textarea
                id="bill-text"
                rows={6}
                className={`${inputClass} font-mono text-sm`}
                placeholder="Paste the bill text"
                value={text}
                onChange={(e) => onText(e.target.value)}
              />
              {tooLong ? <p className="text-sm text-rose-600">Too long. Paste only the charges.</p> : null}
            </div>
          ) : null}

          {ready ? (
            <Button size="lg" data-tour="check" onClick={onSubmit} className="w-full sm:w-auto">
              Check my bill
            </Button>
          ) : null}

          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm">
            <button
              type="button"
              data-tour="sample-A"
              className="font-medium text-slate-900 underline underline-offset-4"
              onClick={() => onTrySample("A")}
            >
              Try a sample bill
            </button>
            {files.length === 0 && !pasteOpen ? (
              <button type="button" className="text-slate-400 underline underline-offset-4" onClick={() => setPasteOpen(true)}>
                Paste text
              </button>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}
