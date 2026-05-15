import { onCall } from "firebase-functions/v2/https";

interface GeminiRequest {
  contents: unknown[];
  systemInstruction?: { parts: { text: string }[] };
  tools?: unknown[];
  toolConfig?: unknown;
  generationConfig?: Record<string, unknown>;
}

// Proxy all Gemini API calls through this Cloud Function to keep the API key server-side
export const proxyGemini = onCall(async (request) => {
  const data = request.data as GeminiRequest;
  const apiKey = process.env.GEMINI_API_KEY || "";
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const version = process.env.GEMINI_API_VERSION || "v1beta";

  const url = `https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent?key=${apiKey}`;

  const body: Record<string, unknown> = { contents: data.contents };

  if (data.systemInstruction) body.system_instruction = data.systemInstruction;
  if (data.tools) body.tools = data.tools;
  if (data.toolConfig) body.tool_config = data.toolConfig;

  const genConfig = data.generationConfig || {};
  if (!genConfig.temperature) genConfig.temperature = 0.2;
  if (!genConfig.maxOutputTokens) genConfig.maxOutputTokens = 2048;
  body.generation_config = genConfig;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`Gemini API error ${response.status}: ${errorBody}`);
    throw new Error(`Gemini API returned ${response.status}`);
  }

  const result = await response.json();
  return result as Record<string, unknown>;
});
