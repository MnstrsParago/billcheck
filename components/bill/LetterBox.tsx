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
    <section aria-labelledby={`${id}-title`} data-tour={id} className="scroll-mt-20 rounded-3xl bg-slate-50 p-5 sm:p-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 id={`${id}-title`} className="text-lg font-semibold tracking-tight text-slate-900">
            {title}
          </h3>
          <p className="mt-1 text-base text-slate-600">{description}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="primary" size="sm" onClick={onCopy}>
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
        rows={12}
        className="mt-4 block w-full resize-y rounded-2xl bg-white p-4 font-mono text-[13px] leading-relaxed text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
      />
      <p className="mt-3 text-sm text-slate-500">
        Fill in the [brackets] first. Send it by certified mail or through the hospital&apos;s billing website, and keep a copy.
      </p>
    </section>
  );
}
