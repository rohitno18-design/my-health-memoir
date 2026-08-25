// ── Medical reference knowledge ──────────────────────────────────────────
// Two jobs:
//   1. GUARD — decide whether an extracted number is genuinely a medical
//      measurement. Without this, a business PDF's rupee amounts got saved
//      as "Weight" readings. Never again: money, IDs, dates and impossible
//      values are rejected before they can reach a chart.
//   2. EXPLAIN — a person seeing "Vitamin D 8.4" learns nothing. Every known
//      test carries a trustworthy normal range and a plain-language meaning.

export interface TestReference {
    /** Canonical display name */
    name: string;
    /** Units we accept for this test (lowercased, punctuation-insensitive) */
    units: string[];
    /** Standard adult normal range */
    normalLow: number | null;
    normalHigh: number | null;
    /** Physiologically possible bounds — outside this the reading is bogus */
    plausibleMin: number;
    plausibleMax: number;
    /** What the test is, in one plain sentence */
    what: string;
    /** What a low / high result tends to mean, in everyday words */
    low?: string;
    high?: string;
}

const R = (
    name: string, units: string[],
    normalLow: number | null, normalHigh: number | null,
    plausibleMin: number, plausibleMax: number,
    what: string, low?: string, high?: string
): TestReference => ({ name, units, normalLow, normalHigh, plausibleMin, plausibleMax, what, low, high });

