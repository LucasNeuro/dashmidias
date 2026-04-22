import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createColumnHelper } from '@tanstack/react-table';
import { useAuth } from '../context/AuthContext';
import { useUiFeedback } from '../context/UiFeedbackContext';
import { EntityDataTable } from '../components/EntityDataTable';
import { RegistrationTemplateSideover } from '../components/governance/RegistrationTemplateSideover';
import { ShareTemplateSideover } from '../components/governance/ShareTemplateSideover';
import { getSupabase, isSupabaseConfigured } from '../lib/supabaseClient';
import {
  createEmptyTemplate,
  inviteUrlForTemplate,
  normalizeTemplate,
  PARTNER_KIND_OPTIONS,
} from '../lib/registrationFormTemplates';
import {
  deleteRegistrationTemplate,
  listHubRegistrationTemplates,
  upsertRegistrationTemplate,
} from '../lib/registrationFormTemplatesApi';

const colHelper = createColumnHelper();

const qk = (userId) => ['registration_form_templates', userId];

/** Erro vindo do PostgREST / Supabase — mensagem legível, sem jargão de implementação. */
function friendlyDataError(err) {
  const m = String(err?.message || err || '');
  const low = m.toLowerCase();
  if (low.includes('recursion') && low.includes('hub')) {
    return 'Não foi possível concluir a operação: falha de permissões na base (admin HUB). Peça a um administrador a rever as regras de acesso na consola e tentar de novo.';
  }
  if (low.includes('relationship') && low.includes('schema')) {
    return 'A base de dados ainda não tem a mesma versão do sistema. Peça a um administrador a aplicar as actualizações de estrutura e a tentar de novo.';
  }
  return m.length > 200 ? `${m.slice(0, 200)}…` : m;
}

