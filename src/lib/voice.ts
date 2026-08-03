// ── Voice layer ──────────────────────────────────────────────────────────
// Typing is the real barrier for the people this app serves — a 62-year-old
// parent will speak but won't type. This gives the app ears and a voice in
// every language the app supports.
//
// Speech-to-text uses the browser's on-device recognition (free, no API key,
// good Indian-language support on Chrome/Safari). Text-to-speech goes through
// a provider interface so a hosted voice (e.g. Fish Audio) can be dropped in
// later without touching any calling code — see FishAudioTTS below.

export type VoiceLangCode = "en" | "hi" | "bn" | "te" | "mr" | "ta" | "ur" | "gu" | "kn" | "ml" | "or" | "pa";

/** BCP-47 tags the speech engines expect, per app language */
const BCP47: Record<VoiceLangCode, string> = {
    en: "en-IN", hi: "hi-IN", bn: "bn-IN", te: "te-IN", mr: "mr-IN",
    ta: "ta-IN", ur: "ur-IN", gu: "gu-IN", kn: "kn-IN", ml: "ml-IN",
    or: "or-IN", pa: "pa-IN",
};

export function toBCP47(appLang: string): string {
    const base = (appLang || "en").split("-")[0] as VoiceLangCode;
    return BCP47[base] || "en-IN";
}

// ── Speech recognition (ears) ────────────────────────────────────────────

type SpeechRecognitionCtor = new () => any;
function getRecognitionCtor(): SpeechRecognitionCtor | null {
    const w = window as any;
    return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function isVoiceInputSupported(): boolean {
    return !!getRecognitionCtor();
}

export interface ListenHandle { stop: () => void; }

/**
 * Listen once and return what was said. onPartial streams interim text so the
 * UI can show words appearing live (which is what makes it feel responsive).
 */
export function listenOnce(
    appLang: string,
    handlers: {
        onPartial?: (text: string) => void;
        onFinal: (text: string) => void;
        onError?: (err: string) => void;
        onEnd?: () => void;
    }
): ListenHandle | null {
    const Ctor = getRecognitionCtor();
    if (!Ctor) { handlers.onError?.("unsupported"); return null; }

    const rec = new Ctor();
    rec.lang = toBCP47(appLang);
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;

    let finalText = "";
    rec.onresult = (e: any) => {
        let interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
            const chunk = e.results[i][0]?.transcript || "";
            if (e.results[i].isFinal) finalText += chunk;
            else interim += chunk;
        }
        if (interim) handlers.onPartial?.(interim);
    };
    rec.onerror = (e: any) => handlers.onError?.(e?.error || "error");
    rec.onend = () => {
        if (finalText.trim()) handlers.onFinal(finalText.trim());
        handlers.onEnd?.();
    };

    try { rec.start(); } catch { handlers.onError?.("start-failed"); return null; }
    return { stop: () => { try { rec.stop(); } catch { /* ignore */ } } };
}

// ── Text to speech (voice) ───────────────────────────────────────────────

export interface TTSProvider {
    speak(text: string, appLang: string): Promise<void>;
    stop(): void;
    isAvailable(): boolean;
}

/** Built-in browser voice — free, offline, no key, ships today */
class BrowserTTS implements TTSProvider {
    isAvailable() { return typeof window !== "undefined" && "speechSynthesis" in window; }
    stop() { try { window.speechSynthesis.cancel(); } catch { /* ignore */ } }
    speak(text: string, appLang: string): Promise<void> {
        return new Promise((resolve) => {
            if (!this.isAvailable()) return resolve();
            this.stop();
            const target = toBCP47(appLang);
            const utter = new SpeechSynthesisUtterance(text);
            utter.lang = target;
            utter.rate = 0.95; // a touch slower — most listeners are elders
            const voices = window.speechSynthesis.getVoices();
            const match = voices.find(v => v.lang === target)
                || voices.find(v => v.lang?.startsWith(target.split("-")[0]));
            if (match) utter.voice = match;
            utter.onend = () => resolve();
            utter.onerror = () => resolve();
            window.speechSynthesis.speak(utter);
        });
    }
}

/**
 * Hosted neural voice (Fish Audio). Inactive until an API key is configured —
 * it needs a server-side proxy so the key is never exposed to the browser,
 * exactly like the Gemini proxy. Left wired so switching is a config change,
 * not a rewrite.
 */
