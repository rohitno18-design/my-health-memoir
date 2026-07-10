// Version is stamped at BUILD TIME — never edit by hand.
// - APP_VERSION: semver from package.json (bump it there on each release)
// - BUILD_HASH: git short commit hash — uniquely identifies the exact build
// - BUILD_DATE: when this bundle was built
// Together they let us verify at a glance that the live site is running the
// build we just deployed.
declare const __APP_VERSION__: string;
declare const __BUILD_HASH__: string;
declare const __BUILD_TIME__: string;

const semver = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "0.0.0";
const hash = typeof __BUILD_HASH__ !== "undefined" ? __BUILD_HASH__ : "dev";
const builtIso = typeof __BUILD_TIME__ !== "undefined" ? __BUILD_TIME__ : new Date().toISOString();

// Short, human-friendly build date (e.g. "10 Jul 2026, 18:04")
const BUILD_DATE = (() => {
    try {
        return new Date(builtIso).toLocaleString("en-IN", {
            day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
        });
    } catch {
        return builtIso;
    }
})();

/** e.g. "v1.5.0" — the release number shown to users */
export const APP_VERSION = `v${semver}`;
/** git short hash of this exact build, e.g. "a1b2c3d" */
export const BUILD_HASH = hash;
/** "v1.5.0 · a1b2c3d" — unambiguous build identifier */
export const APP_BUILD = `${APP_VERSION} · ${hash}`;
/** full line for footers: "v1.5.0 · a1b2c3d · 10 Jul 2026, 18:04" */
export const APP_BUILD_FULL = `${APP_VERSION} · ${hash} · ${BUILD_DATE}`;
