import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";

import { AppLayout } from "@/components/AppLayout";
import { GlobalErrorBoundary } from "@/components/GlobalErrorBoundary";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { Loader2 } from "lucide-react";

// Critical fast path (Main UI Thread optimization)
import { DashboardPage } from "@/pages/DashboardPage";
import { PulsePage } from "@/pages/PulsePage";
import { EmergencyPage } from "@/pages/EmergencyPage";

// Auth pages — lazy loaded to isolate phone-input CSS from root bundle
const LoginPage = lazy(() => import("@/pages/LoginPage").then(m => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import("@/pages/RegisterPage").then(m => ({ default: m.RegisterPage })));

// Lazy Loaded (Split Chunks)
const AccountPage = lazy(() => import("@/pages/AccountPage").then(m => ({ default: m.AccountPage })));
const PatientsPage = lazy(() => import("@/pages/PatientsPage").then(m => ({ default: m.PatientsPage })));
const DocumentsPage = lazy(() => import("@/pages/DocumentsPage").then(m => ({ default: m.DocumentsPage })));
const ChatListPage = lazy(() => import("@/pages/ChatListPage").then(m => ({ default: m.ChatListPage })));
const AIChatPage = lazy(() => import("@/pages/AIChatPage").then(m => ({ default: m.AIChatPage })));
const AdminPage = lazy(() => import("@/pages/AdminPage").then(m => ({ default: m.AdminPage })));
const AdminUsersPage = lazy(() => import("@/pages/admin/AdminUsersPage").then(m => ({ default: m.AdminUsersPage })));
const AdminContentPage = lazy(() => import("@/pages/admin/AdminContentPage").then(m => ({ default: m.AdminContentPage })));
const AdminSettingsPage = lazy(() => import("@/pages/admin/AdminSettingsPage").then(m => ({ default: m.AdminSettingsPage })));
const GlobalTimelinePage = lazy(() => import("@/pages/GlobalTimelinePage").then(m => ({ default: m.GlobalTimelinePage })));
const VitalsPage = lazy(() => import("@/pages/VitalsPage").then(m => ({ default: m.VitalsPage })));
const NotificationsPage = lazy(() => import("@/pages/NotificationsPage").then(m => ({ default: m.NotificationsPage })));
const PrivacyPage = lazy(() => import("@/pages/PrivacyPage").then(m => ({ default: m.PrivacyPage })));
const TermsPage = lazy(() => import("@/pages/TermsPage").then(m => ({ default: m.TermsPage })));
import { LandingPage } from "@/pages/LandingPage";

const SuspenseFallback = () => (
  <div className="flex min-h-screen w-full items-center justify-center bg-slate-50">
    <Loader2 className="animate-spin text-primary" size={32} />
  </div>
);

const queryClient = new QueryClient();

function App() {
  console.log("IM-SMRTI: App component rendering...");
  return (
    <GlobalErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <OfflineIndicator />
            <Suspense fallback={<SuspenseFallback />}>
              <Routes>
            {/* Public routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            
            {/* PUBLIC EMERGENCY PULSE (No Auth, No Layout) */}
            <Route path="/pulse/:userId" element={<PulsePage />} />
            
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/terms" element={<TermsPage />} />

            {/* Protected routes */}
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/profile" element={<AccountPage />} />
              <Route path="/patients" element={<PatientsPage />} />
              <Route path="/timeline" element={<GlobalTimelinePage />} />
              <Route path="/documents" element={<DocumentsPage />} />
              <Route path="/vitals" element={<VitalsPage />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/ai-chat" element={<ChatListPage />} />
              <Route path="/ai-chat/new" element={<AIChatPage />} />
              <Route path="/ai-chat/:chatId" element={<AIChatPage />} />
              <Route path="/emergency" element={<EmergencyPage />} />
              <Route path="/admin">
                <Route
                  index
                  element={
                    <ProtectedRoute requireAdmin>
                      <AdminPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="users"
                  element={
                    <ProtectedRoute requireAdmin>
                      <AdminUsersPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="content"
                  element={
                    <ProtectedRoute requireAdmin>
                      <AdminContentPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="settings"
                  element={
                    <ProtectedRoute requireAdmin>
                      <AdminSettingsPage />
                    </ProtectedRoute>
                  }
                />
              </Route>
            </Route>

            {/* Default redirect */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    </GlobalErrorBoundary>
  );
}

export default App;
