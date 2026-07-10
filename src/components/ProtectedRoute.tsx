import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

interface ProtectedRouteProps {
    children: React.ReactNode;
    requireAdmin?: boolean;
    /** Full admins OR sub-admins (analytics-only partner role) */
    requireStaff?: boolean;
    requirePremium?: boolean;
}

export function ProtectedRoute({ children, requireAdmin = false, requireStaff = false, requirePremium = false }: ProtectedRouteProps) {
    const { user, userProfile, loading, isPremium } = useAuth();
    const location = useLocation();

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-background">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    const isAdminByRole = userProfile?.role === "admin";
    const isAdminByEmail = user.email === "rohit.no18@gmail.com";
    const isFullAdmin = isAdminByRole || isAdminByEmail;
    const isSubAdmin = userProfile?.role === "subadmin";

    if (requireAdmin && !isFullAdmin) {
        return <Navigate to="/dashboard" replace />;
    }

    if (requireStaff && !isFullAdmin && !isSubAdmin) {
        return <Navigate to="/dashboard" replace />;
    }

    if (requirePremium && !isPremium) {
        return <Navigate to="/premium" replace />;
    }

    if (userProfile?.suspended) {
        return <Navigate to="/login" replace />; // You could also bounce to a specific /suspended page
    }

    return <>{children}</>;
}
