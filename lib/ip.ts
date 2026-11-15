/**
 * Client IP for rate limiting. On Vercel, `x-vercel-forwarded-for` / `x-real-ip`
 * are set by the platform; the FIRST x-forwarded-for entry is client-controlled,
 * so we only fall back to its LAST entry (appended by the proxy).
 */
export function clientIp(headers: Headers): string {
  const vercel = headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim();
  if (vercel) return vercel;
  const real = headers.get("x-real-ip")?.trim();
  if (real) return real;
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  return "unknown";
}
