# I M Smrti — Data Layer Brief

**For:** Shreya
**From:** Rohit
**Updated:** 25 August 2026

---

## TL;DR

We have a working health-records app for Indian families. It reads uploaded medical
documents with AI and is supposed to turn them into structured data (lab values,
medicines, follow-ups). **The reading part works; the structuring part is failing badly** —
39 of our 48 uploaded lab reports have produced just **2 usable lab values**.

We need someone to own the **data layer**: the medical vocabulary, the accuracy
measurement, and the reference ranges. This is data work, not app work — **you never
have to touch our React codebase.** Your deliverables are data files (CSV/JSON) that
Rohit wires into the app.

**Your first piece of work is defined at the bottom (Section 5) and is self-contained.**

---

## 1. What the product is

**I M Smrti** (imsmrti.app) is a health-record app built for the person in an Indian
family who manages everyone else's health — the son or daughter looking after ageing
parents, chasing prescriptions and lab reports across multiple doctors.

You add a family member, photograph their prescriptions and lab reports, and the app:
- stores them securely (12 Indian languages, DPDP-compliant)
- has AI explain each report in simple spoken Hindi/Tamil/etc.
- generates a one-page briefing to hand the doctor before an appointment
- shows an emergency QR card (blood group, allergies, medicines) that anyone can scan
- **charts how values move over time** ← this is the part that needs your help

Live at https://imsmrti.app · Stack: React + Firebase (Firestore) + Google Gemini.

### Current scale — be aware
This is early. **5 users, 5 patient profiles, 48 documents.** We're not sitting on a
goldmine of data yet. The work matters because it is the foundation everything else
needs — not because there's already a mountain to mine.

---

## 2. Where the data lives

Everything is in **Firestore** (Google's NoSQL document DB). The collections that matter:

### `documents` — one per uploaded file
```jsonc
{
  "userId":   "cFQflkq...",       // account owner
  "patientId":"nTtOPtVZ...",      // WHICH family member this belongs to
  "name":     "Ritu test 2026.pdf",
  "url":      "https://.../file.pdf",
  "docDate":  "2026-02-05",
  "category": "cat_labreport",    // user-chosen
  "docType":  "lab_report",       // AI-chosen: lab_report|prescription|imaging|bill|other
  "aiSummary":"### Report...",    // AI's plain-language summary (prose)
  "extracted": true               // has structured extraction run on it?
}
```

### `health_metrics` — one per lab value (**this is the broken one**)
```jsonc
{
  "userId":"...", "patientId":"...", "documentId":"...", "documentName":"Ritu test 2026.pdf",
  "test":    "Vitamin D",   // canonical name — groups a trend line together
  "testRaw": "VITAMIN D (25-OH)",  // exactly as printed on the report
  "value":   8.4,
  "unit":    "ng/ml",
  "refLow":  30, "refHigh": 100,   // normal range
  "status":  "low",                // low | normal | high | unknown
  "date":    "2026-02-05"
}
```

### `medications` — one per prescribed medicine
```jsonc
{
  "userId":"...", "patientId":"...", "documentId":"...",
  "name":"Vitad3 60K", "dose":"1 capsule", "frequency":"1/W",
  "durationDays":180, "startDate":"2026-05-04", "expectedEndDate":"2026-10-31"
}
```

### `follow_ups` — "review after 3 weeks", "repeat LFT in 1 month"
```jsonc
{ "userId":"...","patientId":"...","documentId":"...",
  "advice":"Repeat HbA1c", "dueDate":"2026-08-04", "status":"pending" }
```

### `patients` — the family members
`{ userId, name, gender, dob, bloodGroup, allergies, conditions, relationship }`

**Key rule:** every record carries `userId` (the account) **and** `patientId` (which family
member). Mixing patients would be a serious bug — a father's cholesterol must never
appear on his daughter's chart.

---

## 3. How extraction works today

When a document is uploaded, one Gemini call returns **both** a human summary **and**
structured JSON (metrics/medications/follow-ups) against a fixed schema. A validation
guard then rejects anything that isn't a plausible medical measurement before it is
saved.

That guard exists because a **business PDF's rupee amounts** (₹60,000 / ₹1,20,000 /
₹3,00,000) were once extracted as **"Weight" readings in INR** and charted. The guard
now blocks currency units, non-clinical documents, impossible values, and repairs
nonsense reference ranges. It works — but it only *blocks bad data*; it doesn't
*produce good data*.

