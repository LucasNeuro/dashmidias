import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createColumnHelper } from '@tanstack/react-table';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { EntityDataTable } from '../components/EntityDataTable';
import { HubButton } from '../components/HubButton';
import { MasterFlowSideover } from '../components/governance/MasterFlowSideover';
import { useAuth } from '../context/AuthContext';
import { useUiFeedback } from '../context/UiFeedbackContext';
import { getSupabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { masterFlowsAdminQueryKey, masterFlowStepsAdminQueryKey, registrationTemplatesListQueryKey } from '../lib/queryKeys';
import { listHubRegistrationTemplates } from '../lib/registrationFormTemplatesApi';
import {
  friendlyRegistrationFlowError,
  listMasterFlowsAdmin,
  listMasterFlowStepsAdmin,
} from '../lib/registrationMasterFlowApi';
import { getPrimaryRegistrationIntakePublicUrl, getRegistrationIntakePublicUrlForFlow } from '../lib/registrationPublicLinks';
import { promiseWithTimeout } from '../lib/promiseWithTimeout';

const colHelper = createColumnHelper();

function flowIdsEqual(a, b) {
  if (a == null || b == null) return false;
  return String(a).toLowerCase() === String(b).toLowerCase();
}

function TableColHeader({ icon, label }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="material-symbols-outlined text-[17px] text-slate-500" aria-hidden>
        {icon}
      </span>
      {label}
    </span>
  );
}

