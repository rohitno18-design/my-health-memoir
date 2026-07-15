import { onCall, HttpsError } from "firebase-functions/v2/https";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
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
const MAX_TEXT_CHARS = 200000; // ~50k tokens of TEXT input per call (base64 media excluded)
const MAX_TOTAL_CHARS = 30000000; // media incl. — a 20MB file is ~27M chars as base64
const MAX_OUTPUT_TOKENS = 4096;

// Default free-tier plan limits — overridable live via app_config/plan_limits
const DEFAULT_PLAN_LIMITS = {
  freeDocSummariesPerMonth: 20,
  freeVisitBriefingsPerMonth: 2,
};

// Which monthly counter each metered feature uses
const FEATURE_COUNTERS: Record<string, { counter: string; limitKey: keyof typeof DEFAULT_PLAN_LIMITS }> = {
  doc_summary: { counter: "docSummaries", limitKey: "freeDocSummariesPerMonth" },
  visit_briefing: { counter: "visitBriefings", limitKey: "freeVisitBriefingsPerMonth" },
};

export const proxyGemini = onCall({ invoker: "public", cors: true }, async (request) => {
  const data = request.data as {
    contents: unknown[];
    userId?: string;
    systemInstruction?: { parts: { text: string }[] };
    tools?: unknown[];
    toolConfig?: unknown;
    generationConfig?: Record<string, unknown>;
    feature?: string;
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
  // Count text separately from inline media: photos/PDFs arrive as base64 in
  // "data" fields and are legitimately megabytes — only unchecked TEXT is a risk
  const totalChars = JSON.stringify(data.contents).length;
  const textChars = JSON.stringify(data.contents, (key, value) => (key === "data" ? undefined : value)).length;
  if (textChars > MAX_TEXT_CHARS || totalChars > MAX_TOTAL_CHARS) {
    throw new HttpsError("invalid-argument", "Request too large.");
  }

  // ── Freemium metering: premium users skip, free users are metered per
  // feature per month. Untagged calls are treated as chat (fail-closed). ──
  const feature = typeof data.feature === "string" ? data.feature : "chat";
  let monthlyRef: FirebaseFirestore.DocumentReference | null = null;
  let monthlyCounterField: string | null = null;
  try {
    const userSnap = await adminDb.collection("users").doc(uid).get();
    const userData = userSnap.data() || {};
    const isPremiumUser = userData.tier === "premium" || userData.role === "admin";

    if (!isPremiumUser) {
      if (!FEATURE_COUNTERS[feature]) {
        // chat (and anything unrecognized) is premium-only
        throw new HttpsError("permission-denied", "PREMIUM_ONLY: This AI feature requires Premium.");
      }
      const { counter, limitKey } = FEATURE_COUNTERS[feature];
      const limitsSnap = await adminDb.collection("app_config").doc("plan_limits").get();
      const limits = { ...DEFAULT_PLAN_LIMITS, ...(limitsSnap.data() || {}) };
      const limit = Number(limits[limitKey]);

      if (limit >= 0) {
        const month = new Date().toISOString().slice(0, 7); // YYYY-MM
        monthlyRef = adminDb.collection("user_usage").doc(uid).collection("monthly").doc(month);
        const monthlySnap = await monthlyRef.get();
        const used = monthlySnap.exists ? (monthlySnap.data()?.[counter] || 0) : 0;
        if (used >= limit) {
          throw new HttpsError(
            "resource-exhausted",
            `MONTHLY_LIMIT:${feature}:${limit}: Free plan allows ${limit} per month. Resets on the 1st.`
          );
        }
        monthlyCounterField = counter;
      }
    }
  } catch (e: any) {
    if (e.code === "resource-exhausted" || e.code === "permission-denied") throw e;
    console.warn("Plan metering check failed (non-blocking):", e.message);
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
    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
    // When the primary (cheap) model is overloaded, retry once more on a
    // higher-capacity model instead of failing the user's request
    const fallbackModel = process.env.GEMINI_FALLBACK_MODEL || "gemini-2.5-flash";
    const version = process.env.GEMINI_API_VERSION || "v1beta";

    const body: Record<string, unknown> = { contents: data.contents };
    if (data.systemInstruction) body.system_instruction = data.systemInstruction;
    if (data.tools) body.tools = data.tools;
    if (data.toolConfig) body.tool_config = data.toolConfig;

    const genConfig = data.generationConfig || {};
    if (!genConfig.temperature) genConfig.temperature = 0.2;
    const requestedMax = Number(genConfig.maxOutputTokens) || 2048;
    genConfig.maxOutputTokens = Math.min(requestedMax, MAX_OUTPUT_TOKENS);
    body.generation_config = genConfig;

    // Retry plan: primary ×2 (with backoff), then fallback ×2. 503/429/500
    // from Gemini are almost always transient demand spikes.
    const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));
    const models = fallbackModel && fallbackModel !== model ? [model, fallbackModel] : [model];
    let response: Response | null = null;
    let lastStatus = 0;
    let lastBody = "";

    outer:
    for (const m of models) {
      const url = `https://generativelanguage.googleapis.com/${version}/models/${m}:generateContent?key=${apiKey}`;
      for (let attempt = 0; attempt < 2; attempt++) {
        const r = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (r.ok) { response = r; break outer; }
        lastStatus = r.status;
        lastBody = await r.text();
        const retryable = r.status === 503 || r.status === 429 || r.status === 500;
        console.warn(`Gemini ${m} attempt ${attempt + 1} failed (${r.status})${retryable ? ", retrying" : ""}`);
        if (!retryable) break outer;
        await sleep(700 * (attempt + 1));
      }
    }

    if (!response) {
      console.error(`Gemini exhausted all retries. Last error ${lastStatus}: ${lastBody.slice(0, 300)}`);
      if (lastStatus === 503 || lastStatus === 429) {
        throw new HttpsError("unavailable", "AI_BUSY: The AI service is very busy right now. Please try again in a minute.");
      }
      throw new HttpsError("internal", `Gemini API Error ${lastStatus}: ${lastBody.slice(0, 300)}`);
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

      // Global per-day counters for the admin analytics dashboard
      const today = new Date().toISOString().split("T")[0];
      adminDb.collection("app_stats").doc("ai_usage").collection("daily").doc(today).set({
        calls: FieldValue.increment(1),
        tokens: FieldValue.increment(usedTokens),
        date: today,
      }, { merge: true }).catch((err: any) => console.error("Failed to update global AI stats:", err));
    }

    // ── Count this successful call against the free-tier monthly quota ──
    if (monthlyRef && monthlyCounterField) {
      monthlyRef.set({
        [monthlyCounterField]: FieldValue.increment(1),
        updatedAt: new Date().toISOString(),
      }, { merge: true }).catch((err: any) => console.error("Failed to update monthly usage:", err));
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
  const isHardcodedAdmin = callerUser.email === "rohit.no18@gmail.com";
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
  const isHardcodedAdmin = callerUser.email === "rohit.no18@gmail.com";
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

// ── Shared helper: is the caller a full admin? ────────────────────────────
async function callerIsAdmin(auth: { uid: string } | undefined): Promise<boolean> {
  if (!auth?.uid) return false;
  const user = await fAdminAuth.getUser(auth.uid);
  return user.customClaims?.admin === true ||
    
    user.email === "rohit.no18@gmail.com";
}

// ── setUserRole — three-way role management (admin-only) ─────────────────
// Keeps custom claims and the Firestore role field in sync — fixes the gap
// where role changes via updateDoc alone left claims stale.
export const setUserRole = onCall(async (request) => {
  const { targetUid, role } = request.data as { targetUid: string; role: "patient" | "subadmin" | "admin" };
  if (!targetUid) throw new HttpsError("invalid-argument", "targetUid is required");
  if (!["patient", "subadmin", "admin"].includes(role)) {
    throw new HttpsError("invalid-argument", "role must be patient, subadmin, or admin");
  }
  if (!(await callerIsAdmin(request.auth))) {
    throw new HttpsError("permission-denied", "Only admins can manage roles");
  }

  const existingClaims = (await fAdminAuth.getUser(targetUid)).customClaims || {};
  await fAdminAuth.setCustomUserClaims(targetUid, {
    ...existingClaims,
    admin: role === "admin",
    subadmin: role === "subadmin",
  });
  await adminDb.collection("users").doc(targetUid).set({ role }, { merge: true });
  return { success: true, role };
});

// ── getAnalyticsSnapshot — aggregate growth metrics (admin + subadmin) ───
// Sub-admins (business partners) get ONLY computed aggregates — never raw
// user records or health data (DPDP). Full admins also get recent signups.
export const getAnalyticsSnapshot = onCall(async (request) => {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Authentication required");
  const caller = await fAdminAuth.getUser(request.auth.uid);
  const isAdmin = caller.customClaims?.admin === true ||
    
    caller.email === "rohit.no18@gmail.com";
  const isSubAdmin = caller.customClaims?.subadmin === true;
  if (!isAdmin && !isSubAdmin) {
    throw new HttpsError("permission-denied", "Staff access required");
  }

  const [usersSnap, patientsSnap, docsSnap, vitalsSnap, emergencySnap, aiDailySnap] = await Promise.all([
    adminDb.collection("users").get(),
    adminDb.collection("patients").get(),
    adminDb.collection("documents").get(),
    adminDb.collection("vitals").count().get(),
    adminDb.collection("emergency_info").get(),
    adminDb.collection("app_stats").doc("ai_usage").collection("daily")
      .orderBy("date", "desc").limit(14).get().catch(() => null),
  ]);

  const users = usersSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
  const premiumUsers = users.filter(u => u.tier === "premium").length;
  const waitlistCount = users.filter(u => u.premiumInterest === true).length;

  // Signups by week (last 8 weeks)
  const weekKey = (d: Date) => {
    const monday = new Date(d);
    monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return monday.toISOString().split("T")[0];
  };
  const buckets = new Map<string, number>();
  for (let i = 7; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i * 7);
    buckets.set(weekKey(d), 0);
  }
  const eightWeeksAgo = new Date();
  eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);
  for (const u of users) {
    const created = u.createdAt?.toDate?.() ?? (u.createdAt?._seconds ? new Date(u.createdAt._seconds * 1000) : null);
    if (created && created >= eightWeeksAgo) {
      const key = weekKey(created);
      if (buckets.has(key)) buckets.set(key, (buckets.get(key) || 0) + 1);
    }
  }
  const signupsByWeek = [...buckets.entries()].map(([week, signups]) => ({ week, signups }));

  // Activation funnel
  const patients = patientsSnap.docs.map(d => d.data() as any);
  const familyOwners = new Set(patients.filter(p => p.relationship && p.relationship !== "Self").map(p => p.userId));
  const docOwners = new Set(docsSnap.docs.map(d => (d.data() as any).userId));
  const emergencyOwners = new Set(emergencySnap.docs.map(d => (d.data() as any).userId));

  const aiUsage = aiDailySnap
    ? aiDailySnap.docs.map(d => d.data()).sort((a: any, b: any) => (a.date || "").localeCompare(b.date || ""))
    : [];

  const snapshot: Record<string, unknown> = {
    totalUsers: users.length,
    premiumUsers,
    waitlistCount,
    totalFamilyMembers: patients.length,
    usersWithFamily: familyOwners.size,
    totalDocuments: docsSnap.size,
    usersWithDocuments: docOwners.size,
    usersWithEmergency: emergencyOwners.size,
    totalVitals: vitalsSnap.data().count,
    signupsByWeek,
    aiUsage,
  };

  // Raw-ish user info only for full admins — never for sub-admins
  if (isAdmin) {
    snapshot.recentUsers = users
      .map(u => ({
        id: u.id,
        name: u.displayName || u.name || "—",
        email: u.email || u.phoneNumber || "—",
        tier: u.tier || "free",
        premiumInterest: u.premiumInterest === true,
        createdAtMs: u.createdAt?.toDate?.()?.getTime() ?? (u.createdAt?._seconds ? u.createdAt._seconds * 1000 : null),
      }))
      .sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0))
      .slice(0, 8);
  }

  return snapshot;
});

