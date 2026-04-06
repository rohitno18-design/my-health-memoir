import { Outlet } from "react-router-dom";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";

export function AppLayout() {
    return (
        <div className="min-h-dvh bg-slate-50 text-slate-900">
            <Header />
            <main className="pt-0 pb-28 w-full max-w-lg mx-auto animate-in fade-in duration-200">
                <Outlet />
            </main>
            <BottomNav />
        </div>
    );
}
