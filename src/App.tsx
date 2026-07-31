import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { AppLayout } from "./components/AppLayout";
import { ToastProvider } from "./components/Toast";
import { ChatProvider } from "./chat/ChatContext";
import { LoginPage } from "./pages/LoginPage";
import { ItemsPage } from "./pages/ItemsPage";
import { PrsPage } from "./pages/PrsPage";
import { QuotationsPage } from "./pages/QuotationsPage";
import { PosPage } from "./pages/PosPage";
import { GrnsPage } from "./pages/GrnsPage";
import { BillsPage } from "./pages/BillsPage";
import { TransactionsPage } from "./pages/TransactionsPage";
import { ChatPage } from "./pages/ChatPage";
import { PermissionsPage } from "./pages/PermissionsPage";

function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <ChatProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/items" element={<ItemsPage />} />
              <Route path="/prs" element={<PrsPage />} />
              <Route path="/quotations" element={<QuotationsPage />} />
              <Route path="/pos" element={<PosPage />} />
              <Route path="/grns" element={<GrnsPage />} />
              <Route path="/bills" element={<BillsPage />} />
              <Route path="/transactions" element={<TransactionsPage />} />
              <Route path="/chat" element={<ChatPage />} />
              <Route path="/permissions" element={<PermissionsPage />} />
              <Route index element={<Navigate to="/prs" replace />} />
            </Route>
            <Route path="*" element={<Navigate to="/prs" replace />} />
          </Routes>
        </ChatProvider>
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;
