// Parse the AI's structured output and persist it as typed health records.
// Kept separate from healthData.ts (pure types) because this touches Firestore.
import { collection, addDoc, query, where, getDocs, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
    type ExtractionResult, type MetricStatus,
    addDays, today,
} from "@/lib/healthData";
import { validateMetric } from "@/lib/medicalReference";

/** Tolerantly parse the model's JSON (handles ```json fences and stray prose) */
export function parseExtraction(raw: string): ExtractionResult | null {
    if (!raw) return null;
    let text = raw.trim();
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) text = fence[1].trim();
    if (!text.startsWith("{")) {
        const start = text.indexOf("{");
        const end = text.lastIndexOf("}");
        if (start === -1 || end === -1) return null;
        text = text.slice(start, end + 1);
    }
    try {
        const obj = JSON.parse(text);
        if (typeof obj !== "object" || obj === null) return null;
        return {
            summaryMarkdown: String(obj.summaryMarkdown || ""),
            docType: obj.docType || "other",
            reportDate: obj.reportDate || null,
            metrics: Array.isArray(obj.metrics) ? obj.metrics : [],
            medications: Array.isArray(obj.medications) ? obj.medications : [],
            followUps: Array.isArray(obj.followUps) ? obj.followUps : [],
        };
    } catch {
        return null;
    }
}

interface SaveContext {
    userId: string;
    patientId: string;
    documentId: string;
    documentName: string;
    fallbackDate?: string;
}

/** Remove previously extracted records for a document (used before re-extract) */
export async function clearExtractionFor(documentId: string): Promise<void> {
    for (const coll of ["health_metrics", "medications", "follow_ups"]) {
        const snap = await getDocs(query(collection(db, coll), where("documentId", "==", documentId)));
        await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
    }
}

/** Write metrics, medications and follow-ups extracted from one document */
export async function saveExtraction(result: ExtractionResult, ctx: SaveContext): Promise<number> {
    const date = (result.reportDate && /^\d{4}-\d{2}-\d{2}$/.test(result.reportDate))
        ? result.reportDate
        : (ctx.fallbackDate && /^\d{4}-\d{2}-\d{2}$/.test(ctx.fallbackDate) ? ctx.fallbackDate : today());

    const writes: Promise<unknown>[] = [];
    let count = 0;

    // A metric is only saved if it survives the medical guard — this is what
    // stops a business PDF's rupee amounts becoming "Weight" readings.
    for (const m of result.metrics) {
        const check = validateMetric({
            test: m.test, value: m.value, unit: m.unit,
            refLow: m.refLow, refHigh: m.refHigh,
            docType: result.docType,
        });
        if (!check.ok || !check.normalized) {
            console.info(`Rejected metric "${m.test}" (${m.value} ${m.unit || ""}): ${check.reason}`);
            continue;
        }
        const n = check.normalized;
        writes.push(addDoc(collection(db, "health_metrics"), {
            userId: ctx.userId, patientId: ctx.patientId,
            documentId: ctx.documentId, documentName: ctx.documentName,
            test: n.test, testRaw: String(m.testRaw || m.test).trim(),
            value: n.value, unit: n.unit,
            refLow: n.refLow, refHigh: n.refHigh,
            status: n.status as MetricStatus, date,
            createdAt: serverTimestamp(),
        }));
        count++;
    }

    for (const med of result.medications) {
        if (!med.name) continue;
        const durationDays = isFinite(Number(med.durationDays)) ? Number(med.durationDays) : null;
        writes.push(addDoc(collection(db, "medications"), {
            userId: ctx.userId, patientId: ctx.patientId, documentId: ctx.documentId,
            name: String(med.name).trim(),
            dose: String(med.dose || "").trim(),
            frequency: String(med.frequency || "").trim(),
            durationDays,
            startDate: date,
            expectedEndDate: durationDays ? addDays(date, durationDays) : null,
            createdAt: serverTimestamp(),
        }));
        count++;
    }

    for (const f of result.followUps) {
        if (!f.advice) continue;
        const inDays = isFinite(Number(f.inDays)) ? Number(f.inDays) : null;
        writes.push(addDoc(collection(db, "follow_ups"), {
            userId: ctx.userId, patientId: ctx.patientId, documentId: ctx.documentId,
            advice: String(f.advice).trim(),
            dueDate: inDays != null ? addDays(date, inDays) : null,
            status: "pending",
            createdAt: serverTimestamp(),
        }));
        count++;
    }

    await Promise.all(writes);
    return count;
}
