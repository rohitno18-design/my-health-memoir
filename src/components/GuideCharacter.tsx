// "Smriti" — the friendly guide character shown during the app tour.
// Hand-built flat-illustration SVG (no external asset), with blinking eyes
// and a gentle float so she feels alive and personal, not like a bot.

interface GuideCharacterProps {
    size?: number;
    /** subtle talking bob while her speech bubble is showing */
    talking?: boolean;
}

export function GuideCharacter({ size = 72, talking = false }: GuideCharacterProps) {
    return (
        <div style={{ width: size, height: size }} className="relative shrink-0">
            <style>{`
                @keyframes smriti-float { 0%,100%{ transform: translateY(0) } 50%{ transform: translateY(-3px) } }
                @keyframes smriti-blink { 0%,92%,100%{ transform: scaleY(1) } 96%{ transform: scaleY(0.1) } }
                @keyframes smriti-talk  { 0%,100%{ transform: scaleY(1) } 50%{ transform: scaleY(0.7) } }
                .smriti-wrap { animation: smriti-float 3.5s ease-in-out infinite; transform-origin: center; }
                .smriti-eye  { animation: smriti-blink 4s infinite; transform-origin: center; }
                .smriti-mouth-talk { animation: smriti-talk 0.4s ease-in-out infinite; transform-origin: center; }
                @media (prefers-reduced-motion: reduce) {
                    .smriti-wrap, .smriti-eye, .smriti-mouth-talk { animation: none !important; }
                }
            `}</style>
            <svg viewBox="0 0 100 100" width={size} height={size} className="smriti-wrap drop-shadow-md" role="img" aria-label="Smriti, your guide">
                <defs>
                    <linearGradient id="smriti-bg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stopColor="#eef2ff" />
                        <stop offset="1" stopColor="#e0e7ff" />
                    </linearGradient>
                    <clipPath id="smriti-clip"><circle cx="50" cy="50" r="48" /></clipPath>
                </defs>

                {/* ring + background */}
                <circle cx="50" cy="50" r="49" fill="#fff" />
                <circle cx="50" cy="50" r="47" fill="url(#smriti-bg)" stroke="#c7d2fe" strokeWidth="2" />

                <g clipPath="url(#smriti-clip)">
                    {/* shoulders / kurta */}
                    <path d="M20 100 C20 78 34 70 50 70 C66 70 80 78 80 100 Z" fill="#6366f1" />
                    <path d="M50 70 L44 100 L56 100 Z" fill="#eef2ff" opacity="0.5" />
                    {/* neck */}
                    <rect x="44" y="60" width="12" height="12" rx="5" fill="#e8b28f" />
                    {/* hair back */}
                    <path d="M26 46 C26 26 74 26 74 46 L74 66 C74 60 70 58 68 58 L32 58 C30 58 26 60 26 66 Z" fill="#3b2a26" />
                    {/* face */}
                    <ellipse cx="50" cy="46" rx="20" ry="22" fill="#f0bd97" />
                    {/* hair front / parting */}
                    <path d="M30 44 C30 26 70 26 70 44 C70 36 62 30 50 30 C38 30 30 36 30 44 Z" fill="#3b2a26" />
                    <path d="M30 44 C31 37 34 33 38 31 C34 36 33 41 33 46 Z" fill="#3b2a26" />
                    <path d="M70 44 C69 37 66 33 62 31 C66 36 67 41 67 46 Z" fill="#3b2a26" />
                    {/* bindi */}
                    <circle cx="50" cy="35" r="1.6" fill="#e11d48" />
                    {/* eyebrows */}
                    <path d="M40 40 Q43.5 38 47 40" stroke="#3b2a26" strokeWidth="1.4" fill="none" strokeLinecap="round" />
                    <path d="M53 40 Q56.5 38 60 40" stroke="#3b2a26" strokeWidth="1.4" fill="none" strokeLinecap="round" />
                    {/* eyes (blink) */}
                    <g className="smriti-eye">
                        <ellipse cx="43.5" cy="45" rx="2.4" ry="3" fill="#2d2320" />
                        <ellipse cx="56.5" cy="45" rx="2.4" ry="3" fill="#2d2320" />
                        <circle cx="44.2" cy="44" r="0.8" fill="#fff" />
                        <circle cx="57.2" cy="44" r="0.8" fill="#fff" />
                    </g>
                    {/* cheeks */}
                    <circle cx="39" cy="51" r="3" fill="#f2a48a" opacity="0.45" />
                    <circle cx="61" cy="51" r="3" fill="#f2a48a" opacity="0.45" />
                    {/* nose */}
                    <path d="M50 47 Q51.5 51 49 52.5" stroke="#d99a76" strokeWidth="1.2" fill="none" strokeLinecap="round" />
                    {/* mouth (smiles / talks) */}
                    <path className={talking ? "smriti-mouth-talk" : ""} d="M45 56 Q50 61 55 56" stroke="#a8402f" strokeWidth="1.8" fill="#c65a44" strokeLinecap="round" />
                    {/* headset — the "helpful guide" cue */}
                    <path d="M29 46 A21 21 0 0 1 71 46" stroke="#4f46e5" strokeWidth="2.4" fill="none" />
                    <rect x="26.5" y="44" width="4.5" height="8" rx="2" fill="#4f46e5" />
                    <rect x="69" y="44" width="4.5" height="8" rx="2" fill="#4f46e5" />
                    <path d="M27 52 Q22 58 30 60" stroke="#4f46e5" strokeWidth="2.2" fill="none" strokeLinecap="round" />
                    <circle cx="31" cy="60.5" r="2.2" fill="#4f46e5" />
                    {/* little health cross badge on collar */}
                    <circle cx="62" cy="76" r="5" fill="#fff" />
                    <path d="M62 73 v6 M59 76 h6" stroke="#e11d48" strokeWidth="1.6" strokeLinecap="round" />
                </g>
            </svg>
        </div>
    );
}
