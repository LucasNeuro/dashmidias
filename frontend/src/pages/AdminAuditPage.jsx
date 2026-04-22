import { useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { createColumnHelper } from '@tanstack/react-table';
import { AuditAccessLogSideover } from '../components/audit/AuditAccessLogSideover';
import { DashboardMetricCard } from '../components/DashboardMetricCard';
import { EntityDataTable } from '../components/EntityDataTable';
import { useAuth } from '../context/AuthContext';
import { getAuditRouteKind } from '../lib/auditRouteKind';
import {
  AUDIT_PAGE_SIZE,
  fetchAdminAuditBundle,
  fetchGovernanceProfiles,
} from '../lib/governanceQueries';
import { logPanelAccess } from '../lib/panelAccessLog';

const PAGE_SIZE = AUDIT_PAGE_SIZE;

export function AdminAuditPage() {
  const { supabase, session } = useAuth();
  const queryClient = useQueryClient();
  const [panel, setPanel] = useState({ open: false, row: null });
  const [range, setRange] = useState('all');
  const [pageIndex, setPageIndex] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPageIndex(0);
  }, [range, debouncedSearch]);

  useEffect(() => {
    const uid = session?.user?.id;
    if (uid) logPanelAccess(uid, '/adm/auditoria');
  }, [session?.user?.id]);

  const auditQuery = useQuery({
    queryKey: ['governance', 'audit', { range, pageIndex, debouncedSearch }],
    queryFn: async () => {
      const profiles = await queryClient.fetchQuery({
        queryKey: ['governance', 'profiles'],
        queryFn: () => fetchGovernanceProfiles(supabase),
        staleTime: 5 * 60 * 1000,
      });
      const bundle = await fetchAdminAuditBundle({
        supabase,
        profiles,
        range,
        pageIndex,
        debouncedSearch,
      });
      return { profiles, ...bundle };
    },
    enabled: Boolean(supabase),
    placeholderData: keepPreviousData,
  });

  const { data, isPending, isFetching, error } = auditQuery;
  const profiles = data?.profiles ?? [];
  const stats = data?.stats ?? null;
  const logs = data?.logs ?? [];
  const totalCount = data?.totalCount ?? 0;

  const emailById = useMemo(
    () => Object.fromEntries(profiles.map((p) => [p.id, p.email || p.full_name || p.id])),
    [profiles]
  );

  const roleById = useMemo(() => Object.fromEntries(profiles.map((p) => [p.id, p.role])), [profiles]);

  const auditMetrics = useMemo(() => {
    if (stats && typeof stats === 'object') {
      const bk = stats.by_kind || {};
      return {
        events: Number(stats.total) || 0,
        uniqueUsers: Number(stats.distinct_users) || 0,
        distinctRoutes: Number(stats.distinct_paths) || 0,
        lastAccess: stats.last_access || null,
        byKind: {
          gov: Number(bk.gov) || 0,
          ops: Number(bk.ops) || 0,
          auth: Number(bk.auth) || 0,
          other: Number(bk.other) || 0,
        },
      };
    }
    return {
      events: 0,
      uniqueUsers: 0,
      distinctRoutes: 0,
      lastAccess: null,
      byKind: { gov: 0, ops: 0, auth: 0, other: 0 },
    };
  }, [stats]);

  const logsForTable = useMemo(
    () => logs.map((l) => ({ ...l, _userLabel: emailById[l.user_id] || l.user_id || '' })),
    [logs, emailById]
  );

  const logColumns = useMemo(() => {
    const h = createColumnHelper();
    return [
      h.accessor('accessed_at', {
        header: 'Quando',
        cell: ({ getValue }) => (
          <span className="whitespace-nowrap text-xs">{getValue() ? new Date(getValue()).toLocaleString('pt-BR') : '—'}</span>
        ),
      }),
      h.accessor('user_id', {
        header: 'Usuário',
        cell: ({ row }) => {
          const uid = row.original.user_id;
          const isOwner = roleById[uid] === 'owner';
          const label = emailById[uid] || uid;
          return (
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              {isOwner ? (
                <span className="shrink-0 rounded border border-amber-300/90 bg-amber-100 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-amber-950">
                  Owner
                </span>
              ) : null}
              <span className="min-w-0 break-all font-mono text-[11px]">{label}</span>
            </div>
          );
        },
      }),
      h.accessor('path', {
        header: 'Rota',
        cell: ({ getValue }) => {
          const path = getValue() || '—';
          const kind = getAuditRouteKind(getValue());
          return (
            <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
              <span className={`inline-flex w-fit shrink-0 rounded px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${kind.chip}`}>{kind.label}</span>
              <span className="break-all font-mono text-xs text-primary">{path}</span>
            </div>
          );
        },
      }),
      h.accessor('user_agent', {
        header: 'User-Agent',
        cell: ({ getValue }) => (
          <span className="line-clamp-2 break-all text-[10px] text-on-surface-variant" title={getValue() || ''}>
            {getValue() || '—'}
          </span>
        ),
        meta: { tdClassName: 'hidden sm:table-cell' },
      }),
      h.display({
        id: 'actions',
        header: 'Ações',
        cell: ({ row }) => (
          <button
            type="button"
            onClick={() => setPanel({ open: true, row: row.original })}
            className="border border-primary px-2 py-1 text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary hover:text-white"
          >
            Ver
          </button>
        ),
      }),
    ];
  }, [emailById, roleById]);

  const logRow = panel.open ? panel.row : null;

  const rangeBtns = [
    { id: 'all', label: 'Tudo' },
    { id: 'today', label: 'Hoje' },
    { id: 'week', label: '7 dias' },
  ];

  const pageCount = totalCount === 0 ? 1 : Math.ceil(totalCount / PAGE_SIZE);

  const showInitialSkeleton = isPending && data === undefined;

  return (
    <>
      <div className="w-full min-w-0 space-y-5">
        <div className="flex flex-col gap-3 border-b border-surface-container-high pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-sm font-black uppercase tracking-[0.18em] text-primary">Auditoria de acessos</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Período</span>
            <div className="flex flex-wrap gap-1.5">
              {rangeBtns.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setRange(b.id)}
                  disabled={showInitialSkeleton}
                  className={`rounded-sm border px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-colors disabled:opacity-50 ${
                    range === b.id
                      ? 'border-primary bg-primary text-white'
                      : 'border-surface-container-high bg-white text-primary hover:border-primary/40'
                  }`}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {auditQuery.isError && (
          <p className="text-sm font-semibold text-red-600" role="alert">
            {String(error?.message ?? error ?? 'Erro ao carregar')}
          </p>
        )}
        {showInitialSkeleton ? <p className="text-sm text-on-surface-variant">Carregando auditoria…</p> : null}

        <section className={showInitialSkeleton ? 'pointer-events-none min-h-[280px]' : ''}>
          <div className="mb-4 flex items-center gap-3">
            <div className="h-6 w-1.5 bg-tertiary" aria-hidden />
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-primary">Indicadores</h2>
            {isFetching ? (
              <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/70">A atualizar…</span>
            ) : null}
          </div>

          {!showInitialSkeleton ? (
            <div className="grid min-w-0 grid-cols-2 gap-4 lg:grid-cols-4">
              <DashboardMetricCard
                label="Eventos"
                value={auditMetrics.events}
                surface="whiteMedia"
                footer={
                  <>
                    <span className="material-symbols-outlined text-sm">dataset</span>
                    Registos no período filtrado
                  </>
                }
              />
              <DashboardMetricCard
                label="Utilizadores"
                value={auditMetrics.uniqueUsers}
                surface="whiteMedia"
                footer={
                  <>
                    <span className="material-symbols-outlined text-sm">group</span>
                    Perfis distintos nos logs
                  </>
                }
              />
              <DashboardMetricCard
                label="Rotas distintas"
                value={auditMetrics.distinctRoutes}
                surface="whiteMedia"
                footer={
                  <>
                    <span className="material-symbols-outlined text-sm">route</span>
                    Caminhos únicos acessados
                  </>
                }
              />
              <DashboardMetricCard
                label="Último acesso"
                value={auditMetrics.lastAccess ? new Date(auditMetrics.lastAccess).toLocaleString('pt-BR') : '—'}
                surface="whiteAccentAmber"
                valueClassName="mb-2 font-mono text-base font-bold tabular-nums text-amber-950 sm:text-lg"
                footer={
                  <>
                    <span className="material-symbols-outlined text-sm text-amber-800">schedule</span>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-black uppercase text-slate-700">
                      Gov {auditMetrics.byKind.gov}
                    </span>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-black uppercase text-slate-700">
                      App {auditMetrics.byKind.ops}
                    </span>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-black uppercase text-slate-700">
                      Auth {auditMetrics.byKind.auth}
                    </span>
                    {auditMetrics.byKind.other > 0 ? (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-black uppercase text-slate-700">
                        +{auditMetrics.byKind.other}
                      </span>
                    ) : null}
                  </>
                }
              />
            </div>
          ) : null}
        </section>

        <section className="overflow-hidden rounded-sm border border-surface-container-high bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-[#f8fafc] px-4 py-3 sm:px-5 sm:py-3.5">
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-700">Registros de acesso ao painel</h2>
          </div>
          <div className="p-4 sm:p-5">
            {!showInitialSkeleton ? (
              <EntityDataTable
                data={logsForTable}
                columns={logColumns}
                getRowId={(r) => r.id}
                searchPlaceholder="Buscar por rota, e-mail ou user-agent…"
                pageSize={PAGE_SIZE}
                emptyLabel="Nenhum registro."
                serverPagination
                pageIndex={pageIndex}
                onPageIndexChange={setPageIndex}
                totalRowCount={totalCount}
                pageCount={pageCount}
                searchValue={searchInput}
                onSearchChange={setSearchInput}
              />
            ) : null}
          </div>
        </section>
      </div>

      <AuditAccessLogSideover
        key={logRow?.id ?? 'log'}
        open={panel.open && !!logRow}
        onClose={() => setPanel({ open: false, row: null })}
        log={logRow}
        emailById={emailById}
        roleById={roleById}
      />
    </>
  );
}
