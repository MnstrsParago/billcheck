import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:outline-emerald-600 disabled:bg-emerald-300",
  secondary:
    "bg-slate-900/5 text-slate-900 hover:bg-slate-900/10 focus-visible:outline-slate-500 disabled:text-slate-400",
  ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-slate-500 disabled:text-slate-300",
  danger: "text-rose-600 hover:bg-rose-50 focus-visible:outline-rose-500 disabled:text-rose-300",
};
const SIZES: Record<Size, string> = {
  sm: "px-3.5 py-1.5 text-sm",
  md: "px-5 py-2.5 text-[15px]",
  lg: "px-7 py-3.5 text-base",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra = ""): string {
  return [
    "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-colors",
    "focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed",
    VARIANTS[variant],
    SIZES[size],
    extra,
  ].join(" ");
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  type = "button",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return <button type={type} className={buttonClass(variant, size, className)} {...rest} />;
}
