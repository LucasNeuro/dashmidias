import { useCallback, useEffect, useMemo, useState } from 'react';
import { createColumnHelper } from '@tanstack/react-table';
import { EntityDataTable } from '../components/EntityDataTable';
import { RegistrationTemplateSideover } from '../components/governance/RegistrationTemplateSideover';
import {
  createEmptyTemplate,
  inviteUrlForTemplate,
  loadTemplates,
  newId,
  normalizeTemplate,
  PARTNER_KIND_OPTIONS,
  saveTemplates,
} from '../lib/registrationFormTemplates';

const colHelper = createColumnHelper();

export function AdminTemplatesPage() {
  const [templates, setTemplates] = useState(() => loadTemplates());
  const [sideOpen, setSideOpen] = useState(false);
  const [isNew, setIsNew] = useState(true);
  const [draft, setDraft] = useState(() => createEmptyTemplate());

  useEffect(() => {
    saveTemplates(templates);
  }, [templates]);

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

  const remove = useCallback((id) => {
    if (!window.confirm('Excluir este template? O link de convite deixará de funcionar quando o cadastro público estiver ligado.')) return;
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const duplicate = useCallback((row) => {
    const now = new Date().toISOString();
    const copy = normalizeTemplate({
      ...JSON.parse(JSON.stringify(row)),
      id: newId(),
      name: `${row.name} (cópia)`,
      createdAt: now,
      updatedAt: now,
    });
    setTemplates((prev) => [copy, ...prev]);
  }, []);

  const copyInviteLink = useCallback((id) => {
    const url = inviteUrlForTemplate(id);
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(
        () => window.alert('Link copiado para a área de transferência.'),
        () => window.prompt('Copie o link:', url)
      );
    } else {
      window.prompt('Copie o link:', url);
    }
  }, []);

  const columns = useMemo(
    () => [
      colHelper.accessor('name', {
        header: 'Template',
        cell: (info) => (
          <div className="min-w-0">
            <p className="truncate font-semibold text-primary">{info.getValue() || '—'}</p>
          </div>
        ),
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
              onClick={() => duplicate(info.row.original)}
              className="rounded-sm border border-surface-container-high px-2 py-1 text-[10px] font-black uppercase tracking-wider text-on-surface-variant hover:bg-slate-50"
            >
              Duplicar
            </button>
            <button
              type="button"
              onClick={() => copyInviteLink(info.row.original.id)}
              className="rounded-sm border border-surface-container-high px-2 py-1 text-[10px] font-black uppercase tracking-wider text-on-surface-variant hover:bg-slate-50"
            >
              Link
            </button>
            <button
              type="button"
              onClick={() => remove(info.row.original.id)}
              className="rounded-sm border border-red-200 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-red-800 hover:bg-red-50"
            >
              Excluir
            </button>
          </div>
        ),
      }),
    ],
    [copyInviteLink, duplicate, openEdit, remove]
  );

  return (
    <div className="min-w-0 w-full max-w-none">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-sm font-black uppercase tracking-[0.18em] text-primary">Templates de cadastro</h1>
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
    </div>
  );
}
