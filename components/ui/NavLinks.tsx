"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Check a bill" },
  { href: "/tracker", label: "My disputes" },
  { href: "/hospitals", label: "Hospital ratings" },
];

/** Header links; the current page is highlighted. */
export function NavLinks() {
  const path = usePathname();
  return (
    <div className="flex w-full items-center justify-between gap-1 text-sm sm:w-auto sm:justify-end sm:gap-6">
      {LINKS.map((l) => {
        const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`py-1.5 text-[13px] sm:text-sm ${
              active ? "font-semibold text-slate-900" : "text-slate-400 hover:text-slate-900"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </div>
  );
}