/** Adult reference values used across Indian labs */
export const MEDICAL_REFERENCE: Record<string, TestReference> = {
    "hba1c": R("HbA1c", ["%"], 4, 5.6, 3, 20,
        "Your average blood sugar over the last 3 months.",
        "Sugar may be running low — worth discussing with the doctor.",
        "Sugar has been high over months. This is the main number doctors track for diabetes."),
    "fasting blood sugar": R("Fasting Blood Sugar", ["mg/dl", "mg/dl.", "mgdl"], 70, 100, 20, 700,
        "Blood sugar measured on an empty stomach.",
        "Sugar dropped low — can cause dizziness or weakness.",
        "Sugar is high on an empty stomach — a common early sign of diabetes."),
    "post prandial blood sugar": R("Post Prandial Blood Sugar", ["mg/dl", "mgdl"], 70, 140, 20, 800,
        "Blood sugar about 2 hours after eating.", "Sugar dropped low after eating.",
        "Sugar stays high after meals."),
    "random blood sugar": R("Random Blood Sugar", ["mg/dl", "mgdl"], 70, 140, 20, 800,
        "Blood sugar at a random time.", "Sugar is low.", "Sugar is high."),
    "hemoglobin": R("Hemoglobin", ["g/dl", "gm/dl", "g/dl.", "gdl"], 12, 17, 2, 25,
        "The part of blood that carries oxygen around your body.",
        "Low hemoglobin (anaemia) — often causes tiredness, weakness and pale skin. Very common, usually treatable with diet or iron.",
        "Higher than usual — the doctor may want to check why."),
    "wbc count": R("WBC Count", ["/µl", "/ul", "cells/µl", "cells/ul", "/cumm", "cells/cumm"], 4000, 11000, 100, 100000,
        "White blood cells — your body's defence against infection.",
        "Lower defence cells than usual.", "Often rises when the body is fighting an infection."),
    "platelet count": R("Platelet Count", ["/µl", "/ul", "/cumm", "lakh/cumm"], 150000, 450000, 1000, 2000000,
        "Cells that help blood clot and stop bleeding.",
        "Low platelets — bleeding or bruising can happen more easily. Doctors watch this closely in dengue.",
        "Higher than usual."),
    "total cholesterol": R("Total Cholesterol", ["mg/dl", "mgdl"], null, 200, 50, 600,
        "Total fat circulating in your blood.", undefined,
        "High cholesterol raises the long-term risk to the heart."),
    "ldl": R("LDL", ["mg/dl", "mgdl"], null, 100, 5, 400,
        "The 'bad' cholesterol that can block arteries.", undefined,
        "High bad cholesterol — diet, exercise or medicine may be advised."),
    "hdl": R("HDL", ["mg/dl", "mgdl"], 40, null, 5, 150,
        "The 'good' cholesterol that protects the heart.",
        "Low protective cholesterol — exercise usually helps raise it.", undefined),
    "triglycerides": R("Triglycerides", ["mg/dl", "mgdl"], null, 150, 10, 2000,
        "Another type of fat in the blood, linked to diet and sugar.", undefined,
        "High — often improves with less sugar, less fried food and more activity."),
    "creatinine": R("Creatinine", ["mg/dl", "mgdl"], 0.6, 1.3, 0.1, 20,
        "A waste product your kidneys filter out — it shows how kidneys are working.",
        "Lower than usual, generally not a concern.",
        "Raised creatinine can mean the kidneys are under strain. Worth asking the doctor about."),
    "urea": R("Urea", ["mg/dl", "mgdl"], 15, 40, 2, 300,
        "Another kidney waste product.", "Low.", "Raised — kidneys may be under strain or you may be dehydrated."),
    "uric acid": R("Uric Acid", ["mg/dl", "mgdl"], 3.5, 7.2, 0.5, 20,
        "A waste product that can collect in joints.", "Low.",
        "High uric acid can cause gout — sudden painful swelling, often in the big toe."),
    "sgpt (alt)": R("SGPT (ALT)", ["u/l", "iu/l", "ul"], 7, 56, 1, 3000,
        "A liver enzyme — shows how the liver is doing.", undefined,
        "Raised liver enzyme. Common causes include fatty liver, alcohol or medicines."),
    "sgot (ast)": R("SGOT (AST)", ["u/l", "iu/l", "ul"], 8, 48, 1, 3000,
        "Another liver enzyme.", undefined, "Raised liver enzyme — the doctor will look at this with other liver tests."),
    "bilirubin total": R("Bilirubin Total", ["mg/dl", "mgdl"], 0.3, 1.2, 0.05, 50,
        "A yellow pigment the liver clears out.", undefined,
        "High bilirubin can cause yellowing of eyes or skin (jaundice)."),
    "tsh": R("TSH", ["µiu/ml", "uiu/ml", "miu/l", "mlu/l", "µlu/ml"], 0.4, 4.0, 0.001, 150,
        "The hormone that controls your thyroid — your body's energy thermostat.",
        "Low TSH usually means an overactive thyroid — can cause weight loss, fast heartbeat, anxiety.",
        "High TSH usually means an underactive thyroid — can cause tiredness, weight gain and feeling cold. Very common and easily treated."),
    "vitamin d": R("Vitamin D", ["ng/ml", "ng/dl", "nmol/l"], 30, 100, 1, 200,
        "The sunshine vitamin — keeps bones and muscles strong.",
        "Low Vitamin D is extremely common in India. It often causes tiredness, body aches, bone or joint pain and weak muscles. Usually corrected with supplements and some sunlight — ask your doctor.",
        "Higher than needed — usually from taking too many supplements."),
    "vitamin b12": R("Vitamin B12", ["pg/ml", "pmol/l"], 200, 900, 20, 3000,
        "A vitamin your nerves and blood need — mostly from dairy, eggs and meat.",
        "Low B12 can cause tiredness, tingling in hands or feet, and poor memory. Common in vegetarian diets and easily treated.",
        "Higher than usual, generally from supplements."),
    "systolic bp": R("Systolic BP", ["mmhg"], 90, 120, 50, 260,
        "The upper blood pressure number — pressure when the heart beats.",
        "Low blood pressure — can cause dizziness on standing.",
        "Raised blood pressure. Sustained high BP strains the heart over years."),
    "diastolic bp": R("Diastolic BP", ["mmhg"], 60, 80, 30, 160,
        "The lower blood pressure number — pressure when the heart rests.",
        "Low.", "Raised blood pressure — worth monitoring regularly."),
    "heart rate": R("Heart Rate", ["bpm", "/min", "beats/min"], 60, 100, 25, 220,
        "How many times the heart beats per minute.", "Slower than usual.", "Faster than usual."),
    "weight": R("Weight", ["kg", "kgs", "kg.", "kilogram", "kilograms"], null, null, 1, 300,
        "Body weight.", undefined, undefined),
    "bmi": R("BMI", ["kg/m2", "kg/m²", ""], 18.5, 24.9, 8, 80,
        "Weight compared to height.", "Underweight.", "Above the healthy range — raises risk of diabetes and heart problems."),
    "esr": R("ESR", ["mm/hr", "mm/1hr", "mm"], 0, 20, 0, 150,
        "A general sign of inflammation in the body.", undefined,
        "Raised — the body may be fighting inflammation or infection somewhere."),
    "crp": R("CRP", ["mg/l", "mg/dl"], null, 5, 0, 500,
        "A marker that rises with inflammation or infection.", undefined,
        "Raised inflammation marker."),
    "calcium": R("Calcium", ["mg/dl", "mgdl"], 8.5, 10.5, 3, 20,
        "The mineral that keeps bones and muscles working.", "Low calcium can cause cramps and tingling.", "High."),
    "sodium": R("Sodium", ["meq/l", "mmol/l"], 135, 145, 100, 180,
        "A salt that balances body fluids.", "Low sodium can cause weakness and confusion.", "High."),
    "potassium": R("Potassium", ["meq/l", "mmol/l"], 3.5, 5.1, 1, 10,
        "A mineral the heart and muscles need.", "Low potassium can cause weakness and cramps.",
        "High potassium can affect the heart — doctors take this seriously."),
    "ferritin": R("Ferritin", ["ng/ml", "µg/l", "ug/l"], 15, 300, 1, 5000,
        "How much iron your body has stored up.",
        "Low iron stores — the usual reason behind anaemia and constant tiredness.", "High iron stores."),
    "iron": R("Iron", ["µg/dl", "ug/dl", "mcg/dl"], 60, 170, 5, 1000,
        "Iron circulating in the blood.", "Low iron.", "High iron."),
    "egfr": R("eGFR", ["ml/min", "ml/min/1.73m2"], 90, null, 1, 200,
        "An estimate of how well the kidneys filter blood.",
        "Lower filtering rate — the doctor will want to look at kidney health.", undefined),

    // ── Complete blood count (the most common Indian panel) ──
    "hematocrit": R("Hematocrit", ["%"], 36, 50, 10, 70,
        "How much of your blood is made up of red cells.",
        "Low — usually goes together with low hemoglobin (anaemia).",
        "Higher than usual — can happen with dehydration."),
    "rbc count": R("RBC Count", ["million/µl", "million/ul", "mill/cumm", "10^6/µl"], 4.2, 5.9, 1, 12,
        "The number of red blood cells carrying oxygen.",
        "Fewer red cells than usual — often part of anaemia.", "More red cells than usual."),
    "mcv": R("MCV", ["fl"], 80, 100, 40, 150,
        "The average size of your red blood cells.",
        "Smaller cells than usual — commonly seen with iron deficiency.",
        "Larger cells than usual — often linked to low B12 or folate."),
    "mch": R("MCH", ["pg"], 27, 33, 10, 60,
        "The average amount of hemoglobin inside each red cell.",
        "Less hemoglobin per cell — often iron deficiency.", "More hemoglobin per cell than usual."),
    "mchc": R("MCHC", ["g/dl", "%"], 32, 36, 20, 45,
        "How concentrated the hemoglobin is inside red cells.", "Lower concentration.", "Higher concentration."),
    "rdw": R("RDW", ["%"], 11.5, 14.5, 5, 30,
        "How much red blood cell sizes vary from each other.", undefined,
        "Cells vary a lot in size — an early clue to iron or vitamin deficiency."),
    "neutrophils": R("Neutrophils", ["%"], 40, 75, 0, 100,
        "The white cells that fight bacterial infection.", "Lower than usual.",
        "Often rises during a bacterial infection."),
    "lymphocytes": R("Lymphocytes", ["%"], 20, 45, 0, 100,
        "The white cells that fight viral infection.", "Lower than usual.",
        "Often rises during a viral infection."),
    "eosinophils": R("Eosinophils", ["%"], 1, 6, 0, 60,
        "White cells linked to allergies and parasites.", undefined,
        "Raised — commonly seen with allergies, asthma or worms."),
    "monocytes": R("Monocytes", ["%"], 2, 10, 0, 50,
        "White cells that clean up infection and debris.", undefined, "Raised — often during recovery from infection."),

    // ── Liver ──
    "albumin": R("Albumin", ["g/dl"], 3.5, 5.2, 1, 8,
        "The main protein made by the liver.",
        "Low protein — can happen with poor nutrition, or liver or kidney problems.", undefined),
    "total protein": R("Total Protein", ["g/dl"], 6.0, 8.3, 2, 12,
        "All the protein circulating in your blood.", "Lower than usual.", "Higher than usual."),
    "ggt": R("GGT", ["u/l", "iu/l"], 8, 61, 1, 1500,
        "A liver enzyme sensitive to alcohol and bile problems.", undefined,
        "Raised — often related to alcohol, medicines or bile flow."),
    "bilirubin direct": R("Bilirubin Direct", ["mg/dl"], 0, 0.3, 0, 30,
        "The processed part of the yellow pigment the liver clears.", undefined,
        "Raised — the doctor will check this with the other liver tests."),
    "alkaline phosphatase": R("Alkaline Phosphatase", ["u/l", "iu/l"], 44, 147, 5, 2000,
        "An enzyme from liver and bone.", undefined, "Raised — can come from liver or bone."),

    // ── Thyroid ──
    "t3": R("T3", ["ng/dl", "ng/ml"], 80, 200, 10, 800,
        "One of the two main thyroid hormones.", "Low thyroid hormone — can cause tiredness and weight gain.",
        "High thyroid hormone — can cause weight loss and fast heartbeat."),
    "t4": R("T4", ["µg/dl", "ug/dl", "mcg/dl"], 5.1, 14.1, 0.5, 40,
        "The main thyroid hormone your body stores.", "Low thyroid hormone.", "High thyroid hormone."),
    "free t4": R("Free T4", ["ng/dl"], 0.8, 1.8, 0.1, 10,
        "The active, usable form of thyroid hormone.", "Low.", "High."),

    // ── Diabetes / metabolic ──
    "insulin fasting": R("Insulin Fasting", ["µiu/ml", "uiu/ml"], 2.6, 24.9, 0.1, 300,
        "The hormone that moves sugar from blood into your cells.", "Low.",
        "High insulin often appears years before diabetes — a useful early warning."),
    "vldl": R("VLDL", ["mg/dl"], 2, 30, 0, 200,
        "Another fat-carrying particle in the blood.", undefined, "Higher than usual."),

    // ── Kidney / electrolytes ──
    "chloride": R("Chloride", ["meq/l", "mmol/l"], 98, 107, 60, 140,
        "A salt that keeps body fluids balanced.", "Low.", "High."),
    "bun": R("BUN", ["mg/dl"], 7, 20, 1, 200,
        "A kidney waste product (blood urea nitrogen).", "Low.",
        "Raised — kidneys may be strained, or you may be dehydrated."),
    "phosphorus": R("Phosphorus", ["mg/dl"], 2.5, 4.5, 0.5, 15,
        "A mineral that works with calcium for bones.", "Low.", "High — often linked to kidney function."),
    "magnesium": R("Magnesium", ["mg/dl"], 1.7, 2.2, 0.3, 8,
        "A mineral muscles and nerves need.", "Low magnesium can cause cramps and twitching.", "High."),

    // ── Inflammation / cardiac ──
    "hs-crp": R("hs-CRP", ["mg/l"], null, 3, 0, 200,
        "A sensitive marker of low-grade inflammation, linked to heart risk.", undefined,
        "Raised — suggests inflammation worth discussing with the doctor."),
    "troponin i": R("Troponin I", ["ng/ml"], null, 0.04, 0, 100,
        "A protein released when heart muscle is damaged.", undefined,
        "Raised troponin needs urgent medical attention."),

    // ── Urine routine ──
    "urine protein": R("Urine Protein", ["mg/dl"], null, 15, 0, 2000,
        "Protein leaking into urine.", undefined,
        "Protein in urine can be an early sign the kidneys need checking."),
    "urine glucose": R("Urine Glucose", ["mg/dl"], null, 15, 0, 2000,
        "Sugar spilling into urine.", undefined, "Sugar in urine usually means blood sugar is running high."),
    "urine ph": R("Urine pH", [""], 4.6, 8.0, 3, 10,
        "How acidic or alkaline your urine is.", "More acidic than usual.", "More alkaline than usual."),
    "urine specific gravity": R("Urine Specific Gravity", [""], 1.005, 1.030, 1.0, 1.06,
        "How concentrated your urine is — a rough hydration check.",
        "Very dilute — often just a lot of water intake.", "Concentrated — often a sign of dehydration."),

    // ── Other common ──
    "folate": R("Folate", ["ng/ml"], 3, 17, 0.1, 100,
        "A vitamin needed to make healthy blood cells.",
        "Low folate can cause anaemia and tiredness — common in pregnancy.", undefined),
    "psa": R("PSA", ["ng/ml"], null, 4, 0, 200,
        "A prostate marker checked in older men.", undefined,
        "Raised PSA needs follow-up with the doctor — it has several possible causes."),
    "hba1c estimated average glucose": R("Estimated Average Glucose", ["mg/dl"], 70, 114, 20, 700,
        "Your average blood sugar in the same units as a normal sugar test.", "Low.", "High."),
};

