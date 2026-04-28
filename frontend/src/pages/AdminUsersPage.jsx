import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createColumnHelper } from '@tanstack/react-table';
import { EntityDataTable } from '../components/EntityDataTable';
import { HubButton } from '../components/HubButton';
import { AppSideover } from '../components/AppSideover';
import { DashboardMetricCard } from '../components/DashboardMetricCard';
import { useAuth } from '../context/AuthContext';
import { fetchAdminUsersBundle, fetchHubSolicitacoesAprovadasRecentes } from '../lib/governanceQueries';
import { GOV_SECTION_STORAGE, useGovSectionExpanded } from '../lib/govSectionExpand';
import { getHubOwnerEmail } from '../lib/hubOwner';
import { AdminConfigurationsPage } from './AdminConfigurationsPage';

export function AdminUsersPage() {
  const { supabase, session, isHubOwner } = useAuth();
  const queryClient = useQueryClient();
  const [busySolicId, setBusySolicId] = useState(null);
  const [panel, setPanel] = useState({ open: false, kind: null, row: null });
  const [historyOpen, setHistoryOpen] = useState(false);

  const ownerEmailConfigured = Boolean(getHubOwnerEmail());
  const showFilaHub = useMemo(
    () => (ownerEmailConfigured ? isHubOwner : true),
    [ownerEmailConfigured, isHubOwner]
  );

  const [solicSectionOpen, toggleSolicSection] = useGovSectionExpanded(GOV_SECTION_STORAGE.solicHubAdmins);

  const usersQuery = useQuery({
    queryKey: ['governance', 'users-page', showFilaHub],
    queryFn: () => fetchAdminUsersBundle(supabase, showFilaHub),
    enabled: Boolean(supabase),
  });

  const aprovadasQuery = useQuery({
    queryKey: ['governance', 'hub-solic-aprovadas'],
    queryFn: () => fetchHubSolicitacoesAprovadasRecentes(supabase),
    enabled: Boolean(supabase) && historyOpen && showFilaHub,
  });

  const profiles = usersQuery.data?.profiles ?? [];
  const solicitacoes = usersQuery.data?.solicitacoes ?? [];
  const loading = usersQuery.isPending && usersQuery.data === undefined;
  const err = usersQuery.isError ? String(usersQuery.error?.message ?? usersQuery.error) : null;
  const [solicActionErr, setSolicActionErr] = useState(null);

  async function resolverSolicitacao(id, status) {
    if (!supabase || !session?.user?.id) return;
    setBusySolicId(id);
    setSolicActionErr(null);
    try {
      const { error } = await supabase
        .from('hub_solicitacoes_admin')
        .update({
          status,
          resolvido_em: new Date().toISOString(),
          resolvido_por_user_id: session.user.id,
        })
        .eq('id', id);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['governance', 'users-page'] });
      await queryClient.invalidateQueries({ queryKey: ['governance', 'hub-access-config'] });
      await queryClient.invalidateQueries({ queryKey: ['governance', 'hub-solic-aprovadas'] });
      setPanel((p) =>
        p.open && p.kind === 'solic' && p.row?.id === id
          ? { ...p, row: { ...p.row, status, resolvido_em: new Date().toISOString() } }
          : p
      );
    } catch (e) {
      setSolicActionErr(e?.message || 'Erro ao atualizar');
    } finally {
      setBusySolicId(null);
    }
  }

  const solicColumns = useMemo(() => {
    const h = createColumnHelper();
    return [
      h.accessor('criado_em', {
        header: 'Quando',
        cell: ({ getValue }) => (
          <span className="text-xs whitespace-nowrap">{getValue() ? new Date(getValue()).toLocaleString('pt-BR') : '—'}</span>
        ),
      }),
      h.accessor('email', {
        header: 'E-mail',
        cell: ({ getValue }) => <span className="font-mono text-xs break-all">{getValue() || '—'}</span>,
      }),
      h.accessor('nome', {
        header: 'Nome',
        cell: ({ getValue }) => <span className="min-w-0 break-words">{getValue() || '—'}</span>,
      }),
      h.accessor('telefone', {
        header: 'Tel.',
        cell: ({ getValue }) => <span className="text-xs font-mono">{getValue() || '—'}</span>,
        meta: { tdClassName: 'hidden md:table-cell' },
      }),
      h.accessor('cpf', {
        header: 'CPF',
        cell: ({ getValue }) => <span className="text-xs font-mono">{getValue() || '—'}</span>,
        meta: { tdClassName: 'hidden lg:table-cell' },
      }),
      h.accessor('status', {
        header: 'Status',
        cell: ({ getValue }) => {
          const s = getValue();
          return (
            <span
              className={`text-[10px] font-black uppercase px-2 py-0.5 inline-block ${
                s === 'pendente' ? 'bg-amber-50 text-amber-900' : s === 'aprovado' ? 'bg-tertiary/20 text-primary' : 'bg-slate-100 text-on-surface-variant'
              }`}
            >
              {s}
            </span>
          );
        },
      }),
      h.accessor('mensagem', {
        header: 'Mensagem',
        cell: ({ getValue }) => (
          <span className="max-w-[140px] text-xs text-on-surface-variant line-clamp-2 break-words" title={getValue() || ''}>
            {getValue() || '—'}
          </span>
        ),
        meta: { tdClassName: 'hidden sm:table-cell max-w-[140px]' },
      }),
      h.display({
        id: 'actions',
        header: 'Ações',
        cell: ({ row }) => (
          <HubButton
            variant="tableSecondary"
            icon="open_in_new"
            iconClassName="text-[16px]"
            onClick={() => setPanel({ open: true, kind: 'solic', row: row.original })}
          >
            Abrir
          </HubButton>
        ),
      }),
    ];
  }, []);

  const solicRow = panel.kind === 'solic' ? panel.row : null;

  return (
    <>
      <div className="w-full min-w-0 space-y-6">
        {(err || solicActionErr) && (
          <p className="text-sm font-semibold text-red-600" role="alert">
            {err || solicActionErr}
          </p>
        )}
        {loading ? <p className="text-sm text-on-surface-variant">Carregando dados de usuários…</p> : null}

        {!loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <DashboardMetricCard
              label="Perfis"
              value={profiles.length}
              surface="whiteMedia"
              footer={
                <>
                  <span className="material-symbols-outlined text-sm">groups</span>
                  Usuários no HUB
                </>
              }
            />
            <DashboardMetricCard
              label="Com audit"
              value={profiles.filter((p) => p.can_access_audit).length}
              surface="whiteMedia"
              valueClassName="text-3xl sm:text-4xl font-black text-tertiary tracking-tighter tabular-nums mb-2"
              footer={
                <>
                  <span className="material-symbols-outlined text-sm">verified</span>
                  Painel de auditoria
                </>
              }
            />
            <DashboardMetricCard
              label="Pendentes (fila)"
              value={solicitacoes.filter((s) => s.status === 'pendente').length}
              surface="whiteAccentAmber"
              valueClassName="text-3xl sm:text-4xl font-black tabular-nums text-amber-950 mb-2"
              footer={
                <>
                  <span className="material-symbols-outlined text-sm text-amber-800">hourglass_top</span>
                  Solicitações administrativas
                </>
              }
            />
          </div>
        ) : null}

        {!loading ? (
          <div className="space-y-6">
            {showFilaHub ? (
              <section className="overflow-hidden rounded-sm border border-surface-container-high bg-white shadow-sm">
                <div className="border-b border-slate-200 bg-[#f8fafc] px-4 py-3 sm:px-5 sm:py-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      id="gov-section-solic-hub-heading"
                      aria-expanded={solicSectionOpen}
                      aria-controls="gov-section-solic-hub-panel"
                      className="min-w-0 flex flex-1 cursor-pointer items-center gap-2 rounded-sm py-0.5 text-left outline-none ring-inset focus-visible:ring-2 focus-visible:ring-primary/40"
                      onClick={toggleSolicSection}
                    >
                      <span
                        className="material-symbols-outlined shrink-0 text-[20px] text-slate-600 transition-transform"
                        style={{ transform: solicSectionOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }}
                        aria-hidden
                      >
                        expand_more
                      </span>
                      <span className="min-w-0 flex-1">
                        <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-700">
                          Solicitações — acesso administrativo HUB
                        </h2>
                      </span>
                    </button>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <HubButton
                        variant="secondary"
                        icon="history"
                        className="!px-3 !py-2 !text-[9px]"
                        onClick={(e) => {
                          e.stopPropagation();
                          setHistoryOpen(true);
                        }}
                      >
                        Histórico de aprovações
                      </HubButton>
                      {usersQuery.isFetching ? (
                        <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/70">
                          A atualizar…
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div
                  id="gov-section-solic-hub-panel"
                  role="region"
                  aria-labelledby="gov-section-solic-hub-heading"
                  hidden={!solicSectionOpen}
                  className="p-4 sm:p-5"
                >
                  <EntityDataTable
                    data={solicitacoes}
                    columns={solicColumns}
                    getRowId={(r) => r.id}
                    searchPlaceholder="Pesquisar solicitações…"
                    pageSize={8}
                    emptyLabel="Nenhuma solicitação."
                  />
                </div>
              </section>
            ) : null}

            <AdminConfigurationsPage />
          </div>
        ) : null}
      </div>

      <AppSideover
        key={solicRow?.id ?? 'solic'}
        open={panel.open && panel.kind === 'solic' && !!solicRow}
        onClose={() => setPanel({ open: false, kind: null, row: null })}
        eyebrow="Controles e acessos"
        title="Solicitação HUB"
        subtitle={solicRow?.email}
        tabItems={
          solicRow
            ? [
                {
                  id: 'det',
                  label: 'Detalhes',
                  content: (
                    <dl className="space-y-3 text-sm">
                      <div>
                        <dt className="text-[10px] font-black uppercase text-on-surface-variant">Quando</dt>
                        <dd className="mt-0.5 font-mono text-xs">
                          {solicRow.criado_em ? new Date(solicRow.criado_em).toLocaleString('pt-BR') : '—'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[10px] font-black uppercase text-on-surface-variant">Nome</dt>
                        <dd className="mt-0.5">{solicRow.nome || '—'}</dd>
                      </div>
                      <div>
                        <dt className="text-[10px] font-black uppercase text-on-surface-variant">Tel. / CPF</dt>
                        <dd className="mt-0.5 font-mono text-xs">
                          {solicRow.telefone || '—'} · {solicRow.cpf || '—'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[10px] font-black uppercase text-on-surface-variant">Mensagem</dt>
                        <dd className="mt-0.5 whitespace-pre-wrap break-words">{solicRow.mensagem || '—'}</dd>
                      </div>
                      <div>
                        <dt className="text-[10px] font-black uppercase text-on-surface-variant">Status</dt>
                        <dd className="mt-0.5">{solicRow.status}</dd>
                      </div>
                    </dl>
                  ),
                },
                {
                  id: 'dec',
                  label: 'Decisão',
                  content: (
                    <div className="space-y-4">
                      {solicRow.status === 'pendente' ? (
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <HubButton
                            variant="primary"
                            icon="check_circle"
                            disabled={busySolicId === solicRow.id}
                            onClick={() => resolverSolicitacao(solicRow.id, 'aprovado')}
                            className="!text-xs !tracking-wide"
                          >
                            Aprovar
                          </HubButton>
                          <HubButton
                            variant="secondary"
                            icon="cancel"
                            disabled={busySolicId === solicRow.id}
                            onClick={() => resolverSolicitacao(solicRow.id, 'rejeitado')}
                            className="!text-xs !tracking-wide"
                          >
                            Rejeitar
                          </HubButton>
                        </div>
                      ) : (
                        <p className="text-sm text-on-surface-variant">
                          Resolvido em{' '}
                          {solicRow.resolvido_em ? new Date(solicRow.resolvido_em).toLocaleString('pt-BR') : '—'}
                        </p>
                      )}
                    </div>
                  ),
                },
              ]
            : []
        }
      />

      <AppSideover
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        eyebrow="Solicitações administrativas HUB"
        title="Histórico de aprovações"
        subtitle="Últimas solicitações com estado «aprovado» (timestamps de resolução)"
        bodyClassName="p-0 bg-slate-50"
      >
        {aprovadasQuery.isError ? (
          <p className="p-4 text-sm font-semibold text-red-600" role="alert">
            {String(aprovadasQuery.error?.message ?? aprovadasQuery.error)}
          </p>
        ) : aprovadasQuery.isPending ? (
          <p className="p-4 text-sm text-on-surface-variant">A carregar histórico…</p>
        ) : (
          <ul className="divide-y divide-slate-200 border-t border-slate-200">
            {(aprovadasQuery.data || []).length === 0 ? (
              <li className="px-4 py-6 text-sm text-on-surface-variant">Nenhuma aprovação registada ainda.</li>
            ) : (
              (aprovadasQuery.data || []).map((row) => (
                <li key={row.id} className="px-4 py-3 sm:px-5">
                  <p className="text-xs font-black uppercase tracking-wider text-tertiary">
                    {row.resolvido_em ? new Date(row.resolvido_em).toLocaleString('pt-BR') : '—'}
                  </p>
                  <p className="mt-1 font-mono text-xs break-all text-slate-800">{row.email || '—'}</p>
                  <p className="mt-0.5 text-sm text-slate-700">{row.nome || '—'}</p>
                  <p className="mt-1 text-[11px] text-on-surface-variant">
                    Aprovado por{' '}
                    <span className="font-medium text-slate-700">
                      {[row.resolvido_por_nome, row.resolvido_por_email].filter(Boolean).join(' · ') ||
                        (row.resolvido_por_user_id ? String(row.resolvido_por_user_id) : '—')}
                    </span>
                  </p>
                </li>
              ))
            )}
          </ul>
        )}
      </AppSideover>
    </>
  );
}
