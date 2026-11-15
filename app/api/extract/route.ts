import { NextResponse } from "next/server";
import type { ExtractResponse } from "@/lib/types";
import { ExtractRequestSchema, normalizeBill } from "@/lib/extract/schema";
import { ExtractError, extractWithClaude, isConfigured } from "@/lib/extract/claude";
import { checkRateLimit, clientIp } from "@/lib/extract/rateLimit";

export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";

function json(body: ExtractResponse, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "Request body must be JSON" }, 400);
  }

  const parsed = ExtractRequestSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid request";
    return json({ ok: false, error: msg }, 400);
  }

  if (!isConfigured()) {
    return json({ ok: false, error: "Extraction service is not configured" }, 503);
  }

  if (!(await checkRateLimit(clientIp(req.headers)))) {
    return json({ ok: false, error: "Too many requests. Please wait a minute and try again." }, 429);
  }

  try {
    const raw = await extractWithClaude(parsed.data);
    if (raw.isMedicalBill === false) {
      return json(
        {
          ok: false,
          error:
            "This doesn't look like a medical bill. Please upload the itemized bill from your hospital or doctor (a PDF or a clear photo of each page).",
        },
        422,
      );
    }
    const { bill, dropped } = normalizeBill(raw);
    return json({ ok: true, bill, dropped });
  } catch (err) {
    if (err instanceof ExtractError) return json({ ok: false, error: err.message }, err.status);
    console.error("[extract] unhandled", err instanceof Error ? err.name : typeof err);
    return json({ ok: false, error: "Something went wrong. Please try again or enter lines manually." }, 500);
  }
}