/** Currency and other units that prove a number is NOT a medical measurement */
const NON_MEDICAL_UNITS = [
    "inr", "rs", "rs.", "₹", "rupees", "rupee", "usd", "$", "eur", "€", "gbp", "£",
    "lakh", "lakhs", "crore", "crores", "%off", "percent off", "days", "months", "years",
    "sessions", "calls", "pages", "page", "items", "pcs", "qty", "no.", "number",
];

/** Words in a test name that mean it is a price/plan/ID, not a health measure */
const NON_MEDICAL_NAME_HINTS = [
    "price", "cost", "fee", "amount", "total amount", "payment", "invoice", "bill amount",
    "package", "plan", "discount", "gst", "tax", "balance", "due", "salary", "budget",
    "phone", "mobile", "contact", "pin", "pincode", "id", "reg no", "registration",
    "invoice no", "receipt", "order", "quantity", "session", "duration",
];

function normUnit(unit: string): string {
    return (unit || "").trim().toLowerCase().replace(/\s+/g, "");
}

function normKey(name: string): string {
    return (name || "").trim().toLowerCase().replace(/\s+/g, " ");
}

/** Look up trustworthy reference data for a test name */
export function findReference(test: string): TestReference | null {
    const key = normKey(test);
    if (MEDICAL_REFERENCE[key]) return MEDICAL_REFERENCE[key];
    // tolerate small naming differences ("HBA1C", "Vitamin D3", "S. Creatinine")
    const stripped = key.replace(/^(s\.|serum|total|plasma)\s+/, "").replace(/\s*\(.*?\)\s*/g, " ").trim();
    if (MEDICAL_REFERENCE[stripped]) return MEDICAL_REFERENCE[stripped];
    for (const [k, ref] of Object.entries(MEDICAL_REFERENCE)) {
        if (stripped.startsWith(k) || k.startsWith(stripped)) return ref;
    }
    return null;
}