export function AdminTemplatesPage() {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const supabase = useMemo(() => getSupabase(), []);
  const queryClient = useQueryClient();
  const { toast, alert, confirm } = useUiFeedback();
  const [sideOpen, setSideOpen] = useState(false);
  const [shareRow, setShareRow] = useState(null);
  const [isNew, setIsNew] = useState(true);
  const [draft, setDraft] = useState(() => createEmptyTemplate());
  const [saving, setSaving] = useState(false);

  const listEnabled = Boolean(supabase && userId) && isSupabaseConfigured();

  const { data: templates = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: qk(userId),
    queryFn: () => listHubRegistrationTemplates(supabase),
    enabled: listEnabled,
  });

  const openNew = useCallback(() => {
    setIsNew(true);
    setDraft(createEmptyTemplate());
    setSideOpen(true);
  }, []);

  const openEdit = useCallback((row) => {
    setIsNew(false);
    setDraft(normalizeTemplate(JSON.parse(JSON.stringify(row))));
    setSideOpen(true);
  }, []);

  const persistDraft = useCallback(async () => {
    if (!supabase || !userId) {
      await alert('Sessão inválida. Inicie sessão e tente de novo.', { title: 'Templates' });
      return;
    }
    const now = new Date().toISOString();
    const next = normalizeTemplate({
      ...draft,
      updatedAt: now,
      createdAt: draft.createdAt || now,
    });
    setSaving(true);
    try {
      await upsertRegistrationTemplate(supabase, next, userId, isNew);
      await queryClient.invalidateQueries({ queryKey: qk(userId) });
      toast(isNew ? 'Template criado.' : 'Template atualizado.', { variant: 'success' });
      setSideOpen(false);
    } catch (e) {
      await alert(friendlyDataError(e) || 'Não foi possível guardar.', { title: 'Erro' });
    } finally {
      setSaving(false);
    }
  }, [alert, draft, isNew, queryClient, supabase, toast, userId]);

  const remove = useCallback(
    async (id) => {
      if (!supabase) return;
      const ok = await confirm(
        'Excluir este template? O link de convite deixará de funcionar em seguida.',
        { title: 'Excluir template', danger: true }
      );
      if (!ok) return;
      setSaving(true);
      try {
        await deleteRegistrationTemplate(supabase, id);
        await queryClient.invalidateQueries({ queryKey: qk(userId) });
        toast('Template excluído.', { variant: 'success' });
      } catch (e) {
        await alert(friendlyDataError(e) || 'Falha ao excluir.', { title: 'Erro' });
      } finally {
        setSaving(false);
      }
    },
    [confirm, queryClient, supabase, toast, userId]
  );

  const copyInviteLink = useCallback(
    async (row) => {
      if (row?.inviteLinkEnabled === false) {
        await alert('Ative o convite por link na edição do template antes de copiar o endereço.', {
          title: 'Convite pausado',
        });
        return;
      }
      const url = inviteUrlForTemplate(row.id);
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(url);
          toast('Link copiado para a área de transferência.', { variant: 'success' });
        } catch {
          await alert(`Não foi possível copiar automaticamente. Copie manualmente:\n\n${url}`, {
            title: 'Copiar link',
          });
        }
      } else {
        await alert(`Copie o endereço:\n\n${url}`, { title: 'Link do convite' });
      }
    },
    [alert, toast]
  );

  const columns = useMemo(
    () => [
      colHelper.accessor('name', {
        header: 'Template',
        cell: (info) => {
          const row = info.row.original;
          const off = row.inviteLinkEnabled === false;
          return (
            <div className="min-w-0">
              <p className="truncate font-semibold text-primary">{info.getValue() || '—'}</p>
              {off ? (
                <span className="mt-0.5 inline-block rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700">
                  Convite pausado
                </span>
              ) : null}
            </div>
          );
        },
      }),
      colHelper.accessor('partnerKind', {
        header: 'Perfil',
        cell: (info) => {
          const v = info.getValue();
          const label = PARTNER_KIND_OPTIONS.find((o) => o.value === v)?.label;
          return <span className="text-sm text-on-surface-variant">{label ?? '—'}</span>;
        },
      }),
      colHelper.accessor('fields', {
        header: 'Extras',
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
            <button
              type="button"
              onClick={() => openEdit(info.row.original)}
              disabled={saving}
              className="rounded-sm border border-surface-container-high px-2 py-1 text-[10px] font-black uppercase tracking-wider text-primary hover:bg-slate-50 disabled:opacity-50"
            >
              Editar
            </button>
            <button
              type="button"
              title={info.row.original.inviteLinkEnabled === false ? 'Ative o convite no editor' : 'Enviar convite por e-mail'}
              onClick={() => setShareRow(info.row.original)}
              className={`rounded-sm border px-2 py-1 text-[10px] font-black uppercase tracking-wider hover:bg-slate-50 ${
                info.row.original.inviteLinkEnabled === false
                  ? 'border-slate-200 text-slate-400'
                  : 'border-surface-container-high text-on-surface-variant'
              }`}
            >
              Compartilhar
            </button>
            <button
              type="button"
              title={info.row.original.inviteLinkEnabled === false ? 'Ative o convite no editor para copiar' : 'Copiar link'}
              onClick={() => copyInviteLink(info.row.original)}
              className={`rounded-sm border px-2 py-1 text-[10px] font-black uppercase tracking-wider hover:bg-slate-50 ${
                info.row.original.inviteLinkEnabled === false
                  ? 'border-slate-200 text-slate-400'
                  : 'border-surface-container-high text-on-surface-variant'
              }`}
            >
              Link
            </button>
            <button
              type="button"
              onClick={() => void remove(info.row.original.id)}
              disabled={saving}
              className="rounded-sm border border-red-200 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-red-800 hover:bg-red-50 disabled:opacity-50"
            >
              Excluir
            </button>
          </div>
        ),
      }),
    ],
    [copyInviteLink, openEdit, remove, saving]
  );

  if (!isSupabaseConfigured() || !supabase) {
    return (
      <div className="min-w-0 w-full max-w-2xl rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        A ligação ao servidor de dados não está ativa, por isso não é possível ver nem criar modelos de cadastro. Peça a um administrador
        para rever a configuração do ambiente (desenvolvimento e produção).
      </div>
    );
  }

  return (
    <div className="min-w-0 w-full max-w-none">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 max-w-2xl">
          <h1 className="text-sm font-black uppercase tracking-[0.18em] text-primary">Templates de cadastro</h1>
          <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
            Defina quais informações o parceiro preenche no cadastro (por tipo de parceiro) e partilhe o link de convite. Os modelos
            guardados aqui são os que aparecem no formulário público de criação de organizações.
          </p>
        </div>
        <button
          type="button"
          onClick={openNew}
          disabled={!listEnabled || isLoading}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-white shadow-sm hover:bg-[#0f2840] disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[20px]">add</span>
          Novo template
        </button>
      </div>

      {isError && (
        <p className="mb-3 text-sm text-red-800">
          {friendlyDataError(error)}
          <button
            type="button"
            onClick={() => void refetch()}
            className="ml-2 font-semibold text-primary underline underline-offset-2"
          >
            Tentar de novo
          </button>
        </p>
      )}

      <div className="w-full overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
        <div className="p-4 sm:p-5 lg:p-6">
          {isLoading && listEnabled ? (
            <p className="text-sm text-on-surface-variant">A carregar templates…</p>
          ) : (
            <EntityDataTable
              data={templates}
              columns={columns}
              getRowId={(row) => row.id}
              searchPlaceholder="Buscar templates…"
              emptyLabel="Nenhum template. Crie o primeiro para definir campos de cadastro por empresa."
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
      />
      <ShareTemplateSideover open={Boolean(shareRow)} onClose={() => setShareRow(null)} row={shareRow} />
    </div>
  );
}
