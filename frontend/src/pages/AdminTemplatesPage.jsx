import { useCallback, useEffect, useMemo, useState } from 'react';
import { createColumnHelper } from '@tanstack/react-table';
import { useAuth } from '../context/AuthContext';
import { useUiFeedback } from '../context/UiFeedbackContext';
import { EntityDataTable } from '../components/EntityDataTable';
import { RegistrationTemplateSideover } from '../components/governance/RegistrationTemplateSideover';
import { ShareTemplateSideover } from '../components/governance/ShareTemplateSideover';
import {
  createEmptyTemplate,
  inviteUrlForTemplate,
  loadTemplates,
  normalizeTemplate,
  PARTNER_KIND_OPTIONS,
  saveTemplates,
} from '../lib/registrationFormTemplates';

const colHelper = createColumnHelper();

export function AdminTemplatesPage() {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const { toast, alert, confirm } = useUiFeedback();
  const [templates, setTemplates] = useState(() => loadTemplates(userId));
  const [sideOpen, setSideOpen] = useState(false);
  const [shareRow, setShareRow] = useState(null);
  const [isNew, setIsNew] = useState(true);
  const [draft, setDraft] = useState(() => createEmptyTemplate());

  useEffect(() => {
    setTemplates(loadTemplates(userId));
  }, [userId]);

  useEffect(() => {
    saveTemplates(templates, userId);
  }, [templates, userId]);

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

  const persistDraft = useCallback(() => {
    const now = new Date().toISOString();
    const next = normalizeTemplate({
      ...draft,
      updatedAt: now,
      createdAt: draft.createdAt || now,
    });
    if (isNew) {
      setTemplates((prev) => [next, ...prev]);
    } else {
      setTemplates((prev) => prev.map((t) => (t.id === next.id ? next : t)));
    }
    setSideOpen(false);
  }, [draft, isNew]);

  const remove = useCallback(
    async (id) => {
      const ok = await confirm(
        'Excluir este template? O link de convite deixará de funcionar quando o cadastro público estiver ligado.',
        { title: 'Excluir template', danger: true }
      );
      if (!ok) return;
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    },
    [confirm]
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
              className="rounded-sm border border-surface-container-high px-2 py-1 text-[10px] font-black uppercase tracking-wider text-primary hover:bg-slate-50"
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
              className="rounded-sm border border-red-200 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-red-800 hover:bg-red-50"
            >
              Excluir
            </button>
          </div>
        ),
      }),
    ],
    [copyInviteLink, openEdit, remove]
  );

  return (
    <div className="min-w-0 w-full max-w-none">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 max-w-2xl">
          <h1 className="text-sm font-black uppercase tracking-[0.18em] text-primary">Templates de cadastro</h1>
          <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
            Estes modelos de <strong>formulário de cadastro</strong> ficam no <strong>armazenamento local do navegador</strong>,
            não nas tabelas <code className="rounded-none bg-slate-100 px-1 text-xs">papel_template</code> (isso é catálogo de
            <strong> papéis</strong> e permissões) nem noutra tabela ainda — a persistência partilhada no Supabase continua
            por implementar. Em <strong>produção</strong> o domínio é outro, por isso a lista aí costuma começar vazia.
          </p>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-white shadow-sm hover:bg-[#0f2840]"
        >
          <span className="material-symbols-outlined text-[20px]">add</span>
          Novo template
        </button>
      </div>

      <div className="w-full overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
        <div className="p-4 sm:p-5 lg:p-6">
          <EntityDataTable
            data={templates}
            columns={columns}
            getRowId={(row) => row.id}
            searchPlaceholder="Buscar templates…"
            emptyLabel="Nenhum template. Crie o primeiro para definir campos de cadastro por empresa."
          />
        </div>
      </div>

      <RegistrationTemplateSideover
        open={sideOpen}
        onClose={() => setSideOpen(false)}
        draft={draft}
        onChangeDraft={setDraft}
        onSave={persistDraft}
        isNew={isNew}
      />
      <ShareTemplateSideover open={Boolean(shareRow)} onClose={() => setShareRow(null)} row={shareRow} />
    </div>
  );
}
