import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

export type AuditActionType = 
    | "ACCOUNT_CREATED" 
    | "PASSWORD_CHANGED" 
    | "PROFILE_UPDATED" 
    | "PATIENT_ADDED" 
    | "PATIENT_REMOVED"
    | "DOCUMENT_UPLOADED" 
    | "DOCUMENT_DELETED"
    | "VITAL_ADDED"
    | "VITAL_DELETED"
    | "AI_CHAT_STARTED";

export interface AuditLog {
    userId: string;
    action: AuditActionType;
    details: string;
    timestamp: any;
    metadata?: Record<string, any>;
}

/**
 * Silently logs a user action to the Firestore audit logs collection.
 * This is designed to be fire-and-forget so it doesn't block UI execution.
 */
export const logUserAction = async (userId: string, action: AuditActionType, details: string, metadata?: Record<string, any>) => {
    try {
        if (!userId) return;
        
        await addDoc(collection(db, "audit_logs"), {
            userId,
            action,
            details,
            metadata: metadata || {},
            timestamp: serverTimestamp()
        });
    } catch (err) {
        // We deliberately swallow the error because tracking telemetry 
        // should never crash the main application functionality.
        console.warn("Failed to log telemetry event:", action);
    }
};