---

## 4. The problem — with real numbers

| Fact | Number |
|---|---|
| Documents uploaded | **48** |
| Categorised as lab reports | **39** |
| Documents put through structured extraction | **12** (36 never processed) |
| **Lab values extracted in total** | **2** |
| Medicines extracted | 8 |
| Follow-ups extracted | 11 |

**39 lab reports should yield several hundred values. We have 2.**

### Problem A — no canonical medical vocabulary
The same test is printed differently by every lab, so trend lines silently split apart
instead of forming one series:

```
"HBA1C"  ·  "HbA1c"  ·  "Glycated Haemoglobin"  ·  "A1c"   → must all become ONE concept
"VITAMIN D (25-OH)"  ·  "Vit D3"  ·  "25-Hydroxyvitamin D" → ONE concept
```

Medicines are worse — Indian brand names, often OCR-mangled. These are **real strings
from our database right now**:

| Extracted as | Probably is | Notes |
|---|---|---|
| `Vitad3 60K` | Cholecalciferol (Vitamin D3) 60,000 IU | dose buried in the name |
| `Mouture LC` | Montair/Montek LC (Montelukast + Levocetirizine) | OCR error |
| `Grahaconeazole` | likely Itraconazole/Griseofulvin | OCR error, unusable as-is |
| `Amrol Fin`, `Zine 200 mg`, `Contimega O Lo` | ? | brand names, unresolved |

Note `dose` and `frequency` come back empty most of the time.

### Problem B — nobody knows the accuracy
We have **no measurement** of how good extraction is. Not 40%? Not 90%? Unknown.
That is exactly how the rupee-amount bug survived. **Anything we can't measure, we
can't improve.**

### Problem C — reference ranges are adult-generic
Our normal ranges (~30 common tests) are hand-written for a generic adult. They don't
vary by **age or sex**, and children/pregnancy/elderly genuinely differ. In a health
app, a wrong "normal" range is dangerous: it can make a serious value look fine.

---

## 5. YOUR FIRST TASK (self-contained, ~2 weeks part-time)

Two deliverables. **Both are data files. No app code, no Firebase writes, no deployment.**
Work in Python / notebooks / SQL / spreadsheets — whatever you like. Rohit wires the
output into the app.

### Deliverable 1 — Lab test vocabulary (`lab_vocabulary.csv`)

A mapping table from "however a lab printed it" → one canonical concept, with trustworthy
reference ranges.

| column | meaning | example |
|---|---|---|
| `canonical_name` | the one name we display | `HbA1c` |
| `aliases` | pipe-separated variants seen in Indian labs | `HBA1C\|Glycated Haemoglobin\|A1c\|Glycosylated Hb` |
| `loinc_code` | LOINC code if you can find it (nice-to-have) | `4548-4` |
| `unit_canonical` | the unit we standardise to | `%` |
| `unit_variants` | other units + conversion factor | `mmol/mol:0.0915` |
| `sex` | `any` / `M` / `F` | `any` |
| `age_min_years`, `age_max_years` | range this row applies to | `18`, `120` |
| `normal_low`, `normal_high` | reference range | `4.0`, `5.6` |
| `plausible_min`, `plausible_max` | outside this = bad OCR, reject | `3`, `20` |
| `plain_what` | what the test is, in one simple sentence a non-medical person understands | `Your average blood sugar over the last 3 months.` |
| `plain_low` / `plain_high` | what an abnormal result tends to mean, in everyday words | `Sugar has been high over months — the main number doctors track for diabetes.` |
| `source` | where the range came from | `ICMR / AIIMS / Lab handbook` |

