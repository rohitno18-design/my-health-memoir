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
const MAX_CALLS_PER_DAY = 300; // hard stop against runaway/scripted clients even under the token cap
const MAX_REQUEST_CHARS = 200000; // ~50k tokens of input per call
const MAX_OUTPUT_TOKENS = 4096;

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

  // ── Enforce Authentication ──
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError("unauthenticated", "You must be logged in to access AI features.");
  }
  const uid = request.auth.uid;

  // ── Validate input shape and size before spending anything ──
  if (!Array.isArray(data.contents) || data.contents.length === 0) {
    throw new HttpsError("invalid-argument", "contents must be a non-empty array.");
  }
  if (JSON.stringify(data.contents).length > MAX_REQUEST_CHARS) {
    throw new HttpsError("invalid-argument", "Request too large.");
  }

  // ── Per-user daily rate limit (using tokens) ──
  try {
    const today = new Date().toISOString().split("T")[0];
    usageRef = adminDb.collection("user_usage").doc(uid).collection("daily").doc(today) as any;
    const usageDoc = await usageRef!.get();
      
      currentTokens = usageDoc.exists ? (usageDoc.data()?.tokens || 0) : 0;
      currentCalls = usageDoc.exists ? (usageDoc.data()?.calls || 0) : 0;

      if (currentTokens >= MAX_TOKENS_PER_DAY) {
        throw new HttpsError("resource-exhausted", `DAILY_LIMIT: You have reached your daily AI token usage limit (${MAX_TOKENS_PER_DAY} tokens). Limit resets at midnight UTC.`);
      }
      if (currentCalls >= MAX_CALLS_PER_DAY) {
        throw new HttpsError("resource-exhausted", `DAILY_LIMIT: You have reached your daily AI request limit (${MAX_CALLS_PER_DAY} requests). Limit resets at midnight UTC.`);
      }
    } catch (e: any) {
      // If it's a rate limit error, re-throw it; otherwise ignore and continue
      if (e.code === "resource-exhausted") throw e;
      console.warn("Rate limit check failed (non-blocking):", e.message);
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
    const requestedMax = Number(genConfig.maxOutputTokens) || 2048;
    genConfig.maxOutputTokens = Math.min(requestedMax, MAX_OUTPUT_TOKENS);
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
  // Token is mandatory — without this, anyone who guesses a userId could
  // pull that user's emergency medical data
  if (!data.pulseToken || pulseToken !== data.pulseToken) {
    throw new Error("Invalid or missing pulse token");
  }

  // Fetch patient profile
  const patientDoc = await adminDb.collection("patients").doc(userId).get();
  const patientData = patientDoc.data() || {};

  return {
    bloodType: data.bloodType || "",
    allergies: data.allergies || [],
    conditions: data.conditions || [],
    medications: data.medications || [],
    iceContacts: data.iceContacts || [],
    notifiedOnSOS: data.notifiedOnSOS || false,
    patientName: patientData.name || data.patientName || "",
    photoURL: patientData.photoURL || data.photoURL || "",
    dob: patientData.dob || data.dob || "",
    gender: patientData.gender || data.gender || "",
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

// ── deleteMyAccount — full DPDP-compliant erasure of a user's footprint ───
// Deletes all Firestore records, Storage files, lookup entries and finally
// the Auth user itself. Callable only by the account owner.
export const deleteMyAccount = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }
  const uid = request.auth.uid;

  // 1. Top-level collections keyed by a userId field
  const ownedCollections = [
    "patients", "folders", "documents", "appointments",
    "life_events", "vitals", "reminders", "shared_links", "emergency_info",
  ];
  for (const coll of ownedCollections) {
    const snap = await adminDb.collection(coll).where("userId", "==", uid).get();
    let batch = adminDb.batch();
    let count = 0;
    for (const d of snap.docs) {
      batch.delete(d.ref);
      count++;
      if (count % 400 === 0) { await batch.commit(); batch = adminDb.batch(); }
    }
    if (count % 400 !== 0 || count === 0) await batch.commit().catch(() => undefined);
  }

  // 2. Docs keyed directly by uid (incl. all subcollections)
  await adminDb.recursiveDelete(adminDb.collection("users").doc(uid));
  await adminDb.recursiveDelete(adminDb.collection("user_usage").doc(uid));
  await adminDb.recursiveDelete(adminDb.collection("emergency_info").doc(uid)).catch(() => undefined);

  // 3. Lookup entries pointing at this uid
  const lookups = await adminDb.collection("user_lookup").where("uid", "==", uid).get();
  await Promise.all(lookups.docs.map((d) => d.ref.delete()));

  // 4. Storage files
  await bucket().deleteFiles({ prefix: `documents/${uid}/` }).catch((e) => console.warn("doc file cleanup:", e.message));
  await bucket().deleteFiles({ prefix: `profile-photos/${uid}` }).catch((e) => console.warn("photo cleanup:", e.message));

  // 5. The Auth account itself — last, so a mid-way failure leaves the user
  // able to retry rather than locked out with orphaned data
  await fAdminAuth.deleteUser(uid);

  return { success: true };
});

// ── getSignedUrl — generate time-limited download URL for documents ──────
export const getSignedUrl = onCall(async (request) => {
  const { storagePath, expiryMinutes } = request.data as { storagePath: string; expiryMinutes?: number };
  if (!storagePath) throw new Error("storagePath is required");

  // Only authenticated users can get signed URLs
  if (!request.auth?.uid) throw new Error("Authentication required");

  // Only allow access to the caller's own files (admins exempt) —
  // without this check any user could download any user's documents
  const uid = request.auth.uid;
  const callerEmail = request.auth.token?.email;
  const isAdmin = request.auth.token?.admin === true ||
    callerEmail === "rohit.official36@gmail.com" ||
    callerEmail === "rohit.no18@gmail.com";
  const normalizedPath = storagePath.replace(/^\/+/, "");
  const ownsPath = normalizedPath.startsWith(`documents/${uid}/`) ||
    normalizedPath === `profile-photos/${uid}`;
  if (!isAdmin && !ownsPath) {
    throw new HttpsError("permission-denied", "You can only access your own files.");
  }

  const expires = Date.now() + Math.min(expiryMinutes || 10, 60) * 60 * 1000;

  const [signedUrl] = await bucket().file(storagePath).getSignedUrl({
    action: "read",
    expires,
  });

  return { url: signedUrl, expires };
});
