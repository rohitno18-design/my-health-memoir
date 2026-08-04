/// <reference types="vite-plugin-pwa/client" />
// ── Keep the installed app on the latest build, automatically ────────────
// Symptom this fixes: a deploy goes out, but the phone keeps showing the old
// screens for days. The service worker installs the new build, yet the page
// already open keeps running the old JavaScript until a real reload — which
// on a phone (especially an installed PWA) almost never happens.
//
// So we: check for a new build on launch, whenever the app is brought back to
// the foreground, and hourly; then reload once the new worker takes over.
import { registerSW } from "virtual:pwa-register";

const CHECK_INTERVAL_MS = 60 * 60 * 1000;

export function initAutoUpdate() {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    // When a new service worker takes control, the page is running stale code —
    // reload once (guarded so we can never loop).
    let reloading = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (reloading) return;
        reloading = true;
        console.info("[update] new version active — reloading");
        window.location.reload();
    });

    const updateSW = registerSW({
        immediate: true,
        // autoUpdate strategy: apply the waiting worker straight away
        onNeedRefresh() {
            console.info("[update] new version found — applying");
            updateSW(true);
        },
        onRegisteredSW(_swUrl, registration) {
            if (!registration) return;
            const check = () => { registration.update().catch(() => undefined); };
            check();
            setInterval(check, CHECK_INTERVAL_MS);
            // Coming back to the app is the most likely moment to pick up a deploy
            document.addEventListener("visibilitychange", () => {
                if (document.visibilityState === "visible") check();
            });
            window.addEventListener("online", check);
        },
        onRegisterError(err) {
            console.warn("[update] service worker registration failed:", err);
        },
    });
}
