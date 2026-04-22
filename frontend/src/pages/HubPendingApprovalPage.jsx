import { useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { AuthSplitLayout } from '../components/AuthSplitLayout';
import { useAuth } from '../context/AuthContext';
import { getParticipantHomePath } from '../lib/appPortal';

export function HubPendingApprovalPage() {
  const { session, loading, identityReady, isAdmin, hubSolicitacaoPendente, loadProfileForUser, signOut, portal } =
    useAuth();

  useEffect(() => {
    if (!session?.user?.id || !identityReady) return;
    loadProfileForUser(session.user.id);
  }, [session?.user?.id, identityReady, loadProfileForUser]);

  if (loading || !identityReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-container-low text-primary text-[10px] font-black uppercase tracking-widest">
        Carregando…
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;
  if (isAdmin) return <Navigate to="/adm/auditoria" replace />;
  if (!hubSolicitacaoPendente) return <Navigate to={getParticipantHomePath(portal)} replace />;

  return (
    <AuthSplitLayout heroTitle="Obra10+">
      <div className="w-full max-w-md mx-auto bg-white border-2 border-primary shadow-xl p-8 space-y-6">
        <div>
          <h2 className="text-2xl font-black text-primary tracking-tight">Aguardando aprovação</h2>
        </div>
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={async () => {
              if (session?.user?.id) await loadProfileForUser(session.user.id);
            }}
            className="w-full py-3 bg-tertiary text-white text-[10px] font-black uppercase tracking-[0.2em] hover:bg-tertiary/90"
          >
            Verificar se fui aprovado
          </button>
          <button
            type="button"
            onClick={() => signOut()}
            className="w-full py-2.5 border-2 border-primary text-[10px] font-black uppercase tracking-[0.2em] text-primary hover:bg-primary hover:text-white"
          >
            Sair
          </button>
          <Link to="/login" className="text-center text-[10px] font-black uppercase tracking-widest text-on-surface-variant hover:text-primary">
            Voltar ao login
          </Link>
        </div>
      </div>
    </AuthSplitLayout>
  );
}
