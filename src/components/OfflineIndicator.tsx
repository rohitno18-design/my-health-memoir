import { useState, useEffect } from "react";
import { WifiOff, RefreshCw, CheckCircle } from "lucide-react";
import { db } from "@/lib/firebase";
import { enableNetwork, disableNetwork } from "firebase/firestore";

type SyncState = "online" | "offline" | "syncing";

export function OfflineIndicator() {
  const [syncState, setSyncState] = useState<SyncState>(
    navigator.onLine ? "online" : "offline"
  );
  const [visible, setVisible] = useState(!navigator.onLine);

  useEffect(() => {
    let hideTimer: ReturnType<typeof setTimeout>;

    const handleOnline = async () => {
      setSyncState("syncing");
      setVisible(true);
      try {
        await enableNetwork(db);
      } catch { /* ignore */ }
      // Show "synced" briefly then hide
      setSyncState("online");
      hideTimer = setTimeout(() => setVisible(false), 2500);
    };

    const handleOffline = async () => {
      setSyncState("offline");
      setVisible(true);
      clearTimeout(hideTimer);
      try {
        await disableNetwork(db);
      } catch { /* ignore */ }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearTimeout(hideTimer);
    };
  }, []);

  if (!visible) return null;

  const config = {
    offline: {
      bg: "bg-orange-500",
      icon: <WifiOff size={13} />,
      text: "Offline — Cached Data Shown",
    },
    syncing: {
      bg: "bg-amber-500",
      icon: <RefreshCw size={13} className="animate-spin" />,
      text: "Back Online — Syncing…",
    },
    online: {
      bg: "bg-emerald-500",
      icon: <CheckCircle size={13} />,
      text: "All Data Synced",
    },
  }[syncState];

  return (
    <div
      className={`fixed top-0 left-0 w-full z-[200] ${config.bg} text-white shadow-md transition-all duration-300`}
    >
      <div className="max-w-lg mx-auto px-4 py-2 flex items-center justify-center gap-2 text-[11px] font-black tracking-widest uppercase">
        {config.icon}
        {config.text}
      </div>
    </div>
  );
}
