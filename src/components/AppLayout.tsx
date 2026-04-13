import { Outlet } from "react-router-dom";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";

export function AppLayout() {
    return (
        // min-h-dvh ensures content fills the full dynamic viewport (excludes iOS toolbar)
        <div className="min-h-dvh bg-slate-50 text-slate-900">
            <Header />
            {/*
              pb-32 gives clearance above the floating BottomNav.
              An additional pb-safe adds the device's bottom safe-area (iPhone home bar).
            */}
            <main className="pt-0 pb-36 w-full max-w-lg mx-auto animate-in fade-in duration-200"
                  style={{ paddingBottom: "calc(7rem + env(safe-area-inset-bottom, 0px))" }}>
                <Outlet />
            </main>
            <BottomNav />
        </div>
    );
}
