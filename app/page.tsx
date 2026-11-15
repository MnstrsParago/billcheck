import { BillFlow } from "@/components/bill/BillFlow";
import { NextActionBanner } from "@/components/tracker/NextActionBanner";

export default function Home() {
  return (
    <div className="space-y-6">
      <NextActionBanner />
      <BillFlow />
    </div>
  );
}
