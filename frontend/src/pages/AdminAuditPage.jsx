import { useCallback, useEffect, useMemo, useState } from 'react';
import { createColumnHelper } from '@tanstack/react-table';
import { AuditAccessLogSideover } from '../components/audit/AuditAccessLogSideover';
import { EntityDataTable } from '../components/EntityDataTable';
import { useAuth } from '../context/AuthContext';
import { getAuditRouteKind } from '../lib/auditRouteKind';
import { logPanelAccess } from '../lib/panelAccessLog';

const PAGE_SIZE = 12;
const NO_MATCH_USER = '00000000-0000-0000-0000-000000000000';

function sinceIso(range) {
  if (range === 'all') return null;
  const now = new Date();
  if (range === 'today') {
    const s = new Date(now);
    s.setHours(0, 0, 0, 0);
    return s.toISOString();
  }
  if (range === 'week') {
    const s = new Date(now);
    s.setDate(s.getDate() - 7);
    return s.toISOString();
  }
  return null;
}

function escapeIlike(s) {
  return s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

export function AdminAuditPage() {
  const { supabase, session } = useAuth();
  const [profiles, setProfiles] = useState([]);
  const [logs, setLogs] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
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

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.from('profiles').select('id, email, full_name, role').order('updated_at', { ascending: false });
      if (!cancelled && !error) setProfiles(data || []);
      if (!cancelled && error) setErr(error.message);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const fetchLogsAndStats = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setErr(null);
    const since = sinceIso(range);
    const from = pageIndex * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    try {
      const { data: rpcData, error: rpcErr } = await supabase.rpc('audit_panel_stats', { p_since: since });
      if (!rpcErr && rpcData) setStats(rpcData);
      else setStats(null);

      let query = supabase
        .from('panel_access_logs')
        .select('id, user_id, path, accessed_at, user_agent', { count: 'exact' })
        .order('accessed_at', { ascending: false });

      if (since) query = query.gte('accessed_at', since);

      const q = debouncedSearch.trim();
      if (q) {
        if (q.includes('@')) {
          const ids = profiles.filter((p) => p.email?.toLowerCase().includes(q.toLowerCase())).map((p) => p.id);
          if (ids.length) query = query.in('user_id', ids);
          else query = query.eq('user_id', NO_MATCH_USER);
        } else {
          const esc = escapeIlike(q);
          query = query.or(`path.ilike.%${esc}%,user_agent.ilike.%${esc}%`);
        }
      }

      const { data, error, count } = await query.range(from, to);
      if (error) throw error;
      setLogs(data || []);
      setTotalCount(count ?? 0);
    } catch (e) {
      setErr(e.message || 'Erro ao carregar');
      setLogs([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [supabase, pageIndex, range, debouncedSearch, profiles]);

  useEffect(() => {
    fetchLogsAndStats();
  }, [fetchLogsAndStats]);

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
          <span className="text-xs whitespace-nowrap">{getValue() ? new Date(getValue()).toLocaleString('pt-BR') : '—'}</span>
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
          <span className="text-[10px] text-on-surface-variant line-clamp-2 break-all" title={getValue() || ''}>
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
            className="text-[10px] font-black uppercase tracking-widest border border-primary text-primary px-2 py-1 hover:bg-primary hover:text-white"
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
                  className={`rounded-sm border px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-colors ${
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

        {loading && <p className="text-[10px] font-black uppercase text-on-surface-variant">Carregando…</p>}
        {err && <p className="text-sm font-semibold text-red-600">{err}</p>}

        <section className="grid grid-cols-2 gap-3 min-w-0 lg:grid-cols-4">
          <div className="relative overflow-hidden rounded-sm bg-gradient-to-br from-primary to-[#152a3d] p-4 text-white shadow-md">
            <span className="material-symbols-outlined absolute right-3 top-3 text-[40px] text-white/10" aria-hidden>
              dataset
            </span>
            <p className="text-[10px] font-black uppercase tracking-widest text-white/75">Eventos</p>
            <p className="mt-1 text-3xl font-black tabular-nums">{auditMetrics.events}</p>
          </div>
          <div className="relative overflow-hidden rounded-sm bg-gradient-to-br from-slate-600 to-slate-800 p-4 text-white shadow-md">
            <span className="material-symbols-outlined absolute right-3 top-3 text-[40px] text-white/10" aria-hidden>
              group
            </span>
            <p className="text-[10px] font-black uppercase tracking-widest text-white/75">Utilizadores</p>
            <p className="mt-1 text-3xl font-black tabular-nums">{auditMetrics.uniqueUsers}</p>
          </div>
          <div className="relative overflow-hidden rounded-sm bg-gradient-to-br from-tertiary to-[#16a34a] p-4 text-primary shadow-md">
            <span className="material-symbols-outlined absolute right-3 top-3 text-[40px] text-primary/15" aria-hidden>
              route
            </span>
            <p className="text-[10px] font-black uppercase tracking-widest text-primary/90">Rotas distintas</p>
            <p className="mt-1 text-3xl font-black tabular-nums">{auditMetrics.distinctRoutes}</p>
          </div>
          <div className="rounded-sm border border-amber-200/90 bg-gradient-to-b from-amber-50 to-amber-100/80 p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-amber-900/80">Último acesso</p>
                <p className="mt-1 font-mono text-sm font-bold leading-snug text-amber-950">
                  {auditMetrics.lastAccess ? new Date(auditMetrics.lastAccess).toLocaleString('pt-BR') : '—'}
                </p>
              </div>
              <span className="material-symbols-outlined shrink-0 text-amber-800/50 text-[32px]" aria-hidden>
                schedule
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5 text-[9px] font-bold uppercase tracking-wide text-amber-950/90">
              <span className="rounded bg-white/60 px-1.5 py-0.5">Gov {auditMetrics.byKind.gov}</span>
              <span className="rounded bg-white/60 px-1.5 py-0.5">App {auditMetrics.byKind.ops}</span>
              <span className="rounded bg-white/60 px-1.5 py-0.5">Auth {auditMetrics.byKind.auth}</span>
              {auditMetrics.byKind.other > 0 ? (
                <span className="rounded bg-white/60 px-1.5 py-0.5">+{auditMetrics.byKind.other}</span>
              ) : null}
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-sm border border-surface-container-high bg-white shadow-md">
          <div className="border-b border-surface-container-high bg-gradient-to-r from-primary via-[#1a3050] to-[#24364a] px-4 py-3 sm:px-5 sm:py-4">
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-white">Registros de acesso ao painel</h2>
          </div>
          <div className="p-4 sm:p-5">
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
