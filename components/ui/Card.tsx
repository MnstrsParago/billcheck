import type { HTMLAttributes } from "react";

/** Quiet surface: soft gray panel, no border, generous padding. */
export function Card({ className = "", ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`rounded-3xl bg-slate-50 p-5 sm:p-7 ${className}`} {...rest} />;
}
