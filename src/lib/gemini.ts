// Secure Gemini API client with Cloud Function proxy
// Priority: Cloud Function (API key hidden) only

import { getFunctions, httpsCallable } from "firebase/functions";

// ── Cloud Function proxy (API key stays on server) ──
const functions = getFunctions();
const proxyGemini = httpsCallable<Record<string, unknown>, Record<string, unknown>>(functions, 'proxyGemini');

export interface GeminiRequest {
    contents: unknown[];
    systemInstruction?: { parts: { text: string }[] };
    tools?: unknown[];
    toolConfig?: unknown;
    generationConfig?: Record<string, unknown>;
}

export interface GeminiResponse {
    candidates?: Array<{
        content?: {
            parts?: Array<{
                text?: string;
                thought?: boolean;
                functionCall?: { name: string; args: Record<string, unknown> };
                functionResponse?: { name: string; response: Record<string, unknown> };
            }>;
        };
    }>;
}

/**
 * Call Gemini API — securely routes through Cloud Function proxy
 * so that the API key is never exposed to the frontend.
 */
export async function callGeminiDirect(request: GeminiRequest): Promise<GeminiResponse> {
    try {
        const result = await proxyGemini({
            contents: request.contents,
            systemInstruction: request.systemInstruction,
            tools: request.tools,
            toolConfig: request.toolConfig,
            generationConfig: request.generationConfig,
        });
        console.log("[Gemini] ✅ Cloud Function proxy succeeded");
        return result.data as unknown as GeminiResponse;
    } catch (proxyErr: any) {
        if (proxyErr.message?.includes("DAILY_LIMIT") || proxyErr.code === "resource-exhausted") {
            console.error("[Gemini] ❌ Rate limit exceeded via proxy.");
            throw proxyErr;
        }
        console.error("[Gemini] ❌ Cloud Function proxy failed:", proxyErr);
        throw proxyErr;
    }
}

/**
 * Extract the actual text from a Gemini response, handling thinking models
 * where parts[0] may be a thought and the real text is in a later part.
 */
export function extractGeminiText(data: GeminiResponse): string {
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const textPart = parts.find(p => !p.thought && p.text);
    return textPart?.text ?? "";
}
