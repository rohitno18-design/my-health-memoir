import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Mic, Loader2, Volume2, Square } from "lucide-react";
import {
    listenOnce, isVoiceInputSupported, isVoiceOutputSupported,
    getTTS, textForSpeech, type ListenHandle,
} from "@/lib/voice";

// ── Mic button: hold-free tap to speak, streams what it hears ──
export function VoiceInputButton({ onResult, label, className = "" }: {
    onResult: (text: string) => void;
    label?: string;
    className?: string;
}) {
    const { i18n, t } = useTranslation();
    const [listening, setListening] = useState(false);
    const [partial, setPartial] = useState("");
    const handleRef = useRef<ListenHandle | null>(null);

    useEffect(() => () => handleRef.current?.stop(), []);

    if (!isVoiceInputSupported()) return null;

    const toggle = () => {
        if (listening) { handleRef.current?.stop(); setListening(false); return; }
        setPartial("");
        setListening(true);
        handleRef.current = listenOnce(i18n.language, {
            onPartial: setPartial,
            onFinal: (text) => { onResult(text); setPartial(""); },
            onError: () => { setListening(false); setPartial(""); },
            onEnd: () => { setListening(false); setPartial(""); },
        });
    };

    return (
        <div className={`flex flex-col items-center gap-1.5 ${className}`}>
            <button
                type="button"
                onClick={toggle}
                aria-label={label || t("voice.speak", "Speak")}
                className={`relative w-14 h-14 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-all ${
                    listening ? "bg-rose-500 text-white shadow-rose-500/30" : "bg-blue-600 text-white shadow-blue-600/25"
                }`}
            >
                {listening && (
                    <span className="absolute inset-0 rounded-full bg-rose-400 animate-ping opacity-60" />
                )}
                <Mic size={22} className="relative z-10" />
            </button>
            <span className="text-[11px] font-bold text-slate-500 text-center min-h-[15px] px-2">
                {listening ? (partial || t("voice.listening", "Listening…")) : (label || t("voice.tapToSpeak", "Tap to speak"))}
            </span>
        </div>
    );
}

// ── Read-aloud button for any block of text ──
export function VoiceReadButton({ text, className = "" }: { text: string; className?: string }) {
    const { i18n, t } = useTranslation();
    const [speaking, setSpeaking] = useState(false);

    useEffect(() => () => getTTS().stop(), []);

    if (!isVoiceOutputSupported() || !text) return null;

    const toggle = async () => {
        const tts = getTTS();
        if (speaking) { tts.stop(); setSpeaking(false); return; }
        setSpeaking(true);
        try {
            await tts.speak(textForSpeech(text), i18n.language);
        } catch (e) {
            console.warn("TTS failed:", e);
        } finally {
            setSpeaking(false);
        }
    };

    return (
        <button
            type="button"
            onClick={toggle}
            className={`px-3 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-black flex items-center gap-1.5 active:scale-95 transition-transform ${className}`}
        >
            {speaking ? <Square size={13} className="fill-slate-700" /> : <Volume2 size={14} />}
            {speaking ? t("voice.stop", "Stop") : t("voice.listen", "Listen")}
        </button>
    );
}

/** Small inline spinner used while a voice action resolves */
export function VoiceBusy() {
    return <Loader2 size={14} className="animate-spin text-slate-400" />;
}
