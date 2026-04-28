import { useCallback, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createColumnHelper } from '@tanstack/react-table';
import { useAuth } from '../context/AuthContext';
import { useUiFeedback } from '../context/UiFeedbackContext';
import { EntityDataTable } from '../components/EntityDataTable';
import { HubButton } from '../components/HubButton';
import { RegistrationTemplateSideover } from '../components/governance/RegistrationTemplateSideover';
import { getSupabase, isSupabaseConfigured } from '../lib/supabaseClient';
import {
  createLeadCaptureEmptyTemplate,
  inviteUrlForTemplate,
  normalizeTemplate,
} from '../lib/registrationFormTemplates';
import { fetchActiveLeadSegments } from '../lib/leadSegmentsApi';
import { normalizeSignupOptions } from '../schemas/partnerOrgSignup';
import { hubStandardCatalogQueryKey, leadSegmentsPublicQueryKey, registrationTemplatesListQueryKey } from '../lib/queryKeys';
import { fetchHubStandardCatalogAdmin } from '../lib/hubStandardCatalogApi';
import {
  deleteRegistrationTemplate,
  listHubRegistrationTemplates,
  upsertRegistrationTemplate,
} from '../lib/registrationFormTemplatesApi';

const colHelper = createColumnHelper();

const PURPOSE = 'lead_capture';

function friendlyDataError(err) {
  const m = String(err?.message || err || '');
  const low = m.toLowerCase();
  if (low.includes('does not exist') && low.includes('column')) {
    return 'A base de dados deste ambiente está desatualizada em relação a esta versão do painel. Contacte o suporte técnico.';
  }
  return m.length > 200 ? `${m.slice(0, 200)}…` : m;
}

