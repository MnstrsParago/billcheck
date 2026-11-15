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
    <section aria-labelledby={`${id}-title`} data-tour={id} className="scroll-mt-20 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 id={`${id}-title`} className="text-base font-medium text-slate-900">
          {title}
        </h3>
        <div className="flex gap-4 text-sm">
          <button type="button" onClick={() => void onCopy()} className="underline underline-offset-4">
            {copied === "ok" ? "Copied" : copied === "fail" ? "Copy failed" : "Copy"}
          </button>
          <button type="button" onClick={() => downloadText(text, filename)} className="underline underline-offset-4">
            Download .txt
          </button>
        </div>
      </div>
      {description ? <p className="sr-only">{description}</p> : null}
      <textarea
        readOnly
        value={text}
        rows={10}
        aria-label={title}
        className="block w-full resize-y rounded-xl border border-slate-200 p-4 font-mono text-[13px] leading-relaxed text-slate-800 focus:outline-none"
      />
    </section>
  );
}