export interface ValidationResult {
    ok: boolean;
    reason?: string;
    /** Cleaned-up metric to save when ok */
    normalized?: {
        test: string; value: number; unit: string;
        refLow: number | null; refHigh: number | null;
        status: "low" | "normal" | "high" | "unknown";
    };
}

/**
 * The guard. Decides whether an extracted number is a real medical reading
 * and repairs its reference range using trusted values.
 */
export function validateMetric(input: {
    test: string; value: unknown; unit?: string;
    refLow?: unknown; refHigh?: unknown;
    docType?: string;
}): ValidationResult {
    const test = String(input.test || "").trim();
    const unit = String(input.unit || "").trim();
    const value = Number(input.value);

    if (!test) return { ok: false, reason: "no test name" };
    if (!isFinite(value)) return { ok: false, reason: "value not numeric" };

    // Only clinical documents may contribute measurements at all
    if (input.docType && !["lab_report", "imaging", "prescription"].includes(input.docType)) {
        return { ok: false, reason: `non-clinical document (${input.docType})` };
    }

    // Currency / counts / durations are never medical readings
    const u = normUnit(unit);
    if (NON_MEDICAL_UNITS.some(bad => u === normUnit(bad) || u.includes("inr") || u.includes("rs") || u.includes("₹"))) {
        return { ok: false, reason: `non-medical unit "${unit}"` };
    }
    const nameLower = test.toLowerCase();
    if (NON_MEDICAL_NAME_HINTS.some(h => nameLower.includes(h))) {
        return { ok: false, reason: `non-medical field "${test}"` };
    }

    const ref = findReference(test);

    // Unknown test: keep it only if it looks like a lab value with a sane unit
    if (!ref) {
        if (!unit || u.length > 12) return { ok: false, reason: "unknown test without a clear unit" };
        const refLow = isFinite(Number(input.refLow)) ? Number(input.refLow) : null;
        const refHigh = isFinite(Number(input.refHigh)) ? Number(input.refHigh) : null;
        const sane = refLow == null || refHigh == null || refLow < refHigh;
        if (!sane) return { ok: false, reason: "reference range is contradictory" };
        return {
            ok: true,
            normalized: {
                test, value, unit,
                refLow, refHigh,
                status: statusFrom(value, refLow, refHigh),
            },
        };
    }

    // Known test: unit must match what this test is measured in
    if (unit && ref.units.length && !ref.units.some(x => normUnit(x) === u)) {
        // allow a missing/odd unit only if the value is physiologically plausible
        if (value < ref.plausibleMin || value > ref.plausibleMax) {
            return { ok: false, reason: `unit "${unit}" is wrong for ${ref.name}` };
        }
    }

    // Known test: the value itself must be physically possible
    if (value < ref.plausibleMin || value > ref.plausibleMax) {
        return { ok: false, reason: `${value} is impossible for ${ref.name}` };
    }

    // Trust the lab's printed range only if it is sane; otherwise use ours
    let refLow = isFinite(Number(input.refLow)) ? Number(input.refLow) : null;
    let refHigh = isFinite(Number(input.refHigh)) ? Number(input.refHigh) : null;
    const printedSane =
        (refLow == null || (refLow >= ref.plausibleMin && refLow <= ref.plausibleMax)) &&
        (refHigh == null || (refHigh >= ref.plausibleMin && refHigh <= ref.plausibleMax)) &&
        (refLow == null || refHigh == null || refLow < refHigh) &&
        !(refLow == null && refHigh != null && ref.normalHigh != null && refHigh < ref.normalHigh / 5);
    if (!printedSane) { refLow = ref.normalLow; refHigh = ref.normalHigh; }
    if (refLow == null && refHigh == null) { refLow = ref.normalLow; refHigh = ref.normalHigh; }

    return {
        ok: true,
        normalized: {
            test: ref.name, value, unit: unit || ref.units[0] || "",
            refLow, refHigh, status: statusFrom(value, refLow, refHigh),
        },
    };
}

function statusFrom(value: number, low: number | null, high: number | null): "low" | "normal" | "high" | "unknown" {
    if (low != null && value < low) return "low";
    if (high != null && value > high) return "high";
    if (low != null || high != null) return "normal";
    return "unknown";
}

/** Plain-language explanation shown under a reading */
export function explainMetric(test: string, status: string): { what: string; meaning: string } | null {
    const ref = findReference(test);
    if (!ref) return null;
    const meaning = status === "low" ? (ref.low || "") : status === "high" ? (ref.high || "") : "";
    return { what: ref.what, meaning };
}
