import { Outlet } from "react-router-dom";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";

export function AppLayout() {
    return (
        <div className="min-h-screen bg-background">
            <Header />
            <main className="pt-14 pb-20 max-w-lg mx-auto px-4">
                <Outlet />
            </main>
            <BottomNav />
        </div>
    );
}
