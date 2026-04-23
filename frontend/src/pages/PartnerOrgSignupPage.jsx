import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AuthSplitLayout } from '../components/AuthSplitLayout';
import { PartnerOrgSignupForm } from '../components/forms/PartnerOrgSignupForm';
import { useUiFeedback } from '../context/UiFeedbackContext';
import { fetchHubStandardCatalog } from '../lib/hubStandardCatalogApi';
import { hubStandardCatalogQueryKey, registrationTemplateDetailQueryKey } from '../lib/queryKeys';
import { getSupabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { mergePartnerOrgExtraFields } from '../lib/orgStandardFields';
import { getTemplateById as getTemplateByIdFromLocal } from '../lib/registrationFormTemplates';
import { getRegistrationTemplateById } from '../lib/registrationFormTemplatesApi';
import { submitHubPartnerOrgSignup } from '../lib/submitHubPartnerOrgSignup';

export function PartnerOrgSignupPage() {
  const { toast } = useUiFeedback();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const tplId = searchParams.get('tpl');

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
          toast('O formulário foi actualizado. Confira os campos antes de enviar.', {
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

  const inviteBlocked = Boolean(template && template.inviteLinkEnabled === false);
  const showForm = !tplId || (loadStatus === 'ready' && template && !inviteBlocked);
  const showPaused = loadStatus === 'ready' && Boolean(template) && inviteBlocked;

  return (
    <AuthSplitLayout>
      <div className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col gap-3 sm:gap-4">
        <div className="shrink-0 rounded-none border border-outline-variant bg-white p-4 shadow-md sm:p-5">
          <h1 className="text-xl font-black tracking-tight text-primary sm:text-2xl">Homologação</h1>
          {!template && !tplId ? (
            <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
              Utilize o link de convite completo enviado pela equipe para preencher este formulário.
            </p>
          ) : null}
        </div>

        {tplId && loadStatus === 'loading' ? (
          <p className="shrink-0 text-center text-xs text-on-surface-variant sm:text-sm">A carregar formulário de cadastro…</p>
        ) : null}
        {tplId && loadStatus === 'ready' && templateQuery.isFetching && template ? (
          <p className="shrink-0 text-center text-[11px] font-medium text-sky-800 sm:text-xs" role="status">
            A sincronizar a última versão do convite…
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
                const meta = {
                  templateId: template?.id ?? null,
                  partnerKind: template?.partnerKind ?? null,
                  cnpjSnapshot: consultaMeta.cnpjSnapshot ?? null,
                  consultaFonte: consultaMeta.consultaFonte ?? null,
                };
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
                toast('Pedido de cadastro enviado. A equipe Obra10+ irá analisar e entrar em contacto.', {
                  variant: 'success',
                  duration: 6500,
                });
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
