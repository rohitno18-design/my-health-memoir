import { Outlet, useLocation } from "react-router-dom";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";

export function AppLayout() {
    const location = useLocation();
    const hideHeaderRoutes = ["/dashboard", "/vitals", "/emergency"];
    const hideHeader = hideHeaderRoutes.includes(location.pathname);

    return (
        <div className="min-h-screen bg-background text-slate-900">
            {!hideHeader && <Header />}
            <main className={`${hideHeader ? 'pb-20' : 'pt-14 pb-20'} w-full max-w-lg mx-auto animate-in fade-in`}>
                <Outlet />
            </main>
            <BottomNav />
        </div>
    );
}
