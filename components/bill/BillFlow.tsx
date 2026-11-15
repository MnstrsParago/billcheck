"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { runAudit } from "@/lib/audit";
import { SAMPLES } from "@/lib/samples";
import {
  EMPTY_HOUSEHOLD,
  clearDraft,
  emptyDraft,
  emptyRow,
  lineToRow,
  loadDraft,
  rowToLine,
  saveDraft,
  type Draft,
} from "@/lib/state";
import type { ExtractResponse } from "@/lib/types";
import type { UploadFile } from "@/lib/upload";
import { TOUR_START_EVENT } from "@/components/tour/JudgeTour";
import { InputStep } from "./InputStep";
import { LinesStep } from "./LinesStep";
import { ResultStep } from "./ResultStep";

const EXTRACT_TIMEOUT_MS = 70_000;

function errorFor(status: number, body: ExtractResponse | null): string {
  if (body && !body.ok && body.error) return body.error;
  if (status === 429) return "Too many requests right now. Please wait a minute and try again.";
  if (status === 503) return "Automatic bill reading is temporarily unavailable.";
  return "Automatic bill reading failed.";
}

export function BillFlow() {
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<UploadFile[]>([]); // not persisted (too large for localStorage)
  const abortRef = useRef<AbortController | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  // Restore the saved draft after mount (localStorage is not available during SSR).
  useEffect(() => {
    const saved = loadDraft();
    if (saved) setDraft(saved);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveDraft(draft);
  }, [draft, hydrated]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const patch = useCallback((p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p })), []);

  const go = (p: Partial<Draft>) => {
    patch(p);
    requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const loadSample = (id: "A" | "B") => {
    const s = SAMPLES.find((x) => x.id === id);
    if (!s) return;
    setFiles([]);
    patch({ text: s.text, household: s.household ? { ...s.household } : { ...EMPTY_HOUSEHOLD } });
  };

  const extract = async () => {
    const text = draft.text.trim();
    if (!text && files.length === 0) return;
    const payload = files.length
      ? { files: files.map((f) => ({ mediaType: f.mediaType, data: f.data })) }
      : { text };
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const timer = setTimeout(() => ctrl.abort(), EXTRACT_TIMEOUT_MS);
    setLoading(true);
    let status = 0;
    let body: ExtractResponse | null = null;
    let networkError: string | null = null;
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });
      status = res.status;
      try {
        body = (await res.json()) as ExtractResponse;
      } catch {
        body = null;
      }
    } catch (e) {
      if (ctrl.signal.aborted && abortRef.current !== ctrl) return; // superseded
      networkError =
        e instanceof DOMException && e.name === "AbortError"
          ? "Reading the bill took too long or was cancelled."
          : "Network error while reading the bill.";
    } finally {
      clearTimeout(timer);
      if (abortRef.current === ctrl) {
        abortRef.current = null;
        setLoading(false);
      }
    }

    if (body && body.ok && Array.isArray(body.bill?.lines)) {
      const bill = body.bill;
      const dropped = body.dropped ?? [];
      go({
        step: "lines",
        rows: bill.lines.map((l) => lineToRow(l)),
        dropped,
        extractError:
          bill.lines.length === 0
            ? files.length
              ? "We didn't find any line items with charges. Make sure the whole page is in the photo, including the amounts column — or add the lines below by hand."
              : "We didn't find any line items with charges on that bill. Add them below by hand."
            : null,
        // New bill → take the provider/state printed on it; the user can edit both on the next screen.
        provider: bill.provider?.trim() || "",
        hospitalState: bill.providerState?.trim().toUpperCase() || "",
        auditedLines: null,
      });
      return;
    }
    const msg = networkError ?? errorFor(status, body);
    go({
      step: "lines",
      rows: [emptyRow()],
      dropped: [],
      extractError: msg,
      auditedLines: null,
    });
  };

  const cancel = () => {
    const c = abortRef.current;
    abortRef.current = null;
    c?.abort();
    setLoading(false);
  };

  const manual = () =>
    go({ step: "lines", rows: draft.rows.length ? draft.rows : [emptyRow()], dropped: [], extractError: null });

  const runIt = () => go({ step: "result", auditedLines: draft.rows.map(rowToLine) });

  const newBill = () => {
    clearDraft();
    setFiles([]);
    go(emptyDraft());
  };

  const result = useMemo(
    () => (draft.step === "result" && draft.auditedLines ? runAudit(draft.auditedLines, draft.household) : null),
    [draft.step, draft.auditedLines, draft.household],
  );

  return (
    <div ref={topRef} className="scroll-mt-4">
      {!hydrated ? (
        <div className="h-64 animate-pulse rounded-xl bg-slate-100" aria-hidden />
      ) : draft.step === "input" ? (
        <InputStep
          files={files}
          onFiles={setFiles}
          onTour={() => window.dispatchEvent(new Event(TOUR_START_EVENT))}
          text={draft.text}
          household={draft.household}
          loading={loading}
          onText={(text) => patch({ text })}
          onHousehold={(household) => patch({ household })}
          onSample={loadSample}
          onSubmit={extract}
          onManual={manual}
          onCancel={cancel}
        />
      ) : draft.step === "lines" ? (
        <LinesStep
          rows={draft.rows}
          provider={draft.provider}
          hospitalState={draft.hospitalState}
          dropped={draft.dropped}
          extractError={draft.extractError}
          onRows={(rows) => patch({ rows })}
          onProvider={(provider) => patch({ provider })}
          onHospitalState={(hospitalState) => patch({ hospitalState })}
          onBack={() => go({ step: "input" })}
          onRun={runIt}
        />
      ) : result && draft.auditedLines ? (
        <ResultStep
          result={result}
          lines={draft.auditedLines}
          provider={draft.provider}
          hospitalState={draft.hospitalState}
          household={draft.household}
          onHousehold={(household) => patch({ household })}
          onEditLines={() => go({ step: "lines" })}
          onNewBill={newBill}
        />
      ) : null}
    </div>
  );
}
