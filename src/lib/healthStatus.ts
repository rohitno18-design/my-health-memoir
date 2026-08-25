// ── Health trajectory engine ─────────────────────────────────────────────
// Answers three questions for one family member:
//   1. Where is their health RIGHT NOW?
//   2. Which way is it HEADING?
//   3. What can they actually DO about it?
//
// Everything here is computed from the person's own structured records —
// no AI guessing, no invented numbers. The AI is used later only to phrase
// the result kindly; the facts come from this file.

import type { HealthMetric } from "@/lib/healthData";

export type Direction = "improving" | "worsening" | "stable" | "unknown";

export interface TestTrajectory {
    test: string;
    unit: string;
    latest: HealthMetric;
    previous: HealthMetric | null;
    readings: number;
    /** Is the newest value inside the normal range? */
    inRange: boolean;
    /** Is it moving toward or away from the normal range? */
    direction: Direction;
    /** % change between the last two readings */
    changePct: number | null;
    /** How concerning this is right now (higher = more attention needed) */
    concern: number;
}

export interface HealthPicture {
    patientId: string;
    /** 0-100. Not a medical score — a plain "how much needs attention" gauge */
    score: number;
    headline: "good" | "watch" | "attention";
    totalTests: number;
    outOfRange: TestTrajectory[];
    improving: TestTrajectory[];
    worsening: TestTrajectory[];
    stable: TestTrajectory[];
    /** Concrete, non-prescriptive suggestions tied to the actual findings */
    actions: HealthAction[];
    lastUpdated: string | null;
}

export interface HealthAction {
    priority: "high" | "medium" | "low";
    title: string;
    why: string;
    tests: string[];
}

/**
 * Distance outside the normal range, scaled 0..2 (0 = perfectly in range).
 * Measured two ways and we take the worse of the two, because either alone
 * misjudges real cases:
 *  - span-relative: good for narrow ranges (HbA1c 4–5.6)
 *  - bound-relative: catches values far below a high threshold, e.g. Vitamin D
 *    8.4 against a floor of 30 is severe deficiency, but is only a third of
 *    the 30–100 span and would otherwise look mild.
 */
function severity(m: HealthMetric): number {
    const { value, refLow, refHigh } = m;
    if (refLow != null && value < refLow) {
        const span = refHigh != null ? refHigh - refLow : refLow;
        const bySpan = span > 0 ? (refLow - value) / span : 0.5;
        const byBound = refLow !== 0 ? (refLow - value) / Math.abs(refLow) : bySpan;
        return Math.min(Math.max(bySpan, byBound), 2);
    }
    if (refHigh != null && value > refHigh) {
        const span = refLow != null ? refHigh - refLow : refHigh;
        const bySpan = span > 0 ? (value - refHigh) / span : 0.5;
        const byBound = refHigh !== 0 ? (value - refHigh) / Math.abs(refHigh) : bySpan;
        return Math.min(Math.max(bySpan, byBound), 2);
    }
    return 0;
}

/** Did the value move toward the healthy range, or away from it? */
function directionOf(latest: HealthMetric, previous: HealthMetric | null): Direction {
    if (!previous) return "unknown";
    const sNow = severity(latest);
    const sBefore = severity(previous);
    const delta = Math.abs(latest.value - previous.value);
    const scale = Math.abs(previous.value) || 1;
    if (delta / scale < 0.03) return "stable";        // <3% movement is noise
    if (sNow < sBefore - 0.02) return "improving";
    if (sNow > sBefore + 0.02) return "worsening";
    return "stable";
}

