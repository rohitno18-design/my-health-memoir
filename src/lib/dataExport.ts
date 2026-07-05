// DPDP right-to-portability: gather everything the signed-in user owns
// and hand it over as a single downloadable JSON file.
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

const OWNED_COLLECTIONS = [
    "patients", "folders", "documents", "appointments",
    "life_events", "vitals", "reminders", "shared_links",
];

export async function exportMyData(uid: string): Promise<void> {
    const out: Record<string, unknown> = {
        app: "I M Smrti",
        exportedAt: new Date().toISOString(),
        userId: uid,
    };

    const profile = await getDoc(doc(db, "users", uid));
    out.profile = profile.exists() ? profile.data() : null;

    for (const coll of OWNED_COLLECTIONS) {
        try {
            const snap = await getDocs(query(collection(db, coll), where("userId", "==", uid)));
            out[coll] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch {
            out[coll] = "unavailable";
        }
    }

    const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `imsmrti-data-export-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}
