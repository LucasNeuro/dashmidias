import { lazy, Suspense } from 'react';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { QueryClientProvider } from '@tanstack/react-query';
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { UiFeedbackProvider } from './context/UiFeedbackContext';
import { queryClient } from './lib/queryClient';
import { createAppQueryPersister, shouldPersistQuery } from './lib/queryPersistConfig';
import { getParticipantHomePath } from './lib/appPortal';
import { EntradaPage } from './pages/EntradaPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { HubPendingApprovalPage } from './pages/HubPendingApprovalPage';
import { LoginPage } from './pages/LoginPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { OrgInviteAcceptPage } from './pages/OrgInviteAcceptPage';
import { isSupabaseConfigured } from './lib/supabaseClient';

const CampaignsDashboardPage = lazy(() =>
  import('./modules/campaigns-dashboard').then((m) => ({ default: m.CampaignsDashboardPage }))
);
const CrmHomePage = lazy(() => import('./modules/crm-core').then((m) => ({ default: m.CrmHomePage })));
const CrmPlaceholderPage = lazy(() => import('./pages/CrmPlaceholderPage').then((m) => ({ default: m.CrmPlaceholderPage })));
const RegistrationEntryPage = lazy(() =>
  import('./pages/RegistrationEntryPage').then((m) => ({ default: m.RegistrationEntryPage }))
);
const PublicLeadSignupPage = lazy(() =>
  import('./pages/PublicLeadSignupPage').then((m) => ({ default: m.PublicLeadSignupPage }))
);
const PartnerOrgSignupPage = lazy(() =>
  import('./pages/PartnerOrgSignupPage').then((m) => ({ default: m.PartnerOrgSignupPage }))
);
const OrgHomologacaoTrackPage = lazy(() =>
  import('./pages/OrgHomologacaoTrackPage').then((m) => ({ default: m.OrgHomologacaoTrackPage }))
);
const AdminGovernanceLayout = lazy(() =>
  import('./pages/AdminGovernanceLayout').then((m) => ({ default: m.AdminGovernanceLayout }))
);
const AdminAuditPage = lazy(() => import('./pages/AdminAuditPage').then((m) => ({ default: m.AdminAuditPage })));
const AdminHubPlaceholderPage = lazy(() =>
  import('./pages/AdminHubPlaceholderPage').then((m) => ({ default: m.AdminHubPlaceholderPage }))
);
const AdminTemplatesPage = lazy(() =>
  import('./pages/AdminTemplatesPage').then((m) => ({ default: m.AdminTemplatesPage }))
);
const AdminStandardCatalogPage = lazy(() =>
  import('./pages/AdminStandardCatalogPage').then((m) => ({ default: m.AdminStandardCatalogPage }))
);
const AdminUsersPage = lazy(() => import('./pages/AdminUsersPage').then((m) => ({ default: m.AdminUsersPage })));
const AdminOrganizationsPage = lazy(() =>
  import('./pages/AdminOrganizationsPage').then((m) => ({ default: m.AdminOrganizationsPage }))
);
const AdminRegistrationFlowsPage = lazy(() =>
  import('./pages/AdminRegistrationFlowsPage').then((m) => ({ default: m.AdminRegistrationFlowsPage }))
);

function RouteFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center px-4 text-[10px] font-black uppercase tracking-widest text-slate-500">
      Carregando…
    </div>
  );
}

function withSuspense(node) {
  return <Suspense fallback={<RouteFallback />}>{node}</Suspense>;
}

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
      {/* Rotas públicas: convites, tpl=, recuperação — sempre registradas (links diretos isolados do painel). */}
      <Route path="/entrada" element={<EntradaPage />} />
      <Route path="/cadastro/fluxo/:flowSlug" element={withSuspense(<RegistrationEntryPage />)} />
      <Route path="/cadastro/lead" element={withSuspense(<PublicLeadSignupPage />)} />
      <Route path="/cadastro/organizacao" element={withSuspense(<PartnerOrgSignupPage />)} />
      <Route path="/cadastro/inteligente" element={withSuspense(<RegistrationEntryPage />)} />
      <Route path="/cadastro" element={withSuspense(<RegistrationEntryPage />)} />
      <Route path="/intake" element={withSuspense(<RegistrationEntryPage />)} />
      <Route path="/homologacao/organizacao" element={withSuspense(<OrgHomologacaoTrackPage />)} />
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
                {withSuspense(<AdminGovernanceLayout />)}
              </AdminOnly>
            }
          >
            <Route index element={<Navigate to="auditoria" replace />} />
            <Route path="auditoria" element={withSuspense(<AdminAuditPage />)} />
            <Route path="configuracoes" element={withSuspense(<AdminHubPlaceholderPage title="Configurações" />)} />
            <Route path="templates" element={withSuspense(<AdminTemplatesPage />)} />
            <Route path="catalogo-padrao" element={withSuspense(<AdminStandardCatalogPage />)} />
            <Route path="usuarios" element={withSuspense(<AdminUsersPage />)} />
            <Route path="organizacoes" element={withSuspense(<AdminOrganizationsPage />)} />
            <Route path="cadastro-fluxos" element={withSuspense(<AdminRegistrationFlowsPage />)} />
          </Route>
          <Route path="/app" element={<Navigate to="/" replace />} />
          <Route
            path="/painel/campanhas"
            element={
              <Protected>{withSuspense(<CampaignsDashboardPage />)}</Protected>
            }
          />
          <Route
            path="/crm"
            element={
              <Protected>{withSuspense(<CrmHomePage />)}</Protected>
            }
          />
          <Route
            path="/crm/:segment"
            element={
              <Protected>{withSuspense(<CrmPlaceholderPage />)}</Protected>
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
          <Route path="/painel/campanhas" element={withSuspense(<CampaignsDashboardPage />)} />
          <Route path="/" element={withSuspense(<CampaignsDashboardPage />)} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </>
      )}
    </Routes>
  );
}

const queryPersister = createAppQueryPersister();
const useQueryPersistence = !import.meta.env.DEV;

function AppProviders() {
  return (
    <HashRouter>
      <AuthProvider>
        <UiFeedbackProvider>
          <AppRoutes />
        </UiFeedbackProvider>
      </AuthProvider>
    </HashRouter>
  );
}

export default function App() {
  if (useQueryPersistence) {
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
        <AppProviders />
      </PersistQueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AppProviders />
    </QueryClientProvider>
  );
}
