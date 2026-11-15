import type { Metadata } from "next";
import TrackerApp from "@/components/tracker/TrackerApp";

export const metadata: Metadata = {
  title: "My disputes — BillCheck",
};

export default function TrackerPage() {
  return <TrackerApp />;
}
