import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { UiFeedbackProvider } from './context/UiFeedbackContext';
import { queryClient } from './lib/queryClient';
import { createAppQueryPersister, shouldPersistQuery } from './lib/queryPersistConfig';
import { getParticipantHomePath } from './lib/appPortal';
import { CampaignsDashboardPage } from './modules/campaigns-dashboard';
import { CrmHomePage } from './modules/crm-core';
import { AdminGovernanceLayout } from './pages/AdminGovernanceLayout';
import { EntradaPage } from './pages/EntradaPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { HubPendingApprovalPage } from './pages/HubPendingApprovalPage';
import { CrmPlaceholderPage } from './pages/CrmPlaceholderPage';
import { LoginPage } from './pages/LoginPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { OrgInviteAcceptPage } from './pages/OrgInviteAcceptPage';
import { PartnerOrgSignupPage } from './pages/PartnerOrgSignupPage';
import { AdminAuditPage } from './pages/AdminAuditPage';
import { AdminHubPlaceholderPage } from './pages/AdminHubPlaceholderPage';
import { AdminStandardCatalogPage } from './pages/AdminStandardCatalogPage';
import { AdminTemplatesPage } from './pages/AdminTemplatesPage';
import { AdminUsersPage } from './pages/AdminUsersPage';
import { AdminOrganizationsPage } from './pages/AdminOrganizationsPage';
import { isSupabaseConfigured } from './lib/supabaseClient';

function Protected({ children }) {
  const location = useLocation();
  const { session, loading, identityReady, hubSolicitacaoPendente, isAdmin } = useAuth();
  if (loading || !identityReady) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-primary text-white text-[10px] font-black uppercase tracking-widest">
        Verificando sessão…
      </div>
    );
  }
  if (!session) return <Navigate to="/login" replace />;
  if (hubSolicitacaoPendente && !isAdmin && location.pathname !== '/acesso/pendente-hub') {
    return <Navigate to="/acesso/pendente-hub" replace />;
  }
  return children;
}

function AdminOnly({ children }) {
  const { session, loading, identityReady, isAdmin, hubSolicitacaoPendente, portal } = useAuth();
  if (loading || !identityReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-container-low text-primary text-[10px] font-black uppercase tracking-widest">
        Verificando permissões…
      </div>
    );
  }
  if (!session) return <Navigate to="/login" replace />;
  if (!isAdmin) {
    if (hubSolicitacaoPendente) return <Navigate to="/acesso/pendente-hub" replace />;
    return <Navigate to={getParticipantHomePath(portal)} replace />;
  }
  return children;
}

/** Redireciona `/` e rotas desconhecidas para a home do ambiente (Hub → painel de campanhas). */
function ParticipantHomeRedirect() {
  const { portal } = useAuth();
  return <Navigate to={getParticipantHomePath(portal)} replace />;
}

/** `/imoveis` mantém URL antiga; o primeiro ecrã é o painel de insights (Hub e Imóveis). */
function ImoveisLegacyRedirect() {
  const { portal } = useAuth();
  return <Navigate to={getParticipantHomePath(portal)} replace />;
}

function AppRoutes() {
  const sb = isSupabaseConfigured();

  return (
    <Routes>
      {/* Rotas públicas: convites, tpl=, recuperação — sempre registadas (links diretos isolados do painel). */}
      <Route path="/entrada" element={<EntradaPage />} />
      <Route path="/cadastro/organizacao" element={<PartnerOrgSignupPage />} />
      <Route path="/convite/organizacao" element={<OrgInviteAcceptPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/login/recuperar-senha" element={<ForgotPasswordPage />} />
      <Route path="/login/redefinir" element={<ResetPasswordPage />} />
      <Route path="/login/:portal" element={<LoginPage />} />
      <Route path="/acesso/governanca-hub" element={<Navigate to="/login" replace />} />
      <Route path="/acesso/governance-hub" element={<Navigate to="/login" replace />} />

      {sb ? (
        <>
          <Route
            path="/acesso/pendente-hub"
            element={
              <Protected>
                <HubPendingApprovalPage />
              </Protected>
            }
          />
          <Route
            path="/adm"
            element={
              <AdminOnly>
                <AdminGovernanceLayout />
              </AdminOnly>
            }
          >
            <Route index element={<Navigate to="auditoria" replace />} />
            <Route path="auditoria" element={<AdminAuditPage />} />
            <Route path="configuracoes" element={<AdminHubPlaceholderPage title="Configurações" />} />
            <Route path="templates" element={<AdminTemplatesPage />} />
            <Route path="catalogo-padrao" element={<AdminStandardCatalogPage />} />
            <Route path="usuarios" element={<AdminUsersPage />} />
            <Route path="organizacoes" element={<AdminOrganizationsPage />} />
          </Route>
          <Route path="/app" element={<Navigate to="/" replace />} />
          <Route
            path="/painel/campanhas"
            element={
              <Protected>
                <CampaignsDashboardPage />
              </Protected>
            }
          />
          <Route
            path="/crm"
            element={
              <Protected>
                <CrmHomePage />
              </Protected>
            }
          />
          <Route
            path="/crm/:segment"
            element={
              <Protected>
                <CrmPlaceholderPage />
              </Protected>
            }
          />
          <Route
            path="/imoveis"
            element={
              <Protected>
                <ImoveisLegacyRedirect />
              </Protected>
            }
          />
          <Route
            path="/"
            element={
              <Protected>
                <ParticipantHomeRedirect />
              </Protected>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </>
      ) : (
        <>
          <Route path="/painel/campanhas" element={<CampaignsDashboardPage />} />
          <Route path="/" element={<CampaignsDashboardPage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </>
      )}
    </Routes>
  );
}

const queryPersister = createAppQueryPersister();

export default function App() {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: queryPersister,
        maxAge: 1000 * 60 * 60 * 24,
        dehydrateOptions: {
          shouldDehydrateQuery: shouldPersistQuery,
        },
      }}
    >
      <HashRouter>
        <AuthProvider>
          <UiFeedbackProvider>
            <AppRoutes />
          </UiFeedbackProvider>
        </AuthProvider>
      </HashRouter>
    </PersistQueryClientProvider>
  );
}
