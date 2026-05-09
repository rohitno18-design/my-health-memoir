import { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface FeatureFlags {
    aiChatEnabled: boolean;
    documentAnalysisEnabled: boolean;
    emergencyPulseEnabled: boolean;
    newRegistrationsEnabled: boolean;
}

const DEFAULT_FLAGS: FeatureFlags = {
    aiChatEnabled: true,
    documentAnalysisEnabled: true,
    emergencyPulseEnabled: true,
    newRegistrationsEnabled: true,
};

export function useFeatureFlags() {
    const [flags, setFlags] = useState<FeatureFlags>(DEFAULT_FLAGS);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        const load = async () => {
            try {
                const snap = await getDoc(doc(db, "app_config", "feature_flags"));
                if (snap.exists()) {
                    setFlags({ ...DEFAULT_FLAGS, ...snap.data() });
                }
            } catch (e) {
                console.warn("Failed to load feature flags, using defaults:", e);
            } finally {
                setLoaded(true);
            }
        };
        load();
    }, []);

    return { flags, loaded };
}
