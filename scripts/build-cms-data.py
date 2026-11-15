"""Build data/medicare-pfs-2026.json and data/opps-2026.json from official CMS files.

Usage:
  python -I scripts/build-cms-data.py <PPRRVU2026_Oct_nonQPP.csv> <Addendum B .txt>

Sources (downloaded from cms.gov):
  - https://www.cms.gov/files/zip/rvu26d-updated-08-26-2026.zip  (RVU26D, file PPRRVU2026_Oct_nonQPP.csv)
  - https://www.cms.gov/files/zip/October-2026-OPPS-Addendum-B.zip (October 2026 Addendum B, updated 10/15/2026)
CPT descriptions are AMA-copyrighted and are NOT copied; only codes and numbers.
"""
import csv, json, sys, re

CF = 33.4009
pfs_path, opps_path = sys.argv[1], sys.argv[2]

# ---- PFS: global rows (no modifier), national non-facility rate = NON-FAC TOTAL RVU x CF
rates, excluded = {}, {}
with open(pfs_path, newline="", encoding="latin-1") as f:
    rows = list(csv.reader(f))
hdr_i = next(i for i, r in enumerate(rows) if r and r[0] == "HCPCS")
for r in rows[hdr_i + 1:]:
    if len(r) < 13 or not re.fullmatch(r"[A-Z0-9]{5}", r[0]) or r[1].strip():
        continue
    code, status, nonfac_na, nonfac_total = r[0], r[3].strip(), r[7].strip(), r[11].strip()
    try:
        total = float(nonfac_total)
    except ValueError:
        total = 0.0
    if status == "X":
        excluded[code] = "lab"  # not paid under PFS (e.g. Clinical Lab Fee Schedule)
    elif status in ("A", "R", "T"):
        if nonfac_na == "NA":
            excluded[code] = "na"  # non-facility setting not applicable
        elif total > 0:
            rates[code] = round(total * CF, 2)

pfs = {
    "source": "CMS Medicare Physician Fee Schedule, National Physician Fee Schedule Relative Value File, CY2026, October release (RVU26D, released 08/26/2026), file PPRRVU2026_Oct_nonQPP.csv",
    "sourceUrl": "https://www.cms.gov/files/zip/rvu26d-updated-08-26-2026.zip",
    "year": 2026,
    "setting": "non-facility",
    "geography": "national (unadjusted, no GPCI)",
    "conversionFactor": CF,
    "formula": "nationalNonFacilityRate = NON-FACILITY TOTAL RVU x CONV FACTOR (non-QPP), global rows only (no modifier), status A/R/T. Status X codes (e.g. labs) and codes with non-facility NA are listed in excluded.",
    "excludedReasons": {"lab": "status X: not paid under the Physician Fee Schedule (lab tests use the Clinical Lab Fee Schedule)", "na": "non-facility rate not applicable (NA): service is only furnished in a facility"},
    "rates": dict(sorted(rates.items())),
    "excluded": dict(sorted(excluded.items())),
}

# ---- OPPS Addendum B: separately payable HCPCS with a national unadjusted payment rate
opps = {}
with open(opps_path, encoding="latin-1") as f:
    lines = f.read().splitlines()
hi = next(i for i, l in enumerate(lines) if l.startswith("HCPCS Code\t"))
for l in lines[hi + 1:]:
    c = l.split("\t")
    if len(c) < 6 or not re.fullmatch(r"[A-Z0-9]{5}", c[0].strip()):
        continue
    code, si, apc, rate = c[0].strip(), c[2].strip(), c[3].strip(), c[5].strip().replace("$", "").replace(",", "")
    try:
        val = float(rate)
    except ValueError:
        continue
    if val > 0:
        opps[code] = [val, si, apc]

out_opps = {
    "source": "CMS Hospital Outpatient Prospective Payment System (OPPS), Addendum B, October 2026 (updated 10/15/2026), file 2026_October_Web_Addendum_B.10.14.26",
    "sourceUrl": "https://www.cms.gov/medicare/payment/prospective-payment-systems/hospital-outpatient-pps/quarterly-addenda-updates/october-2026-addendum-b",
    "year": 2026,
    "geography": "national unadjusted (no wage index)",
    "formula": "facilityRate = Addendum B national unadjusted Payment Rate for the HCPCS code (APC rate, or code-specific rate for drugs/biologicals per HCPCS unit). Only codes with a payment rate > 0 are included; packaged codes (no separate payment) are omitted.",
    "fields": ["paymentRate", "statusIndicator", "apc"],
    "rates": dict(sorted(opps.items())),
}

json.dump(pfs, open("data/medicare-pfs-2026.json", "w"), separators=(",", ":"))
json.dump(out_opps, open("data/opps-2026.json", "w"), separators=(",", ":"))
print("pfs rates", len(rates), "excluded", len(excluded), "| opps", len(opps))
