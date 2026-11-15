// Server-only Resend client (REST). The key is read from RESEND_API_KEY and never sent to the browser.

export const EMAIL_FROM = "BillCheck <onboarding@resend.dev>";
export { MAX_SCHEDULE_DAYS } from "./limits";

export type SendResult =
  | { ok: true; id: string }
  | { ok: false; code: "not_configured" | "demo_restricted" | "invalid_address" | "failed"; error: string };

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendEmail(input: {
  to: string;
  subject: string;
  text: string;
  html: string;
  scheduledAt?: Date;
  idempotencyKey?: string;
}): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, code: "not_configured", error: "Email reminders are not configured." };
  let res: Response;
  try {
    res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        ...(input.idempotencyKey ? { "Idempotency-Key": input.idempotencyKey.slice(0, 256) } : {}),
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [input.to],
        subject: input.subject,
        text: input.text,
        html: input.html,
        ...(input.scheduledAt ? { scheduled_at: input.scheduledAt.toISOString() } : {}),
      }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return { ok: false, code: "failed", error: "Could not reach the email service. Please try again." };
  }
  let body: { id?: string; message?: string; name?: string } = {};
  try {
    body = await res.json();
  } catch {
    // ignore
  }
  if (res.ok && body.id) return { ok: true, id: body.id };
  const msg = (body.message ?? "").toLowerCase();
  // Resend's free test sender (onboarding@resend.dev) only delivers to the account owner's own address.
  if (res.status === 403 || msg.includes("own email") || msg.includes("verify a domain") || msg.includes("testing emails")) {
    return {
      ok: false,
      code: "demo_restricted",
      error:
        "Demo limit: our free email sender (onboarding@resend.dev) can only send to the project owner's address. Your reminders are still in the tracker and the calendar file.",
    };
  }
  if (res.status === 422 && msg.includes("to")) {
    return { ok: false, code: "invalid_address", error: "That email address can't receive emails. Please check it." };
  }
  console.error("[email] send failed", res.status, body.name ?? "");
  return { ok: false, code: "failed", error: "The email could not be sent. Please try again later." };
}

/** Cancel a scheduled email. Returns false if the key is not allowed to cancel (send-only key) or it failed. */
export async function cancelEmail(id: string): Promise<{ ok: boolean; reason?: "key_cannot_cancel" | "failed" }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, reason: "failed" };
  try {
    const res = await fetch(`https://api.resend.com/emails/${encodeURIComponent(id)}/cancel`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) return { ok: true };
    return { ok: false, reason: res.status === 401 ? "key_cannot_cancel" : "failed" };
  } catch {
    return { ok: false, reason: "failed" };
  }
}
