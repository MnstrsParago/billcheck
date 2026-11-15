# BillCheck

**Find errors and inflated prices in a hospital bill in 2 minutes, then see the dispute through to the end.**

Business Cup 2.0, Money track. Web, B2C, no sign-up.

## Try it (no login)

1. Open the app and press **Try Sample A (ER visit)**, then **Check my bill**.
2. Review the extracted lines (edit, delete or add rows), then **Run audit**.
3. The free result shows the findings, **"$X you can dispute"** and the charity care status. Under each finding: what other people achieved disputing the same code at the same hospital.
4. Press **Upgrade — $12/mo** (*Demo unlock — no real charge*) to open finding details, the dispute letter and the charity care request.
5. **Start dispute** → tracker. Press **Simulate +30 days** to see the status move to *Follow-up due* with a ready follow-up letter. **Add to calendar** downloads an `.ics` with the day-30 and day-60 steps.
6. **Resolve** the dispute with the new prices and the argument that worked. The anonymous outcome joins the shared database and the **Hospitals** leaderboard.

Sample B (outpatient, Ohio) comes with household size 3 and income $45,000 (about 165% FPL, *Likely eligible*).

## How it works

```
bill text ─► /api/extract (LLM, server only, zod-validated JSON)
          ─► editable lines table
          ─► 3 deterministic checks (our code, unit-tested)
          ─► letters (templates) ─► tracker (30/60 days, .ics)
          ─► shared outcomes DB ─► per-code stats + hospital leaderboard
```

### The three checks
- **(A) Possible duplicates.** Same CPT (or description), same date, same charge. Lines with modifiers 59/76/77/91/XE/XS/XP/XU are skipped because they mark legitimately repeated procedures.
- **(B) Price above the Medicare reference.** Physician-fee codes: flagged if charge per unit is more than 3× the 2026 national non-facility PFS rate; disputable amount = charge − 3 × rate × units. Codes with no PFS non-facility rate (e.g. ER visits 99281–99285 and other hospital facility services) are compared with the 2026 OPPS national unadjusted payment rate at a separate, more conservative 4× threshold, with its own disclaimer. Duplicates are not double-counted. Not covered: lab tests (Clinical Lab Fee Schedule) and codes priced in neither table.
- **(C) Charity care.** %FPL = income ÷ HHS guideline for the household size and region (48 states + DC / Alaska / Hawaii). ≤200%: likely; 200–400%: possibly; >400%: not likely. Shown separately and never added to the disputable amount.

- **(D) Good Faith Estimate (No Surprises Act).** For uninsured / self-pay patients: if the bill is $400 or more above the provider's Good Faith Estimate and the bill is dated within the last 120 days, BillCheck prepares the text for the federal patient-provider dispute resolution process ($25 fee) and puts the deadline in the tracker. Rules: [CMS — Dispute a medical bill](https://www.cms.gov/medical-bill-rights/help/dispute-a-bill). Shown separately; not added to the disputable amount.

### Only a summary bill?
BillCheck writes a request for the itemized bill (codes, units and charges for every line, the financial assistance policy, and a collections hold) and tracks it with a 14-day follow-up.

### Shared outcomes database
When a dispute is closed (Resolved or Escalated), one anonymous row per disputed line is stored. Each row holds the hospital, state, CPT, original price, final price and the winning argument (duplicate / above Medicare / charity care). No names, account numbers or dates of service are stored. The result screen then shows "At this hospital, N people disputed this code, median reduction X%, winning argument: …", and `/hospitals` ranks hospitals by how often they lower disputed charges. Seed rows for fictional hospitals are marked **demo** in the database and in the UI. Real closures are written through the same path with `demo: false`.

## Data sources
- **CMS Medicare Physician Fee Schedule, CY2026, October release (RVU26D)**, file `PPRRVU2026_Oct_nonQPP.csv`. National non-facility rate = NON-FAC TOTAL RVU × CF 33.4009, every global code with status A/R/T and a non-facility rate (`data/medicare-pfs-2026.json`).
- **CMS OPPS Addendum B, October 2026** (updated 10/15/2026): national unadjusted payment rate per HCPCS code (APC rate) for every separately payable code (`data/opps-2026.json`).
- Both data files are rebuilt from the official CMS downloads with `python -I scripts/build-cms-data.py <PPRRVU2026_Oct_nonQPP.csv> <Addendum B .txt>`. Only codes and numbers are stored (no AMA-copyrighted descriptions).
- **HHS / ASPE 2026 Poverty Guidelines**, in `data/fpl-2026.json`.
- Nonprofit hospitals must maintain a Financial Assistance Policy under **IRS §501(r)**.

The Medicare national rate is a reference point, not a guarantee. Hospital facility fees are priced differently. BillCheck is not legal or medical advice.

## Stack
Next.js (App Router) + TypeScript + Tailwind, deployed on Vercel. The LLM is called only from the server route `/api/extract`. Upstash Redis (Vercel Marketplace) stores the shared outcomes. Audits, the tracker and Pro status live in `localStorage`.

## Run locally
```bash
npm install
cp .env.example .env.local   # fill in keys (never commit them)
npm run dev
npm test
```

Environment variables (server-only): `ANTHROPIC_API_KEY`, `KV_REST_API_URL`, `KV_REST_API_TOKEN`. Without them the app still works: bill lines can be entered by hand, and the outcome stats are hidden.