export function AdminLeadCaptureTemplatesPage() {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const supabase = useMemo(() => getSupabase(), []);
  const queryClient = useQueryClient();
  const { toast, alert, confirm } = useUiFeedback();
  const [sideOpen, setSideOpen] = useState(false);
  const [isNew, setIsNew] = useState(true);
  const [draft, setDraft] = useState(() => createLeadCaptureEmptyTemplate());
  const [saving, setSaving] = useState(false);

  const listEnabled = Boolean(supabase && userId) && isSupabaseConfigured();
  const qk = registrationTemplatesListQueryKey(userId, PURPOSE);

  const { data: templates = [], isLoading, isFetching } = useQuery({
    queryKey: qk,
    queryFn: () => listHubRegistrationTemplates(supabase, { purpose: PURPOSE }),
    enabled: listEnabled,
    retry: 1,
    staleTime: 15_000,
  });

  const { data: segmentList = [] } = useQuery({
    queryKey: leadSegmentsPublicQueryKey(),
    queryFn: () => (supabase ? fetchActiveLeadSegments(supabase) : []),
    enabled: listEnabled,
    staleTime: 60_000,
  });

  const { data: standardCatalog = null } = useQuery({
    queryKey: hubStandardCatalogQueryKey('admin', userId),
    queryFn: () => fetchHubStandardCatalogAdmin(supabase),
    enabled: listEnabled,
    retry: 1,
    staleTime: 15_000,
  });

  const openNew = useCallback(() => {
    setIsNew(true);
    setDraft(createLeadCaptureEmptyTemplate());
    setSideOpen(true);
  }, []);

  const openEdit = useCallback((row) => {
    setIsNew(false);
    setDraft(normalizeTemplate(JSON.parse(JSON.stringify(row))));
    setSideOpen(true);
  }, []);

  const persistDraft = useCallback(async () => {
    if (!supabase || !userId) {
      await alert('Sessão inválida. Inicie sessão e tente de novo.', { title: 'Cadastro geral leads' });
      return;
    }
    const now = new Date().toISOString();
    const next = normalizeTemplate({
      ...draft,
      templatePurpose: 'lead_capture',
      updatedAt: now,
      createdAt: draft.createdAt || now,
    });
    setSaving(true);
    try {
      await upsertRegistrationTemplate(supabase, next, userId, isNew);
      await queryClient.invalidateQueries({ queryKey: ['registration_form_templates', userId] });
      toast(isNew ? 'Formulário de captura criado.' : 'Alterações guardadas.', { variant: 'success', duration: 4500 });
      setSideOpen(false);
    } catch (e) {
      await alert(friendlyDataError(e) || 'Não foi possível salvar.', { title: 'Erro' });
    } finally {
      setSaving(false);
    }
  }, [alert, draft, isNew, queryClient, qk, supabase, toast, userId]);

  const remove = useCallback(
    async (id) => {
      if (!supabase) return;
      const ok = await confirm('Excluir este formulário de captura? O link deixa de funcionar.', {
        title: 'Excluir',
        danger: true,
      });
      if (!ok) return;
      setSaving(true);
      try {
        await deleteRegistrationTemplate(supabase, id);
        await queryClient.invalidateQueries({ queryKey: ['registration_form_templates', userId] });
        toast('Removido.', { variant: 'success', duration: 4500 });
      } catch (e) {
        await alert(friendlyDataError(e) || 'Falha ao excluir.', { title: 'Erro' });
      } finally {
        setSaving(false);
      }
    },
    [confirm, queryClient, qk, supabase, toast]
  );

  const copyInviteLink = useCallback(
    async (row) => {
      if (row?.inviteLinkEnabled === false) {
        await alert('Ative o convite na edição antes de copiar o link.', { title: 'Convite pausado' });
        return;
      }
      const url = inviteUrlForTemplate(row);
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(url);
          toast('Link copiado.', { variant: 'success' });
        } catch {
          await alert(`Copie manualmente:\n\n${url}`, { title: 'Copiar link' });
        }
      } else {
        await alert(`Copie:\n\n${url}`, { title: 'Link' });
      }
    },
    [alert, toast]
  );

  const columns = useMemo(
    () => [
      colHelper.accessor('name', {
        header: 'Título',
        cell: (info) => {
          const row = info.row.original;
          const off = row.inviteLinkEnabled === false;
          return (
            <div className="min-w-0 max-w-[14rem]">
              <p className="truncate font-semibold text-primary" title={info.getValue() || undefined}>
                {info.getValue() || '—'}
              </p>
              {off ? (
                <span className="mt-0.5 inline-block rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700">
                  Pausado
                </span>
              ) : null}
            </div>
          );
        },
      }),
      colHelper.accessor('description', {
        header: 'Descrição',
        cell: (info) => {
          const v = (info.getValue() || '').trim();
          return (
            <span
              className="line-clamp-2 max-w-[18rem] text-xs leading-snug text-on-surface-variant"
              title={v || undefined}
            >
              {v || '—'}
            </span>
          );
        },
      }),
      colHelper.display({
        id: 'segmento',
        header: 'Segmento CRM',
        cell: (info) => {
          const slug = normalizeSignupOptions(info.row.original.signupSettings).leadSegmentSlug;
          const label = segmentList.find((s) => s.slug === slug)?.label;
          return <span className="text-sm text-on-surface-variant">{label || slug || '—'}</span>;
        },
      }),
      colHelper.accessor('fields', {
        header: 'Perguntas',
        cell: (info) => <span className="text-sm text-on-surface-variant">{info.getValue()?.length ?? 0}</span>,
      }),
      colHelper.accessor('updatedAt', {
        header: 'Atualizado',
        cell: (info) => {
          const v = info.getValue();
          return (
            <span className="whitespace-nowrap font-mono text-xs text-on-surface-variant">
              {v ? new Date(v).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
            </span>
          );
        },
      }),
      colHelper.display({
        id: 'actions',
        header: '',
        cell: (info) => (
          <div className="flex flex-wrap justify-end gap-1">
            <HubButton
              variant="tableSecondary"
              icon="edit"
              iconClassName="text-[16px]"
              onClick={() => openEdit(info.row.original)}
              disabled={saving}
            >
              Editar
            </HubButton>
            <HubButton
              variant="tableSecondary"
              icon="content_copy"
              iconClassName="text-[16px]"
              title={info.row.original.inviteLinkEnabled === false ? 'Ative o convite para copiar' : 'Copiar link público'}
              onClick={() => copyInviteLink(info.row.original)}
              disabled={info.row.original.inviteLinkEnabled === false}
              className={info.row.original.inviteLinkEnabled === false ? 'opacity-50' : ''}
            >
              Link
            </HubButton>
            <HubButton
              variant="danger"
              icon="delete"
              iconClassName="text-[16px]"
              onClick={() => void remove(info.row.original.id)}
              disabled={saving}
            >
              Excluir
            </HubButton>
          </div>
        ),
      }),
    ],
    [copyInviteLink, openEdit, remove, saving, segmentList]
  );

  if (!isSupabaseConfigured() || !supabase) {
    return (
      <div className="min-w-0 w-full max-w-xl rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        Ligação ao servidor indisponível. Peça apoio técnico.
      </div>
    );
  }

  return (
    <div className="min-w-0 w-full max-w-none">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-sm font-black uppercase tracking-[0.18em] text-primary">Cadastro geral leads</h1>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-600">
            Monte formulários públicos com as perguntas que precisar. Cada inscrição entra na lista de contactos do CRM com o segmento que
            definir aqui. O cadastro completo de empresa ou parceiro (com análise da equipa) continua em{' '}
            <strong>Cadastro homologação</strong>.
          </p>
        </div>
        <HubButton variant="primary" icon="add" onClick={openNew} disabled={!listEnabled || isLoading}>
          Novo formulário
        </HubButton>
      </div>

      <div className="w-full overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
        <div className="p-4 sm:p-5 lg:p-6">
          {listEnabled && !isLoading && isFetching ? (
            <p className="mb-3 flex items-center gap-2 text-xs font-medium text-emerald-800" role="status">
              <span className="material-symbols-outlined text-[18px] animate-pulse" aria-hidden>
                sync
              </span>
              Atualizando…
            </p>
          ) : null}
          {isLoading && listEnabled ? (
            <p className="text-sm text-on-surface-variant">Carregando…</p>
          ) : (
            <EntityDataTable
              data={templates}
              columns={columns}
              getRowId={(row) => row.id}
              searchPlaceholder="Buscar…"
              emptyLabel="Nenhum formulário de captura"
            />
          )}
        </div>
      </div>

      <RegistrationTemplateSideover
        open={sideOpen}
        onClose={() => setSideOpen(false)}
        draft={draft}
        onChangeDraft={setDraft}
        onSave={persistDraft}
        isNew={isNew}
        isSaving={saving}
        standardCatalog={standardCatalog}
        mode="lead_capture"
      />
    </div>
  );
}
