// ── Structured health data ───────────────────────────────────────────────
// The foundation that turns documents into a living record instead of prose
// blobs. Every uploaded report is extracted into typed records so the app can
// chart trends, compare over time, and notice problems on its own.

export type MetricStatus = "low" | "normal" | "high" | "unknown";

/** One measured value from one report (e.g. HbA1c 7.2% on 12 May 2026) */
export interface HealthMetric {
    id?: string;
    userId: string;
    patientId: string;
    documentId: string;
    documentName: string;
    test: string;        // canonical name, used to group a trend series
    testRaw: string;     // exactly as printed on the report
    value: number;
    unit: string;
    refLow: number | null;
    refHigh: number | null;
    status: MetricStatus;
    date: string;        // YYYY-MM-DD (report date)
    createdAt?: unknown;
}

/** A medicine as prescribed on a document — powers refill prediction */
export interface MedicationRecord {
    id?: string;
    userId: string;
    patientId: string;
    documentId: string;
    name: string;
    dose: string;
    frequency: string;
    durationDays: number | null;
    startDate: string;          // YYYY-MM-DD
    expectedEndDate: string | null;
    createdAt?: unknown;
}

/** "Review after 3 weeks", "repeat LFT in 1 month" — powers overdue nudges */
export interface FollowUpRecord {
    id?: string;
    userId: string;
    patientId: string;
    documentId: string;
    advice: string;
    dueDate: string | null;     // YYYY-MM-DD
    status: "pending" | "done";
    createdAt?: unknown;
}

/** What the AI returns for a single uploaded document */
export interface ExtractionResult {
    summaryMarkdown: string;
    docType: "lab_report" | "prescription" | "imaging" | "bill" | "other";
    reportDate: string | null;
    metrics: Array<{
        test: string; testRaw: string; value: number; unit: string;
        refLow: number | null; refHigh: number | null; status: MetricStatus;
    }>;
    medications: Array<{
        name: string; dose: string; frequency: string; durationDays: number | null;
    }>;
    followUps: Array<{ advice: string; inDays: number | null }>;
}

// Canonical names keep a trend series together even when labs print the test
// differently ("HBA1C", "Glycated Haemoglobin" -> "HbA1c").
export const CANONICAL_TESTS = [
    "HbA1c", "Fasting Blood Sugar", "Post Prandial Blood Sugar", "Random Blood Sugar",
    "Hemoglobin", "WBC Count", "Platelet Count", "RBC Count",
    "Total Cholesterol", "LDL", "HDL", "Triglycerides",
    "Creatinine", "Urea", "Uric Acid", "eGFR",
    "SGPT (ALT)", "SGOT (AST)", "Bilirubin Total", "Alkaline Phosphatase",
    "TSH", "T3", "T4", "Vitamin D", "Vitamin B12",
    "Systolic BP", "Diastolic BP", "Heart Rate", "Weight", "BMI",
    "ESR", "CRP", "Calcium", "Sodium", "Potassium", "Iron", "Ferritin",
] as const;

/** JSON schema handed to Gemini so extraction comes back machine-readable */
export const EXTRACTION_SCHEMA = {
    type: "object",
    properties: {
        summaryMarkdown: { type: "string" },
        docType: { type: "string", enum: ["lab_report", "prescription", "imaging", "bill", "other"] },
        reportDate: { type: "string" },
        metrics: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    test: { type: "string" },
                    testRaw: { type: "string" },
                    value: { type: "number" },
                    unit: { type: "string" },
                    refLow: { type: "number" },
                    refHigh: { type: "number" },
                    status: { type: "string", enum: ["low", "normal", "high", "unknown"] },
                },
                required: ["test", "testRaw", "value", "unit", "status"],
            },
        },
        medications: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    name: { type: "string" },
                    dose: { type: "string" },
                    frequency: { type: "string" },
                    durationDays: { type: "number" },
                },
                required: ["name"],
            },
        },
        followUps: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    advice: { type: "string" },
                    inDays: { type: "number" },
                },
                required: ["advice"],
            },
        },
    },
    required: ["summaryMarkdown", "docType", "metrics", "medications", "followUps"],
};

/** Instruction block appended to the summary prompt to drive extraction */
export const EXTRACTION_INSTRUCTIONS = `
## ALSO EXTRACT STRUCTURED DATA (this is critical — it powers charts and alerts)
Return JSON matching the given schema. Alongside "summaryMarkdown" (the human summary described above), fill:

- "docType": what kind of document this is.
- "reportDate": the date printed on the document as YYYY-MM-DD. If absent, omit.
- "metrics": EVERY measured numeric value on the document. One entry per value.
  - "test": map to EXACTLY one of these canonical names when it matches: ${CANONICAL_TESTS.join(", ")}. If it genuinely matches none, use a clean Title Case name.
  - "testRaw": the name exactly as printed.
  - "value": numeric only (no units, no "<" or ">" — use the number).
  - "unit": as printed (e.g. "mg/dL", "%", "g/dL").
  - "refLow"/"refHigh": the lab's normal range numbers if printed; omit if not.
  - "status": "high"/"low" if outside the printed range, "normal" if inside, "unknown" if no range printed.
  - Blood pressure: split into two metrics — "Systolic BP" and "Diastolic BP".
  - If the document has no measured values (e.g. a prescription), return an empty array.
- "medications": every medicine prescribed. "durationDays" = number of days if stated (e.g. "x 5 days" -> 5), omit if not.
- "followUps": any advice to return, repeat a test, or review. "inDays" = how many days from the report date (e.g. "review after 3 weeks" -> 21), omit if unclear.

Accuracy is critical: never invent a value, range, medicine or date that is not printed on the document.`;

/** Compute status from value + range when the model didn't decide confidently */
export function deriveStatus(value: number, refLow: number | null, refHigh: number | null): MetricStatus {
    if (refLow != null && value < refLow) return "low";
    if (refHigh != null && value > refHigh) return "high";
    if (refLow != null || refHigh != null) return "normal";
    return "unknown";
}

export const STATUS_COLOR: Record<MetricStatus, string> = {
    low: "#f59e0b",
    normal: "#10b981",
    high: "#ef4444",
    unknown: "#94a3b8",
};

/** Add days to a YYYY-MM-DD date string */
export function addDays(date: string, days: number): string {
    const d = new Date(date);
    if (isNaN(d.getTime())) return date;
    d.setDate(d.getDate() + days);
    return d.toISOString().split("T")[0];
}

/** Today as YYYY-MM-DD */
export function today(): string {
    return new Date().toISOString().split("T")[0];
}
