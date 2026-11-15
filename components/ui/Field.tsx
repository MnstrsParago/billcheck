import type { ReactNode } from "react";

export const inputClass =
  "block w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[15px] text-slate-900 placeholder:text-slate-400 " +
  "focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 disabled:bg-slate-50";

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className = "",
}: {
  label: string;
  htmlFor: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-xs text-rose-600" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}
