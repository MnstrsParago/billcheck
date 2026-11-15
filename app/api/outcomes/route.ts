import { NextResponse, type NextRequest } from "next/server";
import { outcomePayloadSchema, payloadToRecords } from "@/lib/outcomes/schema";
import { clientIp } from "@/lib/ip";
import { checkRateLimit, isOutcomesConfigured, putOutcomes } from "@/lib/outcomes/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NOT_CONFIGURED = { ok: false, error: "Outcomes database is not configured" } as const;


export async function POST(req: NextRequest) {
  if (!isOutcomesConfigured()) return NextResponse.json(NOT_CONFIGURED, { status: 503 });

  const text = await req.text();
  if (text.length > 64_000) return NextResponse.json({ ok: false, error: "Payload too large" }, { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = outcomePayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid outcome payload", issues: parsed.error.issues.slice(0, 10).map((i) => `${i.path.join(".")}: ${i.message}`) },
      { status: 400 },
    );
  }

  try {
    if (!(await checkRateLimit(clientIp(req.headers)))) {
      return NextResponse.json({ ok: false, error: "Too many submissions, try again later" }, { status: 429 });
    }
    const records = payloadToRecords(parsed.data);
    await putOutcomes(records);
    return NextResponse.json({ ok: true, saved: records.length });
  } catch (err) {
    console.error("[outcomes] write failed", err instanceof Error ? err.name : typeof err);
    return NextResponse.json({ ok: false, error: "Could not save outcome" }, { status: 502 });
  }
}
