import { NextResponse, type NextRequest } from "next/server";
import { codeStats } from "@/lib/outcomes/aggregate";
import { normalizeHospital } from "@/lib/outcomes/normalize";
import { statsQuerySchema } from "@/lib/outcomes/schema";
import { getAllOutcomes, isOutcomesConfigured } from "@/lib/outcomes/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/outcomes/stats?hospital=...&cpts=a,b,c → { ok, stats: CodeOutcomeStats[] } */
export async function GET(req: NextRequest) {
  if (!isOutcomesConfigured()) {
    return NextResponse.json({ ok: false, error: "Outcomes database is not configured" }, { status: 503 });
  }
  const sp = req.nextUrl.searchParams;
  const parsed = statsQuerySchema.safeParse({
    hospital: sp.get("hospital") ?? "",
    cpts: [...new Set((sp.get("cpts") ?? "").split(",").map((c) => c.trim().toUpperCase()).filter(Boolean))],
  });
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid query" }, { status: 400 });

  try {
    const records = await getAllOutcomes();
    const stats = codeStats(records, normalizeHospital(parsed.data.hospital), parsed.data.cpts);
    return NextResponse.json({ ok: true, stats }, { headers: { "cache-control": "public, max-age=30, s-maxage=60" } });
  } catch (err) {
    console.error("[outcomes] stats failed", err instanceof Error ? err.name : typeof err);
    return NextResponse.json({ ok: false, error: "Outcomes are unavailable" }, { status: 502 });
  }
}
