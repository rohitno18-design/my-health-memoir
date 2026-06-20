// Secure Gemini API client with Cloud Function proxy + direct fallback
// Priority: Cloud Function (API key hidden) → Direct API (fallback only)

import { getFunctions, httpsCallable } from "firebase/functions";

// ── Cloud Function proxy (API key stays on server) ──
const functions = getFunctions();
const proxyGemini = httpsCallable<Record<string, unknown>, Record<string, unknown>>(functions, 'proxyGemini');

// ── Direct API (fallback only — key is exposed but restricted by HTTP referrer) ──
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "AIzaSyBlKJQhfuuG00VxUQZU_vXbYbPkkq7S35E";
const GEMINI_MODEL = "gemini-1.5-flash";
const GEMINI_API_VERSION = "v1beta";

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
 * Call Gemini API — tries Cloud Function proxy first (secure, API key hidden),
 * falls back to direct API call if the proxy is unreachable.
 */
export async function callGeminiDirect(request: GeminiRequest): Promise<GeminiResponse> {
    // ── Attempt 1: Cloud Function proxy (API key hidden on server) ──
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
        // If the proxy returns a rate limit error or DAILY_LIMIT, DO NOT fallback to direct API
        if (proxyErr.message?.includes("DAILY_LIMIT") || proxyErr.code === "resource-exhausted") {
            console.error("[Gemini] ❌ Rate limit exceeded via proxy. Blocking fallback.");
            throw proxyErr;
        }
        console.warn("[Gemini] ⚠️ Cloud Function proxy failed, falling back to direct API:", proxyErr.message);
    }

    // ── Attempt 2: Direct API call (fallback) ──
    const url = `https://generativelanguage.googleapis.com/${GEMINI_API_VERSION}/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

    const body: Record<string, unknown> = { contents: request.contents };
    if (request.systemInstruction) body.system_instruction = request.systemInstruction;
    if (request.tools) body.tools = request.tools;
    if (request.toolConfig) body.tool_config = request.toolConfig;

    const genConfig = request.generationConfig || {};
    if (!genConfig.temperature) genConfig.temperature = 0.2;
    if (!genConfig.maxOutputTokens) genConfig.maxOutputTokens = 4096;
    body.generation_config = genConfig;

    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const errorBody = await response.text();
        console.error(`[Gemini] ❌ Direct API error ${response.status}:`, errorBody);
        throw new Error(`Gemini API Error ${response.status}: ${errorBody}`);
    }

    console.log("[Gemini] ✅ Direct API call succeeded (fallback)");
    return await response.json();
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
