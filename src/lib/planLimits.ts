// Freemium plan limits — admin-tunable via app_config/plan_limits
// (same pattern as featureFlags.ts). -1 means unlimited.
import { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface PlanLimits {
    freeMaxPatients: number;
    freeMaxDocuments: number;
    freeDocSummariesPerMonth: number;
    freeVisitBriefingsPerMonth: number;
    premiumMaxDocuments: number; // hidden abuse guard, never marketed
}

export const DEFAULT_LIMITS: PlanLimits = {
    freeMaxPatients: 2,
    freeMaxDocuments: 20,
    freeDocSummariesPerMonth: 20,
    freeVisitBriefingsPerMonth: 2,
    premiumMaxDocuments: 1000,
};

export function usePlanLimits() {
    const [limits, setLimits] = useState<PlanLimits>(DEFAULT_LIMITS);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        const load = async () => {
            try {
                const snap = await getDoc(doc(db, "app_config", "plan_limits"));
                if (snap.exists()) {
                    setLimits({ ...DEFAULT_LIMITS, ...snap.data() });
                }
            } catch (e) {
                console.warn("Failed to load plan limits, using defaults:", e);
            } finally {
                setLoaded(true);
            }
        };
        load();
    }, []);

    return { limits, loaded };
}
