import { onCall } from "firebase-functions/v2/https";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

initializeApp();
const adminDb = getFirestore();

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

// Securely retrieve emergency info with token validation
export const getEmergencyInfo = onCall({ cors: true }, async (request) => {
  const { userId, pulseToken } = request.data as { userId: string; pulseToken?: string };

  if (!userId) throw new Error("userId is required");

  const docRef = adminDb.collection("emergency_info").doc(userId);
  const doc = await docRef.get();

  if (!doc.exists) throw new Error("Emergency info not found");

  const data = doc.data();
  if (!data) throw new Error("Emergency info is empty");

  // If a pulseToken is set, the request must include the matching token
  if (data.pulseToken && pulseToken !== data.pulseToken) {
    throw new Error("Invalid or missing pulse token");
  }

  // Return sanitized emergency data
  return {
    bloodType: data.bloodType || "",
    allergies: data.allergies || [],
    conditions: data.conditions || [],
    medications: data.medications || [],
    iceContacts: data.iceContacts || [],
    organDonor: data.organDonor || false,
    notifiedOnSOS: data.notifiedOnSOS || false,
  };
});