class FishAudioTTS implements TTSProvider {
    private audio: HTMLAudioElement | null = null;
    isAvailable() { return !!import.meta.env.VITE_FISH_AUDIO_ENABLED; }
    stop() { if (this.audio) { this.audio.pause(); this.audio = null; } }
    async speak(text: string, appLang: string): Promise<void> {
        // Route through a Cloud Function proxy (keeps the key server-side)
        const { getFunctions, httpsCallable } = await import("firebase/functions");
        const fn = httpsCallable(getFunctions(), "synthesizeSpeech");
        const res: any = await fn({ text, lang: appLang });
        const b64 = res?.data?.audioBase64;
        if (!b64) throw new Error("No audio returned");
        this.stop();
        this.audio = new Audio(`data:audio/mp3;base64,${b64}`);
        await this.audio.play();
    }
}

const browserTTS = new BrowserTTS();
const fishTTS = new FishAudioTTS();

/** Picks the best available voice provider */
export function getTTS(): TTSProvider {
    return fishTTS.isAvailable() ? fishTTS : browserTTS;
}

export function isVoiceOutputSupported(): boolean {
    return getTTS().isAvailable();
}

/** Strip markdown/emoji so the spoken version sounds natural, not literal */
export function textForSpeech(markdown: string): string {
    return markdown
        .replace(/```[\s\S]*?```/g, "")
        .replace(/^#{1,6}\s*/gm, "")
        .replace(/\*\*(.+?)\*\*/g, "$1")
        .replace(/^\s*[-*•]\s+/gm, "")
        .replace(/\[(.+?)\]\(.*?\)/g, "$1")
        .replace(/[🔴🟡🟢✅⚠️📋💊🩺📊🔍🧪❌🏥💡]/gu, "")
        .replace(/\n{2,}/g, ". ")
        .replace(/\n/g, ". ")
        .replace(/\s{2,}/g, " ")
        .trim();
}

// ── Parsing spoken vitals ────────────────────────────────────────────────

export interface ParsedVital { type: "Sugar" | "Blood Pressure" | "Heart Rate"; value: string; unit: string; }

/**
 * Understand a spoken vitals reading in Hindi/English/mixed, e.g.
 * "आज शुगर 140 आया", "sugar one forty", "BP 120 by 80", "pulse 72".
 * Deliberately simple and local — no AI call, so it is instant and free.
 */
export function parseSpokenVital(said: string): ParsedVital | null {
    const s = said.toLowerCase();
    const nums = (s.match(/\d+(?:\.\d+)?/g) || []).map(Number);
    if (!nums.length) return null;

    const isBP = /\b(bp|b\.p|blood pressure|बीप|रक्तचाप|प्रेशर|pressure)\b/.test(s) || /\d+\s*(?:\/|by|बाय|अपॉन|upon)\s*\d+/.test(s);
    const isSugar = /\b(sugar|glucose|शुगर|शक्कर|चीनी|मधुमेह|blood sugar)\b/.test(s);
    const isPulse = /\b(pulse|heart rate|heartbeat|नाड़ी|धड़कन|पल्स|हार्ट रेट)\b/.test(s);

    if (isBP && nums.length >= 2) {
        return { type: "Blood Pressure", value: `${Math.round(nums[0])}/${Math.round(nums[1])}`, unit: "mmHg" };
    }
    if (isSugar) return { type: "Sugar", value: String(nums[0]), unit: "mg/dL" };
    if (isPulse) return { type: "Heart Rate", value: String(Math.round(nums[0])), unit: "bpm" };

    // No keyword — infer from a plausible range so speaking just a number works
    if (nums.length >= 2 && nums[0] > 80 && nums[0] < 260 && nums[1] > 40 && nums[1] < 160) {
        return { type: "Blood Pressure", value: `${Math.round(nums[0])}/${Math.round(nums[1])}`, unit: "mmHg" };
    }
    if (nums[0] >= 40 && nums[0] <= 120) return { type: "Heart Rate", value: String(Math.round(nums[0])), unit: "bpm" };
    if (nums[0] > 40) return { type: "Sugar", value: String(nums[0]), unit: "mg/dL" };
    return null;
}
