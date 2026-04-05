import { Outlet } from "react-router-dom";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";

export function AppLayout() {
    return (
        <div className="min-h-screen bg-[#0b1326]">
            <Header />
            <main className="pb-20 w-full animate-in fade-in">
                <Outlet />
            </main>
            <BottomNav />
        </div>
    );
}
