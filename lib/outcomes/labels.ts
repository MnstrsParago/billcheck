import type { WinningArgument } from "@/lib/types";

/** Client-safe display labels for winning arguments. */
export const ARGUMENT_LABEL: Record<WinningArgument, string> = {
  duplicate: "duplicate charge",
  above_medicare: "price above Medicare",
  charity_care: "charity care",
};

export function argumentLabel(a: WinningArgument | null | undefined): string {
  return a ? ARGUMENT_LABEL[a] : "—";
}
