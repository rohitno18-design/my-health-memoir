import { onCall, HttpsError } from "firebase-functions/v2/https";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";
import { getAppCheck } from "firebase-admin/app-check";

initializeApp();
const adminDb = getFirestore();
const fAdminAuth = getAuth();

// Lazy-initialized to avoid cold start timeout
let _storage: ReturnType<typeof getStorage> | null = null;
let _bucket: ReturnType<ReturnType<typeof getStorage>['bucket']> | null = null;
let _appCheck: ReturnType<typeof getAppCheck> | null = null;

function storage() { if (!_storage) _storage = getStorage(); return _storage; }
function bucket() { if (!_bucket) _bucket = storage().bucket("im-smrti.firebasestorage.app"); return _bucket; }
function appCheck() { if (!_appCheck) _appCheck = getAppCheck(); return _appCheck; }

// ── proxyGemini — secure API key server-side with per-user daily limits ──
const MAX_TOKENS_PER_DAY = 2000000; // 2 Million tokens is ~$0.15 (12-15 rupees) on Flash, safely under ₹100 limit

export const proxyGemini = onCall({ invoker: "public", cors: true }, async (request) => {
  const data = request.data as {
    contents: unknown[];
    userId?: string;
    systemInstruction?: { parts: { text: string }[] };
    tools?: unknown[];
    toolConfig?: unknown;
    generationConfig?: Record<string, unknown>;
  };

  let currentTokens = 0;
  let currentCalls = 0;
  let usageRef: any = null;

  // ── Per-user daily rate limit (using tokens) ──
  if (data.userId) {
    try {
      const today = new Date().toISOString().split("T")[0];
      usageRef = adminDb.collection("user_usage").doc(data.userId).collection("daily").doc(today) as any;
      const usageDoc = await usageRef!.get();
      
      currentTokens = usageDoc.exists ? (usageDoc.data()?.tokens || 0) : 0;
      currentCalls = usageDoc.exists ? (usageDoc.data()?.calls || 0) : 0;

      if (currentTokens >= MAX_TOKENS_PER_DAY) {
        throw new HttpsError("resource-exhausted", `DAILY_LIMIT: You have reached your daily AI token usage limit (${MAX_TOKENS_PER_DAY} tokens). Limit resets at midnight UTC.`);
      }
    } catch (e: any) {
      // If it's a rate limit error, re-throw it; otherwise ignore and continue
      if (e.code === "resource-exhausted") throw e;
      console.warn("Rate limit check failed (non-blocking):", e.message);
    }
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY || "";
    // Forced fallback to gemini-1.5-flash as the cheapest and fastest model
    const model = process.env.GEMINI_MODEL || "gemini-1.5-flash";
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
      throw new HttpsError("internal", `Gemini API Error ${response.status}: ${errorBody}`);
    }

    const result = await response.json();

    // ── Update token count asynchronously ──
    if (usageRef && result.usageMetadata?.totalTokenCount) {
      const usedTokens = result.usageMetadata.totalTokenCount;
      usageRef.set({ 
        tokens: currentTokens + usedTokens, 
        calls: currentCalls + 1, 
        lastCallAt: new Date().toISOString() 
      }, { merge: true }).catch((err: any) => console.error("Failed to update token usage:", err));
    }

    return result as Record<string, unknown>;
  } catch (err: any) {
    throw new HttpsError("internal", `Proxy Error: ${err.message}`);
  }
});

// ── getEmergencyInfo — secure pulse access with token validation ──────────
export const getEmergencyInfo = onCall({ cors: true }, async (request) => {
  const { userId, pulseToken } = request.data as { userId: string; pulseToken?: string };
  if (!userId) throw new Error("userId is required");

  const docRef = adminDb.collection("emergency_info").doc(userId);
  const doc = await docRef.get();
  if (!doc.exists) throw new Error("Emergency info not found");

  const data = doc.data();
  if (!data) throw new Error("Emergency info is empty");
  if (data.pulseToken && pulseToken !== data.pulseToken) {
    throw new Error("Invalid or missing pulse token");
  }

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

// ── setAdminClaim — manage admin custom claims (admin-only) ───────────────
export const setAdminClaim = onCall(async (request) => {
  const { targetUid, isAdmin } = request.data as { targetUid: string; isAdmin: boolean };
  if (!targetUid) throw new Error("targetUid is required");

  const callerUid = request.auth?.uid;
  if (!callerUid) throw new Error("Authentication required");

  const callerUser = await fAdminAuth.getUser(callerUid);
  const isHardcodedAdmin = callerUser.email === "rohit.official36@gmail.com" || callerUser.email === "rohit.no18@gmail.com";
  if (!callerUser.customClaims?.admin && !isHardcodedAdmin) {
    throw new Error("Only admins can manage admin claims");
  }

  const existingClaims = (await fAdminAuth.getUser(targetUid)).customClaims || {};
  await fAdminAuth.setCustomUserClaims(targetUid, { ...existingClaims, admin: !!isAdmin });

  if (isAdmin) {
    await adminDb.collection("users").doc(targetUid).set({ role: "admin" }, { merge: true });
  } else {
    await adminDb.collection("users").doc(targetUid).set({ role: "patient" }, { merge: true });
  }

  return { success: true };
});

// ── enableAppCheck — one-time setup to configure App Check ─────────────
export const enableAppCheck = onCall(async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new Error("Authentication required");

  const callerUser = await fAdminAuth.getUser(callerUid);
  const isHardcodedAdmin = callerUser.email === "rohit.official36@gmail.com" || callerUser.email === "rohit.no18@gmail.com";
  if (!callerUser.customClaims?.admin && !isHardcodedAdmin) {
    throw new Error("Only admins can configure App Check");
  }

  const appId = "1:541123545766:web:c4266829082bd3ef1cc267";
  const siteSecret = process.env.RECAPTCHA_SECRET_KEY || request.data?.siteSecret as string;
  if (!siteSecret) throw new Error("RECAPTCHA_SECRET_KEY is required");

  try {
    await (appCheck() as any).createRecaptchaV3Config(appId, {
      siteSecret,
      tokenTtl: "3600s",
    });
  } catch (e: any) {
    if (e.code === 409 || e.message?.includes("already exists")) {
      await (appCheck() as any).updateRecaptchaV3Config(appId, {
        siteSecret,
        tokenTtl: "3600s",
      });
    } else {
      throw e;
    }
  }

  return { success: true, message: "App Check configured" };
});

// ── getSignedUrl — generate time-limited download URL for documents ──────
export const getSignedUrl = onCall(async (request) => {
  const { storagePath, expiryMinutes } = request.data as { storagePath: string; expiryMinutes?: number };
  if (!storagePath) throw new Error("storagePath is required");

  // Only authenticated users can get signed URLs
  if (!request.auth?.uid) throw new Error("Authentication required");

  const expires = Date.now() + (expiryMinutes || 10) * 60 * 1000;

  const [signedUrl] = await bucket().file(storagePath).getSignedUrl({
    action: "read",
    expires,
  });

  return { url: signedUrl, expires };
});