**Scope:** the ~60–80 tests that actually appear on common Indian panels — CBC, lipid
profile, LFT, KFT, thyroid, blood sugar/HbA1c, Vitamin D & B12, urine routine, electrolytes.
Prioritise by what's most common, not completeness.

**Please cite your sources for ranges.** We already have a rough adult-only version
(~30 tests) you can start from — Rohit will send it.

### Deliverable 2 — Accuracy test set (`gold_standard.csv`)

Take **30–50 real reports** (Rohit will give you a de-identified set) and hand-label
what a human can see on each one:

`document_id, test_printed_name, value, unit, ref_low_printed, ref_high_printed, report_date`

This becomes the ruler we measure extraction against — precision (did we invent values
that aren't there?) and recall (did we miss values that are?). Without it we're guessing.

**Bonus if you have time:** a first pass at `drug_vocabulary.csv` — Indian brand name →
generic molecule + strength (`Vitad3 60K → Cholecalciferol, 60000 IU`). This one is
genuinely hard and genuinely valuable.

---

## 6. Where this goes after that (the bigger picture)

If the first piece goes well, the data layer grows into:

1. **Quality monitoring** — a dashboard: % of documents extracting cleanly, which labs/
   formats fail, which tests get missed most.
2. **Longitudinal patient view** — per-patient time series feeding a "your health now →
   where it's heading → what to do" feature (Rohit is building the app side of this now).
3. **De-identification + aggregation design** — for eventual population-health research
   (see the hard rules below). This means k-anonymity thresholds, age banding, no free
   text, minimum group sizes — proper privacy engineering, not just "remove the name".

The long-term ambition is to be able to say something true and useful about Indian
health at population scale — and one day share that with researchers or public health
bodies. **That is a someday-at-scale goal, not a now goal.** With 5 users there is
nothing to research. We build the foundation correctly first.

---

## 7. Hard rules — non-negotiable

This is health data belonging to real families, governed by India's **DPDP Act 2023**.

1. **Never share, export or copy identifiable patient data** outside the systems Rohit
   gives you access to. Not to a personal laptop, not to a public notebook, not to an LLM.
2. **The data we hold today may only be used to serve those users.** Our live privacy
   policy says data is *"strictly used to provide medical record storage and emergency SOS
   services, generate AI health insights."* Research is a **different purpose** and legally
   requires **separate opt-in consent** — which we are adding now, off by default. Until a
   user actively opts in, their data is **not** available for research or aggregation.
3. **"Without a name" is not anonymous.** Age + city + a rare condition can identify a
   person. Real anonymisation = aggregation with minimum group sizes (never report a
   group under ~50 people), banded ages, no free-text fields.
4. **Never mix patients.** Every query must scope by `patientId`.
5. If you're ever unsure whether something is allowed — **ask before doing it.** The
   legally cautious answer is the right one every time in this domain.

---

## 8. What you do NOT need to touch

- The React app, the UI, the deployment pipeline — none of it.
- Firebase security rules, authentication, Cloud Functions.
- The AI prompts (Rohit owns those, though your findings will shape them).

You are the **data brain**. Rohit is the builder. The interface between you is
**files in, files out**.

---

## 9. Practical next steps

1. Rohit sends you: the current adult-only reference table (~30 tests), a de-identified
   sample of reports, and read access if/when needed.
2. You skim this doc and tell us: does the first task make sense, and how long
   realistically for you?
3. Start with `lab_vocabulary.csv` — even 20 well-researched tests with good plain-language
   explanations is immediately usable and will visibly improve the app.

**Questions to Rohit:** anything unclear, anything you think is scoped wrong, or if you
think we're solving the wrong problem — say so. That feedback is worth more than the
files.
