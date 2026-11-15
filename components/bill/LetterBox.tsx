"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall back below
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

function downloadText(text: string, filename: string): void {
  try {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {
    // ignore — Copy remains available
  }
}

export function LetterBox({
  id,
  title,
  description,
  text,
  filename,
}: {
  id: string;
  title: string;
  description: string;
  text: string;
  filename: string;
}) {
  const [copied, setCopied] = useState<"idle" | "ok" | "fail">("idle");
  const onCopy = async () => {
    const ok = await copyText(text);
    setCopied(ok ? "ok" : "fail");
    setTimeout(() => setCopied("idle"), 2000);
  };
  return (
    <section aria-labelledby={`${id}-title`} data-tour={id} className="scroll-mt-20 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 id={`${id}-title`} className="font-semibold text-slate-900">
            {title}
          </h3>
          <p className="text-sm text-slate-600">{description}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="secondary" size="sm" onClick={onCopy}>
            {copied === "ok" ? "Copied ✓" : copied === "fail" ? "Copy failed" : "Copy"}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => downloadText(text, filename)}>
            Download .txt
          </Button>
        </div>
      </div>
      <label htmlFor={`${id}-text`} className="sr-only">
        {title} text
      </label>
      <textarea
        id={`${id}-text`}
        readOnly
        value={text}
        rows={14}
        className="mt-3 block w-full resize-y rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-xs leading-relaxed text-slate-800"
      />
      <p className="mt-2 text-xs text-slate-500">
        Replace the [bracketed] placeholders before sending. Send by certified mail or the hospital&apos;s billing portal and keep a copy.
      </p>
    </section>
  );
}