export function AdminRegistrationFlowsPage() {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const { toast, confirm, alert } = useUiFeedback();
  const qc = useQueryClient();
  const sb = getSupabase();
  const [sideOpen, setSideOpen] = useState(false);
  const [selectedFlowId, setSelectedFlowId] = useState(/** @type {string | null} */ (null));
  const [isNewMode, setIsNewMode] = useState(false);
  /** Linha recém-criada até a lista refrescar. */
  const [createdFlowRow, setCreatedFlowRow] = useState(/** @type {Record<string, unknown> | null} */ (null));
  /** Snapshot da linha ao abrir «Gerenciar» — evita painel vazio se o id não casar com a cache da lista. */
  const [managerFlowRow, setManagerFlowRow] = useState(/** @type {Record<string, unknown> | null} */ (null));

  const listEnabled = Boolean(sb && userId) && isSupabaseConfigured();

  const flowsQuery = useQuery({
    queryKey: masterFlowsAdminQueryKey(),
    queryFn: () => listMasterFlowsAdmin(sb),
    enabled: listEnabled,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });

  const templatesQuery = useQuery({
    queryKey: registrationTemplatesListQueryKey(userId),
    queryFn: () => listHubRegistrationTemplates(sb),
    enabled: Boolean(listEnabled && sideOpen),
    staleTime: 60_000,
  });

  const stepsQuery = useQuery({
    queryKey: masterFlowStepsAdminQueryKey(selectedFlowId),
    queryFn: () =>
      promiseWithTimeout(
        listMasterFlowStepsAdmin(sb, /** @type {string} */ (selectedFlowId)),
        25_000,
        'A ligação demorou demais. Verifique a internet e toque em «Tentar novamente».'
      ),
    enabled: Boolean(listEnabled && selectedFlowId && sideOpen && !isNewMode),
    staleTime: 15_000,
    retry: 1,
    /** Sem keepPreviousData: evita estado “fantasma” ao trocar de fluxo e simplifica o loading. */
    refetchOnReconnect: true,
  });

  const stepsPanelActive = Boolean(listEnabled && selectedFlowId && sideOpen && !isNewMode);
  /** `isLoading` fica true em refetches; no painel queremos só o 1.º carregamento (ou após erro). */
  const stepsLoading = Boolean(stepsPanelActive && !stepsQuery.isError && stepsQuery.isPending);

  const selectedFlow = useMemo(() => {
    if (isNewMode || !selectedFlowId) return null;
    const list = flowsQuery.data || [];
    const fromList = list.find((f) => flowIdsEqual(f.id, selectedFlowId)) ?? null;
    if (fromList) return fromList;
    if (managerFlowRow && flowIdsEqual(managerFlowRow.id, selectedFlowId)) return managerFlowRow;
    if (createdFlowRow && flowIdsEqual(createdFlowRow.id, selectedFlowId)) return createdFlowRow;
    return null;
  }, [isNewMode, flowsQuery.data, selectedFlowId, managerFlowRow, createdFlowRow]);

  useEffect(() => {
    if (!createdFlowRow || !selectedFlowId || !flowsQuery.data?.length) return;
    if (flowsQuery.data.some((f) => flowIdsEqual(f.id, selectedFlowId))) setCreatedFlowRow(null);
  }, [flowsQuery.data, selectedFlowId, createdFlowRow]);

  const primaryIntakeUrl = useMemo(() => getPrimaryRegistrationIntakePublicUrl(), []);

  const copyPrimaryIntakeUrl = useCallback(async () => {
    if (!primaryIntakeUrl) return;
    try {
      await navigator.clipboard.writeText(primaryIntakeUrl);
      toast('Link copiado.', { variant: 'success' });
    } catch {
      toast('Não foi possível copiar.', { variant: 'warning' });
    }
  }, [primaryIntakeUrl, toast]);

  const flowShareUrl = useMemo(() => {
    if (isNewMode || !selectedFlow?.slug) return getPrimaryRegistrationIntakePublicUrl();
    return getRegistrationIntakePublicUrlForFlow(String(selectedFlow.slug));
  }, [isNewMode, selectedFlow]);

  const copyFlowShareUrl = useCallback(async () => {
    if (!flowShareUrl) return;
    try {
      await navigator.clipboard.writeText(flowShareUrl);
      toast('Link copiado.', { variant: 'success' });
    } catch {
      toast('Não foi possível copiar.', { variant: 'warning' });
    }
  }, [flowShareUrl, toast]);

  const copyRowPublicLink = useCallback(
    async (row) => {
      const url = getRegistrationIntakePublicUrlForFlow(String(row.slug ?? ''));
      try {
        await navigator.clipboard.writeText(url);
        toast('Link copiado.', { variant: 'success' });
      } catch {
        toast('Não foi possível copiar.', { variant: 'warning' });
      }
    },
    [toast]
  );

  const openNew = useCallback(() => {
    setSelectedFlowId(null);
    setManagerFlowRow(null);
    setIsNewMode(true);
    setSideOpen(true);
  }, []);

  const openFlow = useCallback((row) => {
    setManagerFlowRow(row);
    setSelectedFlowId(row?.id != null ? String(row.id) : null);
    setIsNewMode(false);
    setSideOpen(true);
  }, []);

  const closeSide = useCallback(() => {
    setSideOpen(false);
    setIsNewMode(false);
    setManagerFlowRow(null);
    void qc.invalidateQueries({ queryKey: masterFlowsAdminQueryKey() });
    if (selectedFlowId) {
      void qc.invalidateQueries({ queryKey: masterFlowStepsAdminQueryKey(selectedFlowId) });
    }
  }, [qc, selectedFlowId]);

  const onFlowCreated = useCallback(
    (row) => {
      setIsNewMode(false);
      if (row?.id) {
        setSelectedFlowId(String(row.id));
        setCreatedFlowRow(row);
      }
      void qc.invalidateQueries({ queryKey: masterFlowsAdminQueryKey() });
    },
    [qc]
  );

  const patchFlowMutation = useMutation({
    mutationFn: async ({ id, patch }) => {
      const { error } = await sb.from('hub_registration_master_flow').update(patch).eq('id', id);
      if (error) throw error;
    },
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: masterFlowsAdminQueryKey() });
      const previous = qc.getQueryData(masterFlowsAdminQueryKey());
      qc.setQueryData(masterFlowsAdminQueryKey(), (old) =>
        Array.isArray(old) ? old.map((f) => (f.id === id ? { ...f, ...patch } : f)) : old
      );
      return { previous };
    },
    onError: (err, _vars, context) => {
      if (context?.previous != null) {
        qc.setQueryData(masterFlowsAdminQueryKey(), context.previous);
      }
      toast(err?.message || 'Erro ao atualizar.', { variant: 'warning' });
    },
    onSuccess: () => {
      toast('Fluxo atualizado.', { variant: 'success', duration: 3200 });
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: masterFlowsAdminQueryKey() });
    },
  });

  const patchFlow = patchFlowMutation.mutate;
  const patchPending = patchFlowMutation.isPending;
  const patchTargetId = patchFlowMutation.variables?.id ?? null;

  const deleteFlowMutation = useMutation({
    mutationFn: async (/** @type {string} */ id) => {
      const { error: eSteps } = await sb.from('hub_registration_master_flow_step').delete().eq('master_flow_id', id);
      if (eSteps) throw eSteps;
      const { error: eFlow } = await sb.from('hub_registration_master_flow').delete().eq('id', id);
      if (eFlow) throw eFlow;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: masterFlowsAdminQueryKey() });
      const previous = qc.getQueryData(masterFlowsAdminQueryKey());
      const idStr = String(id);
      qc.setQueryData(masterFlowsAdminQueryKey(), (old) =>
        Array.isArray(old) ? old.filter((f) => String(f.id) !== idStr) : old
      );
      return { previous };
    },
    onError: async (e, _id, context) => {
      if (context?.previous != null) {
        qc.setQueryData(masterFlowsAdminQueryKey(), context.previous);
      }
      await alert(friendlyRegistrationFlowError(e), { title: 'Não foi possível excluir o fluxo' });
    },
    onSuccess: (_void, deletedId) => {
      toast('Fluxo excluído.', { variant: 'success', duration: 3200 });
      if (String(selectedFlowId) === String(deletedId)) {
        setSelectedFlowId(null);
        setManagerFlowRow(null);
        setSideOpen(false);
        setIsNewMode(false);
      }
      void qc.invalidateQueries({ queryKey: masterFlowsAdminQueryKey() });
      void qc.invalidateQueries({ queryKey: ['hub_registration_master_flow_step', 'admin'] });
    },
  });

  const deletePending = deleteFlowMutation.isPending;
  const deleteTargetId = deleteFlowMutation.variables ?? null;

  const requestDeleteFlow = useCallback(
    async (row) => {
      const ok = await confirm(
        `Excluir o fluxo «${String(row.name || '')}» e todas as etapas? Esta ação não pode ser desfeita.`,
        { title: 'Excluir fluxo', danger: true }
      );
      if (!ok) return;
      deleteFlowMutation.mutate(row.id);
    },
    [confirm, deleteFlowMutation]
  );

  const requestDeleteSelectedFlow = useCallback(async () => {
    if (!selectedFlow) return;
    await requestDeleteFlow(selectedFlow);
  }, [selectedFlow, requestDeleteFlow]);

  const columns = useMemo(
    () => [
      colHelper.accessor('name', {
        header: () => <TableColHeader icon="account_tree" label="Fluxo" />,
        cell: (info) => (
          <div className="flex min-w-0 items-start gap-2">
            <span className="material-symbols-outlined mt-0.5 shrink-0 text-[20px] text-slate-400" aria-hidden>
              hub
            </span>
            <div className="min-w-0">
              <p className="truncate font-semibold text-primary">{info.getValue() || '—'}</p>
              <p className="truncate font-mono text-[10px] text-slate-500">{info.row.original.slug}</p>
            </div>
          </div>
        ),
      }),
      colHelper.accessor('is_active', {
        header: () => <TableColHeader icon="toggle_on" label="Estado" />,
        cell: (info) =>
          info.getValue() ? (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-800">
              <span className="material-symbols-outlined text-[16px]" aria-hidden>
                check_circle
              </span>
              Ativo
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-slate-500">
              <span className="material-symbols-outlined text-[16px]" aria-hidden>
                pause_circle
              </span>
              Inativo
            </span>
          ),
      }),
      colHelper.accessor('invite_link_enabled', {
        header: () => <TableColHeader icon="link" label="Convite" />,
        cell: (info) =>
          info.getValue() ? (
            <span className="inline-flex items-center gap-1 text-xs text-slate-800">
              <span className="material-symbols-outlined text-[16px]" aria-hidden>
                lock_open
              </span>
              Aberto
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-slate-500">
              <span className="material-symbols-outlined text-[16px]" aria-hidden>
                lock
              </span>
              Fechado
            </span>
          ),
      }),
      colHelper.display({
        id: 'steps',
        header: () => <TableColHeader icon="layers" label="Etapas" />,
        cell: (info) => {
          const n = Number(info.row.original.step_count) || 0;
          return (
            <span className="inline-flex items-center gap-1 font-mono text-sm text-on-surface-variant tabular-nums">
              <span className="material-symbols-outlined text-[18px] text-slate-400" aria-hidden>
                checklist
              </span>
              {n}
            </span>
          );
        },
      }),
      colHelper.display({
        id: 'actions',
        header: () => <TableColHeader icon="more_horiz" label="Ações" />,
        cell: (info) => {
          const row = info.row.original;
          const rowBusy =
            (patchPending && patchTargetId === row.id) || (deletePending && deleteTargetId === row.id);
          return (
            <div className="flex flex-wrap justify-end gap-1">
              <HubButton
                variant="tableSecondary"
                icon="tune"
                iconClassName="text-[16px]"
                onClick={() => openFlow(row)}
                disabled={rowBusy}
              >
                Gerenciar
              </HubButton>
              <HubButton
                variant="tableSecondary"
                icon="content_copy"
                iconClassName="text-[16px]"
                title="Copiar link deste fluxo"
                onClick={() => void copyRowPublicLink(row)}
                disabled={rowBusy}
              >
                Copiar link
              </HubButton>
              <HubButton
                variant={row.is_active ? 'tableSecondary' : 'tablePrimary'}
                icon={row.is_active ? 'pause' : 'play_arrow'}
                iconClassName="text-[16px]"
                disabled={rowBusy}
                onClick={() =>
                  patchFlow({
                    id: row.id,
                    patch: { is_active: !row.is_active, updated_at: new Date().toISOString() },
                  })
                }
              >
                {rowBusy ? '…' : row.is_active ? 'Pausar' : 'Ativar'}
              </HubButton>
              <HubButton
                variant="danger"
                icon="delete"
                iconClassName="text-[16px]"
                disabled={rowBusy}
                onClick={() => void requestDeleteFlow(row)}
              >
                Excluir
              </HubButton>
            </div>
          );
        },
      }),
    ],
    [openFlow, patchFlow, patchPending, patchTargetId, deletePending, deleteTargetId, requestDeleteFlow, copyRowPublicLink]
  );

  if (!isSupabaseConfigured() || !sb) {
    return (
      <div className="min-w-0 w-full max-w-xl rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        Ligação ao servidor indisponível.
      </div>
    );
  }

  return (
    <div className="min-w-0 w-full max-w-none">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-sm font-black uppercase tracking-[0.18em] text-primary">Cadastro — fluxos</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {primaryIntakeUrl ? (
            <HubButton variant="secondary" icon="content_copy" onClick={() => void copyPrimaryIntakeUrl()}>
              Copiar link público
            </HubButton>
          ) : null}
          <HubButton variant="primary" icon="add" onClick={openNew} disabled={!listEnabled || flowsQuery.isPending}>
            Novo fluxo
          </HubButton>
        </div>
      </div>

      <div className="w-full overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
        <div className="p-4 sm:p-5 lg:p-6">
          {flowsQuery.isPending && !flowsQuery.data ? (
            <p className="text-sm text-on-surface-variant">Carregando…</p>
          ) : (
            <EntityDataTable
              data={flowsQuery.data || []}
              columns={columns}
              getRowId={(row) => row.id}
              searchPlaceholder="Pesquisar fluxo…"
              emptyLabel="Nenhum fluxo"
            />
          )}
        </div>
      </div>

      {sideOpen ? (
        <MasterFlowSideover
          open
          onClose={closeSide}
          flow={isNewMode ? null : selectedFlow}
          isNewMode={isNewMode}
          steps={stepsQuery.data ?? []}
          stepsLoading={stepsLoading}
          stepsError={stepsQuery.isError ? stepsQuery.error : null}
          onRetrySteps={() => void stepsQuery.refetch()}
          templates={templatesQuery.data || []}
          flowShareUrl={flowShareUrl}
          onCopyShareUrl={() => void copyFlowShareUrl()}
          onFlowCreated={onFlowCreated}
          onDeleteFlow={isNewMode ? undefined : requestDeleteSelectedFlow}
          deleteFlowBusy={deletePending}
        />
      ) : null}
    </div>
  );
}
