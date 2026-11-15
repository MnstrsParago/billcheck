import { NextResponse } from "next/server";
import { rankHospitals, totals } from "@/lib/outcomes/aggregate";
import { getAllOutcomes, isOutcomesConfigured } from "@/lib/outcomes/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/hospitals → { ok, rankings: HospitalRanking[], totals: {records, demo, real} } */
export async function GET() {
  if (!isOutcomesConfigured()) {
    return NextResponse.json({ ok: false, error: "Outcomes database is not configured" }, { status: 503 });
  }
  try {
    const records = await getAllOutcomes();
    return NextResponse.json(
      { ok: true, rankings: rankHospitals(records), totals: totals(records) },
      { headers: { "cache-control": "public, max-age=30, s-maxage=60" } },
    );
  } catch (err) {
    console.error("[outcomes] rankings failed", err instanceof Error ? err.name : typeof err);
    return NextResponse.json({ ok: false, error: "Outcomes are unavailable" }, { status: 502 });
  }
}
