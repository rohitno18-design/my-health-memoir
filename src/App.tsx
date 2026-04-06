import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { VerificationGate } from "@/components/VerificationGate";
import { AppLayout } from "@/components/AppLayout";
import { LoginPage } from "@/pages/LoginPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { AccountPage } from "@/pages/AccountPage";
import { PatientsPage } from "@/pages/PatientsPage";
import { DocumentsPage } from "@/pages/DocumentsPage";
import { ChatListPage } from "@/pages/ChatListPage";
import { AIChatPage } from "@/pages/AIChatPage";
import { AdminPage } from "@/pages/AdminPage";
import { GlobalTimelinePage } from "@/pages/GlobalTimelinePage";
import { EmergencyPage } from "@/pages/EmergencyPage";
import { PulsePage } from "@/pages/PulsePage";
import { VitalsPage } from "@/pages/VitalsPage";
import { NotificationsPage } from "@/pages/NotificationsPage";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            
            {/* PUBLIC EMERGENCY PULSE (No Auth, No Layout) */}
            <Route path="/pulse/:userId" element={<PulsePage />} />

            {/* Protected routes — wrapped in VerificationGate */}
            <Route
              element={
                <ProtectedRoute>
                  <VerificationGate>
                    <AppLayout />
                  </VerificationGate>
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
              <Route
                path="/admin"
                element={
                  <ProtectedRoute requireAdmin>
                    <AdminPage />
                  </ProtectedRoute>
                }
              />
            </Route>

            {/* Default redirect */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
