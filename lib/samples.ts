import type { HouseholdInput } from "@/lib/types";

export const SAMPLES: { id: "A" | "B"; label: string; text: string; household?: HouseholdInput }[] = [
  {
    id: "A",
    label: "Sample A: ER visit (Austin, TX)",
    text: `RIVERSIDE GENERAL HOSPITAL
1200 Riverside Parkway, Austin, TX 78741
Patient Billing: (512) 555-0140

ITEMIZED STATEMENT OF CHARGES
Account #: RGH-447102
Patient: [PATIENT NAME]
Admission date: 03/14/2026    Discharge date: 03/14/2026
Statement date: 04/02/2026

Date | CPT | Description | Units | Charge
03/14/2026 | 99285 | Emergency dept visit, high severity | 1 | $2,450.00
03/14/2026 | 71046 | X-ray exam chest 2 views | 1 | $412.00
03/14/2026 | 70450 | CT head/brain without contrast | 1 | $1,980.00
03/14/2026 | 70450 | CT head/brain without contrast | 1 | $1,980.00
03/14/2026 | 74177 | CT abdomen & pelvis with contrast | 1 | $2,875.00
03/14/2026 | 93000 | Electrocardiogram, complete | 1 | $42.00
03/14/2026 | 96374 | IV push, single drug | 1 | $98.00
03/14/2026 | 85025 | Complete blood count with differential | 1 | $118.00
03/14/2026 | 80053 | Comprehensive metabolic panel | 1 | $164.00

Total charges: $10,119.00
Insurance adjustments: $0.00
Payments received: $0.00
PATIENT BALANCE DUE: $10,119.00
`,
  },
  {
    id: "B",
    label: "Sample B: outpatient procedure (Columbus, OH)",
    text: `LAKEVIEW MEDICAL CENTER
450 Lakeview Drive, Columbus, OH 43215
Patient Financial Services: (614) 555-0188

ITEMIZED STATEMENT OF CHARGES
Account #: LMC-882015
Patient: [PATIENT NAME]
Service dates: 05/20/2026 - 05/20/2026
Statement date: 06/05/2026

Date | CPT | Description | Units | Charge
05/20/2026 | 45378 | Diagnostic colonoscopy | 1 | $1,020.00
05/20/2026 | 76700 | Ultrasound, abdomen, complete | 1 | $1,240.00
05/20/2026 | 93306 | Echocardiogram with Doppler, complete | 1 | $560.00
05/20/2026 | 93000 | Electrocardiogram, complete | 1 | $38.00
05/20/2026 | 36415 | Venipuncture, blood collection | 1 | $32.00

Total charges: $2,890.00
Insurance adjustments: $0.00
Payments received: $0.00
PATIENT BALANCE DUE: $2,890.00
`,
    household: { householdSize: 3, annualIncome: 45000, state: "OH" },
  },
];
