import { describe, expect, it } from "vitest";
import { checkGfe, PPDR_FEE, PPDR_THRESHOLD, PPDR_WINDOW_DAYS } from "./gfe";

const now = new Date("2026-11-15T12:00:00Z");

describe("checkGfe (No Surprises Act PPDR)", () => {
  it("uses the CMS rules: $400, 120 days, $25", () => {
    expect([PPDR_THRESHOLD, PPDR_WINDOW_DAYS, PPDR_FEE]).toEqual([400, 120, 25]);
  });
  it("not checked without a GFE amount or bill date", () => {
    expect(checkGfe({ gfeAmount: null, billDate: "2026-10-01", selfPay: true }, 5000, now).status).toBe("not_checked");
    expect(checkGfe({ gfeAmount: 1000, billDate: null, selfPay: true }, 5000, now).status).toBe("not_checked");
    expect(checkGfe({ gfeAmount: 1000, billDate: "10/01/2026", selfPay: true }, 5000, now).status).toBe("not_checked");
  });
  it("eligible at exactly $400 over, with deadline = bill date + 120 days", () => {
    const r = checkGfe({ gfeAmount: 1600, billDate: "2026-10-01", selfPay: true }, 2000, now);
    expect(r).toMatchObject({ status: "eligible", difference: 400, deadline: "2027-01-29", daysLeft: 75 });
  });
  it("below threshold at $399.99 over", () => {
    expect(checkGfe({ gfeAmount: 1600.01, billDate: "2026-10-01", selfPay: true }, 2000, now).status).toBe("below_threshold");
  });
  it("deadline passed after 120 days; last day still eligible", () => {
    expect(checkGfe({ gfeAmount: 100, billDate: "2026-07-18", selfPay: true }, 2000, now)).toMatchObject({ status: "eligible", daysLeft: 0 });
    expect(checkGfe({ gfeAmount: 100, billDate: "2026-07-17", selfPay: true }, 2000, now).status).toBe("deadline_passed");
  });
  it("not applicable when insurance was used", () => {
    expect(checkGfe({ gfeAmount: 100, billDate: "2026-10-01", selfPay: false }, 2000, now).status).toBe("insured");
  });
});
