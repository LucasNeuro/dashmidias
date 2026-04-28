import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthSplitLayout } from '../components/AuthSplitLayout';
import { PartnerOrgSignupForm } from '../components/forms/PartnerOrgSignupForm';
import { useUiFeedback } from '../context/UiFeedbackContext';
import { fetchHubStandardCatalog } from '../lib/hubStandardCatalogApi';
import { buildHomologacaoTrackingPageUrl, postMakeHomologacaoWebhook } from '../lib/postMakeHomologacaoWebhook';
import { hubStandardCatalogQueryKey, registrationTemplateDetailQueryKey } from '../lib/queryKeys';
import { getSupabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { mergePartnerOrgExtraFields } from '../lib/orgStandardFields';
import { getTemplateById as getTemplateByIdFromLocal } from '../lib/registrationFormTemplates';
import { getRegistrationTemplateById } from '../lib/registrationFormTemplatesApi';
import { submitHubPartnerOrgSignup } from '../lib/submitHubPartnerOrgSignup';

export function PartnerOrgSignupPage() {
  const { toast } = useUiFeedback();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const tplId = searchParams.get('tpl');

  const intakeStepHint = useMemo(() => {
    try {
      const stepRaw = searchParams.get('step');
      if (stepRaw == null || !searchParams.get('from')?.includes('intake')) return null;
      const raw = sessionStorage.getItem('ob10_partner_intake_v1');
      if (!raw) return null;
      const j = JSON.parse(raw);
      const total = Array.isArray(j.steps) ? j.steps.length : 0;
      const cur = Number(stepRaw) || 0;
      if (total < 1) return null;
      return { label: `Etapa ${cur + 1} de ${total} (cadastro parceiro)` };
    } catch {
      return null;
    }
  }, [searchParams]);
  const [submitBusy, setSubmitBusy] = useState(false);
  /** @type {null | { kind: 'tracking', email: string, codigoRastreio: string, trackingUrl: string } | { kind: 'legacy', email: string }} */
  const [successModal, setSuccessModal] = useState(null);

  const templateQuery = useQuery({
    queryKey: registrationTemplateDetailQueryKey(tplId),
    queryFn: async () => {
      if (!tplId) return null;
      const sb = getSupabase();
      if (!isSupabaseConfigured() || !sb) {
        return getTemplateByIdFromLocal(tplId);
      }
      return getRegistrationTemplateById(sb, tplId);
    },
    enabled: Boolean(tplId),
    staleTime: 20_000,
    retry: 1,
  });

  const catalogQuery = useQuery({
    queryKey: hubStandardCatalogQueryKey('invite', null),
    queryFn: async () => {
      const sb = getSupabase();
      if (!sb) return null;
      return fetchHubStandardCatalog(sb);
    },
    enabled: isSupabaseConfigured(),
    staleTime: 60_000,
    retry: 0,
  });

  const template = templateQuery.data ?? null;
  const standardCatalog = catalogQuery.data ?? null;
  const loadStatus = !tplId ? 'ready' : templateQuery.isPending ? 'loading' : 'ready';
  const templateRowId = template?.id ?? null;

  useEffect(() => {
    if (!templateRowId || !tplId || !isSupabaseConfigured()) return;
    const sb = getSupabase();
    if (!sb) return;

    const channel = sb
      .channel(`invite-template-${templateRowId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'registration_form_template',
          filter: `id=eq.${templateRowId}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: registrationTemplateDetailQueryKey(tplId) });
          toast('O formulário foi atualizado. Confira os campos antes de enviar.', {
            variant: 'info',
            duration: 5200,
          });
        }
      )
      .subscribe();

    return () => {
      void sb.removeChannel(channel);
    };
  }, [tplId, templateRowId, queryClient, toast]);

  /** Modelos só de CRM/leads não usam este fluxo — o link público correto é /cadastro/captura */
  useEffect(() => {
    if (!tplId || templateQuery.isPending) return;
    const t = templateQuery.data ?? null;
    if (!t || t.templatePurpose !== 'lead_capture') return;
    const q = new URLSearchParams(searchParams);
    navigate(`/cadastro/captura?${q.toString()}`, { replace: true });
  }, [tplId, templateQuery.isPending, templateQuery.data, navigate, searchParams]);

  const inviteBlocked = Boolean(template && template.inviteLinkEnabled === false);
  const showForm = !tplId || (loadStatus === 'ready' && template && !inviteBlocked);
  const showPaused = loadStatus === 'ready' && Boolean(template) && inviteBlocked;

  return (
    <AuthSplitLayout>
      <div className="relative mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col gap-3 sm:gap-4">
        {submitBusy ? (
          <div
            className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 rounded-sm bg-white/80 backdrop-blur-[2px]"
            role="status"
            aria-live="polite"
            aria-busy="true"
          >
            <span className="inline-block h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm font-medium text-primary">A registar o pedido…</p>
          </div>
        ) : null}

        {successModal ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="signup-success-title"
          >
            <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-xl sm:p-6">
              <h2 id="signup-success-title" className="text-lg font-black tracking-tight text-primary sm:text-xl">
                Pedido registrado
              </h2>
              {successModal.kind === 'tracking' ? (
                <>
                  <p className="mt-3 text-sm leading-relaxed text-on-surface-variant">
                    O link de acompanhamento foi enviado para o e-mail cadastrado (
                    <span className="font-medium text-primary">{successModal.email}</span>). Verifique a caixa de entrada e o
                    spam.
                  </p>
                  <p className="mt-2 text-xs text-on-surface-variant">
                    Código do pedido:{' '}
                    <span className="font-mono text-[13px] text-primary">{successModal.codigoRastreio}</span>
                  </p>
                </>
              ) : (
                <p className="mt-3 text-sm leading-relaxed text-on-surface-variant">
                  O pedido foi guardado. O acompanhamento online com código ainda não está disponível neste ambiente — a
                  equipe Obra10+ pode contatá-lo pelo e-mail indicado.
                </p>
              )}
              <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  className="rounded-sm border-2 border-outline-variant bg-white px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.12em] text-primary hover:bg-surface-container-low"
                  onClick={() => setSuccessModal(null)}
                >
                  Fechar
                </button>
                {successModal.kind === 'tracking' ? (
                  <button
                    type="button"
                    className="rounded-sm border-2 border-primary bg-primary px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.12em] text-white hover:opacity-95"
                    onClick={() => {
                      const c = successModal.codigoRastreio;
                      setSuccessModal(null);
                      navigate(`/homologacao/organizacao?codigo=${encodeURIComponent(c)}`, { replace: true });
                    }}
                  >
                    Ver acompanhamento
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        <div className="shrink-0 rounded-none border border-outline-variant bg-white p-4 shadow-md sm:p-5">
          <h1 className="text-xl font-black tracking-tight text-primary sm:text-2xl">Homologação</h1>
          {intakeStepHint ? (
            <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.08em] text-sky-900">{intakeStepHint.label}</p>
          ) : null}
          {!template && !tplId ? (
            <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
              Use o link de convite completo enviado pela equipe para preencher este formulário.
            </p>
          ) : null}
        </div>

        {tplId && loadStatus === 'loading' ? (
          <p className="shrink-0 text-center text-xs text-on-surface-variant sm:text-sm">Carregando formulário de cadastro…</p>
        ) : null}
        {tplId && loadStatus === 'ready' && templateQuery.isFetching && template ? (
          <p className="shrink-0 text-center text-[11px] font-medium text-sky-800 sm:text-xs" role="status">
            Sincronizando a última versão do convite…
          </p>
        ) : null}
        {showPaused ? (
          <div className="shrink-0 rounded-none border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
            Este cadastro não está aceitando novos envios no momento. Entre em contato com a equipe Obra10+ se precisar de ajuda.
          </div>
        ) : null}
        {showForm ? (
          <div className="flex w-full min-w-0 flex-col">
            <PartnerOrgSignupForm
              key={template?.id || tplId || 'sem-template'}
              partnerKind={template?.partnerKind ?? null}
              standardCatalog={standardCatalog}
              signupSettings={template?.signupSettings}
              extraFields={mergePartnerOrgExtraFields(
                template?.fields ?? [],
                {
                  standardFieldsDisabled: template?.standardFieldsDisabled,
                  disabledBuiltinGroups: template?.disabledBuiltinGroups,
                },
                standardCatalog
              )}
              onSubmitSuccess={async (value, consultaMeta = {}) => {
                setSubmitBusy(true);
                try {
                  const meta = {
                    templateId: template?.id ?? null,
                    partnerKind: template?.partnerKind ?? null,
                    cnpjSnapshot: consultaMeta.cnpjSnapshot ?? null,
                    consultaFonte: consultaMeta.consultaFonte ?? null,
                  };
                  const email = String(value.email ?? '').trim();
                  const r = await submitHubPartnerOrgSignup({ dados: value, meta });
                  if (r.skipped) {
                    toast(
                      'Cadastro concluído localmente (servidor não configurado). Os dados não foram guardados na base.',
                      { variant: 'warning', duration: 6500 }
                    );
                    return;
                  }
                  if (!r.ok) {
                    toast(r.error || 'Não foi possível registar o pedido.', { variant: 'warning', duration: 7000 });
                    return;
                  }
                  if (r.legacyInsert) {
                    postMakeHomologacaoWebhook({
                      email,
                      nome_empresa: String(value.nome_empresa ?? '').trim() || null,
                      template_id: meta.templateId,
                      partner_kind: meta.partnerKind,
                      legacy_insert: true,
                      signup_id: r.signupId ?? null,
                    });
                    setSuccessModal({ kind: 'legacy', email });
                    return;
                  }
                  const codigo = r.codigoRastreio ? String(r.codigoRastreio).trim() : '';
                  const trackingUrl = codigo ? buildHomologacaoTrackingPageUrl(codigo) : '';
                  postMakeHomologacaoWebhook({
                    email,
                    nome_empresa: String(value.nome_empresa ?? '').trim() || null,
                    codigo_rastreio: codigo || null,
                    tracking_url: trackingUrl || null,
                    template_id: meta.templateId,
                    partner_kind: meta.partnerKind,
                    signup_id: r.signupId ?? null,
                  });
                  if (codigo) {
                    setSuccessModal({
                      kind: 'tracking',
                      email,
                      codigoRastreio: codigo,
                      trackingUrl,
                    });
                  } else {
                    toast('Pedido enviado, mas o código de acompanhamento não foi devolvido.', {
                      variant: 'warning',
                      duration: 8000,
                    });
                  }
                } finally {
                  setSubmitBusy(false);
                }
              }}
            />
          </div>
        ) : null}

        <p className="shrink-0 pt-2 text-center text-sm text-on-surface-variant">
          <Link
            to="/login"
            className="font-medium text-primary underline underline-offset-2 hover:text-[#0f2840]"
          >
            Voltar ao login
          </Link>
        </p>
      </div>
    </AuthSplitLayout>
  );
}
