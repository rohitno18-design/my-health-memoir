import type { Timestamp } from "firebase/firestore";

export interface Chat {
    id: string;
    title: string;
    createdAt: Timestamp;
    updatedAt: Timestamp;
    messageCount: number;
}

export interface DocumentResultCard {
    id: string;
    name: string;
    docDate: string;
    category: string;
    summarySnippet: string;
    doctorName?: string;
    hospital?: string;
    url: string;
}

export interface PendingAction {
    toolName: string;
    description: string;
    args: Record<string, unknown>;
}

export interface ChatMessage {
    id: string;
    role: "user" | "model";
    content: string;
    timestamp: Timestamp;
    documentResults?: DocumentResultCard[];
    pendingActions?: PendingAction[];
    attachedDocIds?: string[]; // New: IDs of documents user attached to this message
}