// ── deleteMyAccount — full DPDP-compliant erasure of a user's footprint ───
// Deletes all Firestore records, Storage files, lookup entries and finally
// the Auth user itself. Callable only by the account owner.
// Shared by deleteMyAccount (self-service) and adminDeleteUser (admin panel):
// wipes EVERYTHING — Firestore records, subcollections, lookup entries,
// Storage files, and finally the Auth account. Stale lookups after partial
// deletions previously bricked re-registration, so lookups are always cleaned.
async function eraseUserFootprint(uid: string): Promise<void> {
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
  await fAdminAuth.deleteUser(uid).catch((e) => {
    // Auth user may already be gone (e.g. deleted via console) — data cleanup still counts
    if (e.code !== "auth/user-not-found") throw e;
  });
}

export const deleteMyAccount = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }
  await eraseUserFootprint(request.auth.uid);
  return { success: true };
});

// ── adminDeleteUser — admin panel deletion that REALLY deletes ────────────
// Previously the panel only removed the Firestore profile doc, leaving the
// Auth login, medical data and lookup entries orphaned.
export const adminDeleteUser = onCall(async (request) => {
  const { targetUid } = request.data as { targetUid: string };
  if (!targetUid) throw new HttpsError("invalid-argument", "targetUid is required");
  if (!(await callerIsAdmin(request.auth))) {
    throw new HttpsError("permission-denied", "Only admins can delete users");
  }
  if (targetUid === request.auth!.uid) {
    throw new HttpsError("failed-precondition", "Use account settings to delete your own account");
  }
  const target = await fAdminAuth.getUser(targetUid).catch(() => null);
  if (target?.email === "rohit.no18@gmail.com") {
    throw new HttpsError("failed-precondition", "The primary admin account cannot be deleted");
  }
  await eraseUserFootprint(targetUid);
  return { success: true };
});

// ── setUserSuspended — suspend/restore synced to Firebase Auth ────────────
// Disables the Auth account (login blocked platform-wide) and revokes active
// sessions, not just a Firestore flag the UI checks.
export const setUserSuspended = onCall(async (request) => {
  const { targetUid, suspended } = request.data as { targetUid: string; suspended: boolean };
  if (!targetUid) throw new HttpsError("invalid-argument", "targetUid is required");
  if (!(await callerIsAdmin(request.auth))) {
    throw new HttpsError("permission-denied", "Only admins can suspend users");
  }
  const target = await fAdminAuth.getUser(targetUid).catch(() => null);
  if (target?.email === "rohit.no18@gmail.com") {
    throw new HttpsError("failed-precondition", "The primary admin account cannot be suspended");
  }
  await fAdminAuth.updateUser(targetUid, { disabled: !!suspended }).catch((e) => {
    if (e.code !== "auth/user-not-found") throw e;
  });
  if (suspended) {
    await fAdminAuth.revokeRefreshTokens(targetUid).catch(() => undefined);
  }
  await adminDb.collection("users").doc(targetUid).set({ suspended: !!suspended }, { merge: true });
  return { success: true, suspended: !!suspended };
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
