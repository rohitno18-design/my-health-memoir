import { Outlet } from "react-router-dom";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";

export function AppLayout() {
    return (
        /*
          overflow-x-hidden clips stray elements but does NOT live on <html> so
          mouse-wheel vertical scrolling is never blocked on desktop.
        */
        <div className="min-h-dvh bg-slate-50 text-slate-900 overflow-x-hidden">
            <Header />
            {/*
              max-w-lg mx-auto  →  single, consistent width for EVERY page.
              Mobile: fills the screen. Desktop: narrows to 512 px, centered.
              No individual page should override this with its own max-w-*.
            */}
            <main
                className="w-full max-w-lg mx-auto"
                style={{ paddingBottom: "calc(7rem + env(safe-area-inset-bottom, 0px))" }}
            >
                <Outlet />
            </main>
            <BottomNav />
        </div>
    );
}