/** Build the full picture for one family member from their metrics */
export function buildHealthPicture(patientId: string, metrics: HealthMetric[]): HealthPicture {
    const byTest = new Map<string, HealthMetric[]>();
    for (const m of metrics) {
        if (!m.test) continue;
        if (!byTest.has(m.test)) byTest.set(m.test, []);
        byTest.get(m.test)!.push(m);
    }

    const trajectories: TestTrajectory[] = [];
    for (const [test, rows] of byTest) {
        const sorted = [...rows].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
        const latest = sorted[sorted.length - 1];
        const previous = sorted.length > 1 ? sorted[sorted.length - 2] : null;
        const direction = directionOf(latest, previous);
        const changePct = previous && previous.value !== 0
            ? ((latest.value - previous.value) / Math.abs(previous.value)) * 100
            : null;
        const sev = severity(latest);
        // Concern rises with how far out of range it is, and if it is worsening
        const concern = sev * (direction === "worsening" ? 1.6 : direction === "improving" ? 0.7 : 1);
        trajectories.push({
            test, unit: latest.unit, latest, previous,
            readings: sorted.length,
            inRange: sev === 0,
            direction, changePct, concern,
        });
    }

    trajectories.sort((a, b) => b.concern - a.concern);

    const outOfRange = trajectories.filter(t => !t.inRange);
    const improving = trajectories.filter(t => t.direction === "improving");
    const worsening = trajectories.filter(t => t.direction === "worsening");
    const stable = trajectories.filter(t => t.direction === "stable" && t.inRange);

    // Score: start at 100, subtract for each out-of-range result, weighted by
    // how far out it is and whether it is getting worse. Deliberately gentle —
    // this is a nudge, not a diagnosis.
    let penalty = 0;
    for (const t of trajectories) {
        if (t.inRange) continue;
        penalty += Math.min(severity(t.latest) * 18, 25) + (t.direction === "worsening" ? 6 : 0);
    }
    const score = Math.max(20, Math.min(100, Math.round(100 - penalty)));
    const headline: HealthPicture["headline"] =
        outOfRange.length === 0 ? "good" : score >= 75 ? "watch" : "attention";

    const dates = metrics.map(m => m.date).filter(Boolean).sort();

    return {
        patientId, score, headline,
        totalTests: trajectories.length,
        outOfRange, improving, worsening, stable,
        actions: buildActions(trajectories),
        lastUpdated: dates.length ? dates[dates.length - 1] : null,
    };
}

// Test groups that share a lifestyle response, so advice stays concrete
const GROUPS: Array<{ match: string[]; action: HealthAction }> = [
    {
        match: ["HbA1c", "Fasting Blood Sugar", "Post Prandial Blood Sugar", "Random Blood Sugar", "Estimated Average Glucose", "Insulin Fasting"],
        action: {
            priority: "high", tests: [],
            title: "Blood sugar needs attention",
            why: "Sugar readings are above the normal range. Cutting down on sugar, refined flour and fried food, plus a 30-minute walk daily, makes a real difference — and this is worth reviewing with a doctor.",
        },
    },
    {
        match: ["Total Cholesterol", "LDL", "Triglycerides", "VLDL", "HDL"],
        action: {
            priority: "medium", tests: [],
            title: "Cholesterol is outside the healthy range",
            why: "Blood fats are off target. Less fried and packaged food, more physical activity, and cooking with less oil usually helps. Ask the doctor whether anything more is needed.",
        },
    },
    {
        match: ["Vitamin D", "Vitamin B12", "Folate", "Calcium", "Iron", "Ferritin"],
        action: {
            priority: "medium", tests: [],
            title: "A vitamin or mineral is low",
            why: "Deficiencies like this are very common in India and are usually easy to correct with supplements and diet. Ask the doctor which supplement and for how long.",
        },
    },
    {
        match: ["Hemoglobin", "Hematocrit", "RBC Count", "MCV", "MCH", "MCHC"],
        action: {
            priority: "high", tests: [],
            title: "Signs of low blood count (anaemia)",
            why: "These readings point to anaemia, which explains tiredness and weakness. It is very treatable once the cause is known — worth showing the doctor.",
        },
    },
    {
        match: ["Creatinine", "Urea", "BUN", "eGFR", "Uric Acid", "Urine Protein"],
        action: {
            priority: "high", tests: [],
            title: "Kidney-related readings are off",
            why: "Kidney markers are outside the usual range. Staying well hydrated helps, but these results should be reviewed by a doctor rather than managed at home.",
        },
    },
    {
        match: ["SGPT (ALT)", "SGOT (AST)", "GGT", "Bilirubin Total", "Bilirubin Direct", "Alkaline Phosphatase", "Albumin", "Total Protein"],
        action: {
            priority: "medium", tests: [],
            title: "Liver readings are raised",
            why: "Liver enzymes are above normal. Common causes are fatty liver, alcohol or certain medicines. Reducing alcohol and losing some weight helps — please discuss with the doctor.",
        },
    },
    {
        match: ["TSH", "T3", "T4", "Free T4"],
        action: {
            priority: "medium", tests: [],
            title: "Thyroid needs checking",
            why: "Thyroid readings are outside normal. This is common, easily treated, and explains symptoms like tiredness, weight change or feeling cold — a doctor can confirm.",
        },
    },
    {
        match: ["Systolic BP", "Diastolic BP"],
        action: {
            priority: "high", tests: [],
            title: "Blood pressure is above the healthy range",
            why: "Raised blood pressure strains the heart quietly over years. Less salt, regular walking and good sleep help — and a doctor should see these readings.",
        },
    },
    {
        match: ["ESR", "CRP", "hs-CRP"],
        action: {
            priority: "medium", tests: [],
            title: "Inflammation markers are raised",
            why: "The body is showing signs of inflammation somewhere. On its own this doesn't say why — a doctor can look at it alongside the other results.",
        },
    },
];

