// Backfill: turn already-uploaded documents into structured health data.
// Instead of re-sending the original images to the AI (expensive, slow, burns
// the monthly quota), we re-read the prose summary that was already generated
// — it already contains the values, so a cheap text-only call structures them.
import { collection, query, where, getDocs, updateDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { callGeminiDirect, extractGeminiText } from "@/lib/gemini";
import { EXTRACTION_INSTRUCTIONS, EXTRACTION_SCHEMA } from "@/lib/healthData";
import { parseExtraction, saveExtraction, clearExtractionFor } from "@/lib/healthExtract";

export interface BackfillProgress {
    total: number;
    done: number;
    recordsCreated: number;
    failed: number;
}

/** Documents that still have no structured data extracted */
export async function findUnextractedDocs(userId: string) {
    const snap = await getDocs(query(collection(db, "documents"), where("userId", "==", userId)));
    return snap.docs
        .map(d => ({ id: d.id, ...(d.data() as any) }))
        .filter(d => d.extracted !== true && typeof d.aiSummary === "string" && d.aiSummary.trim().length > 40);
}

/**
 * Structure up to `limit` documents. Returns progress; call again to continue.
 * Stops early and reports if the AI quota is hit, so nothing is lost.
 */
export async function backfillDocuments(
    userId: string,
    limit = 40,
    onProgress?: (p: BackfillProgress) => void
): Promise<BackfillProgress & { quotaHit: boolean }> {
    const pending = (await findUnextractedDocs(userId)).slice(0, limit);
    const progress: BackfillProgress = { total: pending.length, done: 0, recordsCreated: 0, failed: 0 };
    let quotaHit = false;

    for (const d of pending) {
        try {
            const prompt = `A medical document summary is given below. Extract structured health data from it.
${EXTRACTION_INSTRUCTIONS}

For "summaryMarkdown", simply return the original summary text unchanged.
Report date if known: ${d.docDate || "not stated"}.

SUMMARY:
${String(d.aiSummary).slice(0, 6000)}`;

            const res = await callGeminiDirect({
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0,
                    maxOutputTokens: 4096,
                    responseMimeType: "application/json",
                    responseSchema: EXTRACTION_SCHEMA,
                },
                feature: "doc_summary",
            });

            const parsed = parseExtraction(extractGeminiText(res));
            if (parsed) {
                await clearExtractionFor(d.id); // idempotent re-runs
                const n = await saveExtraction(parsed, {
                    userId,
                    patientId: d.patientId || "",
                    documentId: d.id,
                    documentName: d.name || "Document",
                    fallbackDate: d.docDate,
                });
                progress.recordsCreated += n;
                await updateDoc(doc(db, "documents", d.id), { extracted: true });
            } else {
                progress.failed++;
            }
        } catch (e: any) {
            const msg = String(e?.message || "");
            if (msg.includes("MONTHLY_LIMIT") || msg.includes("DAILY_LIMIT") || msg.includes("resource-exhausted")) {
                quotaHit = true;
                break;
            }
            console.warn("Backfill failed for doc", d.id, e);
            progress.failed++;
        }
        progress.done++;
        onProgress?.({ ...progress });
    }

    return { ...progress, quotaHit };
}
