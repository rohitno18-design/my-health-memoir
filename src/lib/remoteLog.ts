import { db } from "./firebase";
import { collection, addDoc } from "firebase/firestore";

export function remoteLog(type: string, data: any) {
    console.log(`[RemoteLog] ${type}:`, data);
    const payload = {
        type,
        data: JSON.parse(JSON.stringify(data)),
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href
    };
    
    // Fire and forget so we don't block main flow
    addDoc(collection(db, "debug_logs"), payload).catch(e => console.error("RemoteLog failed", e));
}