function buildActions(trajectories: TestTrajectory[]): HealthAction[] {
    const problem = trajectories.filter(t => !t.inRange);
    const actions: HealthAction[] = [];

    for (const g of GROUPS) {
        const hits = problem.filter(t => g.match.includes(t.test));
        if (!hits.length) continue;
        const worsening = hits.some(t => t.direction === "worsening");
        actions.push({
            ...g.action,
            tests: hits.map(t => t.test),
            priority: worsening ? "high" : g.action.priority,
        });
    }

    // Anything abnormal that didn't match a known group still deserves a mention
    const covered = new Set(actions.flatMap(a => a.tests));
    const others = problem.filter(t => !covered.has(t.test));
    if (others.length) {
        actions.push({
            priority: "low",
            title: "Other readings to review",
            why: `${others.map(t => t.test).join(", ")} ${others.length === 1 ? "is" : "are"} outside the usual range. Worth mentioning at the next doctor visit.`,
            tests: others.map(t => t.test),
        });
    }

    const rank = { high: 0, medium: 1, low: 2 } as const;
    return actions.sort((a, b) => rank[a.priority] - rank[b.priority]);
}

/** One-line summary of where things are heading overall */
export function trajectorySummary(p: HealthPicture): { text: string; tone: Direction } {
    if (p.totalTests === 0) return { text: "", tone: "unknown" };
    // With only one reading per test there is nothing to compare — say nothing
    // rather than claiming things are "steady".
    const hasHistory = [...p.outOfRange, ...p.improving, ...p.worsening, ...p.stable]
        .some(t => t.previous !== null);
    if (!hasHistory) return { text: "", tone: "unknown" };
    if (p.worsening.length && p.worsening.length > p.improving.length) {
        return { text: `${p.worsening.length} reading${p.worsening.length > 1 ? "s are" : " is"} moving in the wrong direction`, tone: "worsening" };
    }
    if (p.improving.length && p.improving.length >= p.worsening.length) {
        return { text: `${p.improving.length} reading${p.improving.length > 1 ? "s are" : " is"} improving since last time`, tone: "improving" };
    }
    return { text: "Readings are holding steady", tone: "stable" };
}
