import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { DashboardPage } from './components/DashboardPage';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AdminAuditPage } from './pages/AdminAuditPage';
import { LoginPage } from './pages/LoginPage';
import { isSupabaseConfigured } from './lib/supabaseClient';

function Protected({ children }) {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-primary text-white text-[10px] font-black uppercase tracking-widest">
        Verificando sessão…
      </div>
    );
  }
  if (!session) return <Navigate to="/login" replace />;
  return children;
}

function AdminOnly({ children }) {
  const { session, loading, isAdmin } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-container-low text-primary text-[10px] font-black uppercase tracking-widest">
        Verificando permissões…
      </div>
    );
  }
  if (!session) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return children;
}

function AppRoutes() {
  if (!isSupabaseConfigured()) {
    return <DashboardPage />;
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/adm"
        element={
          <AdminOnly>
            <AdminAuditPage />
          </AdminOnly>
        }
      />
      <Route
        path="/"
        element={
          <Protected>
            <DashboardPage />
          </Protected>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
