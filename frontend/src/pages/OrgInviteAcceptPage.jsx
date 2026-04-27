import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { AuthSplitLayout } from '../components/AuthSplitLayout';
import { useAuth } from '../context/AuthContext';
import { rpcClaimOrgInvite, rpcPreviewOrgInvite } from '../lib/hubPartnerOrgGovernance';
import { isSupabaseConfigured } from '../lib/supabaseClient';

export function OrgInviteAcceptPage() {
  const [searchParams] = useSearchParams();
  const token = useMemo(() => String(searchParams.get('token') || '').trim(), [searchParams]);
  const { session, supabase } = useAuth();
  const [claimErr, setClaimErr] = useState(null);
  const [claimOk, setClaimOk] = useState(false);
  const [claimBusy, setClaimBusy] = useState(false);

  const previewQuery = useQuery({
    queryKey: ['org-invite-preview', token],
    queryFn: async () => {
      if (!supabase || !token) return null;
      const r = await rpcPreviewOrgInvite(supabase, token);
      return r;
    },
    enabled: Boolean(isSupabaseConfigured() && supabase && token.length >= 16),
    retry: false,
  });

  const preview = previewQuery.data?.raw && typeof previewQuery.data.raw === 'object' ? previewQuery.data.raw : null;
  const previewOk = preview?.ok === true;

  async function handleClaim() {
    if (!supabase || !token) return;
    setClaimBusy(true);
    setClaimErr(null);
    try {
      const r = await rpcClaimOrgInvite(supabase, token);
      const raw = r.raw && typeof r.raw === 'object' ? r.raw : {};
      if (!r.ok) {
        setClaimErr(r.error || 'Falha ao vincular');
        return;
      }
      if (raw.ok === false) {
        setClaimErr([raw.error, raw.detail].filter(Boolean).join(': ') || 'Convite inválido');
        return;
      }
      setClaimOk(true);
    } catch (e) {
      setClaimErr(e?.message || 'Erro');
    } finally {
      setClaimBusy(false);
    }
  }

  if (!isSupabaseConfigured()) {
    return (
      <AuthSplitLayout>
        <p className="text-sm text-amber-900">Supabase não configurado.</p>
      </AuthSplitLayout>
    );
  }

  if (!token) {
    return (
      <AuthSplitLayout>
        <div className="mx-auto max-w-lg space-y-3 rounded border border-slate-200 bg-white p-6 text-sm">
          <h1 className="text-lg font-black text-primary">Convite inválido</h1>
          <p className="text-on-surface-variant">Falta o parâmetro <code className="font-mono">token</code> na URL.</p>
          <Link to="/login" className="font-bold text-primary underline">
            Ir para o login
          </Link>
        </div>
      </AuthSplitLayout>
    );
  }

  return (
    <AuthSplitLayout>
      <div className="mx-auto flex min-h-0 w-full max-w-lg flex-col gap-4">
        <div className="rounded border border-outline-variant bg-white p-5 shadow-md">
          <h1 className="text-xl font-black tracking-tight text-primary">Convite — organização Obra10+</h1>
          {previewQuery.isPending ? (
            <p className="mt-3 text-sm text-on-surface-variant">A validar convite…</p>
          ) : null}
          {previewQuery.isError ? (
            <p className="mt-3 text-sm text-red-600" role="alert">
              Não foi possível validar o convite.
            </p>
          ) : null}
          {preview && preview.ok === false ? (
            <p className="mt-3 text-sm text-red-600" role="alert">
              {[preview.error, preview.detail].filter(Boolean).join(': ') || 'Convite não disponível.'}
            </p>
          ) : null}
          {previewOk ? (
            <div className="mt-4 space-y-2 text-sm">
              <p>
                <span className="text-on-surface-variant">Organização:</span>{' '}
                <strong className="text-primary">{String(preview.organizacao_nome || '—')}</strong>
              </p>
              {preview.codigo_rastreio ? (
                <p className="font-mono text-xs text-slate-600">Código interno: {String(preview.codigo_rastreio)}</p>
              ) : null}
              <p className="text-xs text-on-surface-variant">
                Convite enviado para <strong>{String(preview.email_convite || '')}</strong>. O usuário autenticado deve usar o{' '}
                <strong>mesmo e-mail</strong>.
              </p>
            </div>
          ) : null}
        </div>

        {previewOk ? (
          <div className="rounded border border-slate-200 bg-slate-50 p-5 text-sm">
            {claimOk ? (
              <p className="font-semibold text-emerald-800">Conta associada à organização com sucesso. Pode fechar esta página.</p>
            ) : session ? (
              <>
                <p className="text-on-surface-variant">
                  Sessão: <span className="font-mono text-xs">{session.user?.email}</span>
                </p>
                {claimErr ? (
                  <p className="mt-2 text-sm text-red-600" role="alert">
                    {claimErr}
                  </p>
                ) : null}
                <button
                  type="button"
                  disabled={claimBusy}
                  onClick={() => void handleClaim()}
                  className="mt-4 w-full bg-primary px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white hover:bg-[#0f2840] disabled:opacity-50"
                >
                  Associar esta conta à organização
                </button>
              </>
            ) : (
              <>
                <p className="text-on-surface-variant">
                  Inicie sessão ou registe-se com o e-mail do convite e volte a esta página para concluir a associação.
                </p>
                <Link
                  to="/login"
                  className="mt-4 inline-flex w-full items-center justify-center bg-primary px-4 py-3 text-center text-[10px] font-black uppercase tracking-widest text-white hover:bg-[#0f2840]"
                >
                  Ir para login
                </Link>
              </>
            )}
          </div>
        ) : null}

        <p className="text-center text-xs text-on-surface-variant">
          <Link to="/login" className="text-primary underline">
            Voltar
          </Link>
        </p>
      </div>
    </AuthSplitLayout>
  );
}
