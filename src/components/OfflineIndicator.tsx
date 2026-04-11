import { useState, useEffect } from "react";
import { WifiOff } from "lucide-react";

export function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="fixed top-0 left-0 w-full z-[100] bg-orange-500 text-white shadow-md animate-in slide-in-from-top-full duration-300">
      <div className="max-w-md mx-auto px-4 py-2 flex items-center justify-center gap-2 text-[11px] font-black tracking-widest uppercase">
        <WifiOff size={14} />
        Offline Mode Active
      </div>
    </div>
  );
}
