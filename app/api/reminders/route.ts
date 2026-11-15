import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { clientIp } from "@/lib/ip";
import { cancelEmail, isEmailConfigured, sendEmail, type SendResult } from "@/lib/email/resend";
import { ESCALATION_DAY, planReminders, reminderTime } from "@/lib/email/plan";
import { confirmationEmail, escalationEmail, followUpEmail } from "@/lib/email/templates";
import { remindersRequestSchema, summaryToDispute } from "@/lib/email/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PER_IP_PER_HOUR = 12;
const PER_DAY_TOTAL = 300;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function failure(r: Exclude<SendResult, { ok: true }>) {
  const status = r.code === "demo_restricted" ? 403 : r.code === "invalid_address" ? 400 : r.code === "not_configured" ? 503 : 502;
  return json(r, status);
}

let redis: Redis | null | undefined;
function getRedis(): Redis | null {
  if (redis !== undefined) return redis;
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  redis = url && token ? new Redis({ url, token }) : null;
  return redis;
}

/** Counts every email. Fails closed without Redis: emails reach real inboxes. */
async function allow(ip: string, emails: number): Promise<boolean> {
  const r = getRedis();
  if (!r) return false;
  try {
    const now = Date.now();
    const ipKey = `rl:email:${ip}:${Math.floor(now / 3_600_000)}`;
    const dayKey = `rl:email:day:${Math.floor(now / 86_400_000)}`;
    const [a, b] = await Promise.all([r.incrby(ipKey, emails), r.incrby(dayKey, emails)]);
    await Promise.all([r.expire(ipKey, 3700), r.expire(dayKey, 90_000)]);
    return a <= PER_IP_PER_HOUR && b <= PER_DAY_TOTAL;
  } catch {
    return false;
  }
}

const TOO_MANY = { ok: false, error: "Too many emails from this device. Please try again later." };

export async function POST(req: Request) {
  if (!isEmailConfigured()) {
    return json({ ok: false, code: "not_configured", error: "Email reminders are not available right now." }, 503);
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "Request body must be JSON" }, 400);
  }
  const parsed = remindersRequestSchema.safeParse(body);
  if (!parsed.success) {
    const emailIssue = parsed.error.issues.some((i) => i.path.includes("email"));
    return json({ ok: false, error: emailIssue ? "Please enter a valid email address." : "Invalid request." }, 400);
  }
  const p = parsed.data;
  const now = new Date();

  if (p.action === "cancel") {
    const results = await Promise.all(p.ids.map((id) => cancelEmail(id)));
    return json({ ok: results.every((r) => r.ok), keyCannotCancel: results.some((r) => r.reason === "key_cannot_cancel") });
  }

  const d = summaryToDispute(p.dispute);
  const ip = clientIp(req.headers);

  if (p.action === "send_now") {
    if (!(await allow(ip, 1))) return json(TOO_MANY, 429);
    const r = await sendEmail({ to: p.email, ...followUpEmail(d, now) });
    return r.ok ? json({ ok: true, id: r.id }) : failure(r);
  }

  if (p.action === "schedule_escalation") {
    const at = reminderTime(d.startedAt, ESCALATION_DAY, now);
    if (!at) return json({ ok: true, scheduled: false });
    if (!(await allow(ip, 1))) return json(TOO_MANY, 429);
    const r = await sendEmail({ to: p.email, ...escalationEmail(d, at), scheduledAt: at, idempotencyKey: `esc:${d.id}` });
    return r.ok ? json({ ok: true, scheduled: true, id: r.id, at: at.toISOString() }) : failure(r);
  }

  // subscribe: confirmation now; follow-up and (if within Resend's 30-day window) escalation scheduled.
  const plan = planReminders(d.startedAt, now);
  const count = 1 + (plan.followUpAt ? 1 : 0) + (plan.escalationAt ? 1 : 0);
  if (!(await allow(ip, count))) return json(TOO_MANY, 429);

  const conf = await sendEmail({ to: p.email, ...confirmationEmail(d, plan), idempotencyKey: `conf:${d.id}:${p.email}` });
  if (!conf.ok) return failure(conf);

  const out: { followUp?: { id: string; at: string }; escalation?: { id: string; at: string } } = {};
  if (plan.followUpAt) {
    const r = await sendEmail({
      to: p.email,
      ...followUpEmail(d, plan.followUpAt),
      scheduledAt: plan.followUpAt,
      idempotencyKey: `fu:${d.id}:${p.email}`,
    });
    if (r.ok) out.followUp = { id: r.id, at: plan.followUpAt.toISOString() };
  }
  if (plan.escalationAt) {
    const r = await sendEmail({
      to: p.email,
      ...escalationEmail(d, plan.escalationAt),
      scheduledAt: plan.escalationAt,
      idempotencyKey: `esc:${d.id}`,
    });
    if (r.ok) out.escalation = { id: r.id, at: plan.escalationAt.toISOString() };
  }
  return json({ ok: true, confirmationId: conf.id, ...out });
}
