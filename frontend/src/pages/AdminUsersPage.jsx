import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createColumnHelper } from '@tanstack/react-table';
import { EntityDataTable } from '../components/EntityDataTable';
import { AppSideover } from '../components/AppSideover';
import { DashboardMetricCard } from '../components/DashboardMetricCard';
import { useAuth } from '../context/AuthContext';
import { fetchAdminUsersBundle } from '../lib/governanceQueries';
import { getHubOwnerEmail } from '../lib/hubOwner';

export function AdminUsersPage() {
  const { supabase, session, isHubOwner } = useAuth();
  const queryClient = useQueryClient();
  const [busySolicId, setBusySolicId] = useState(null);
  const [panel, setPanel] = useState({ open: false, kind: null, row: null });

  const ownerEmailConfigured = Boolean(getHubOwnerEmail());
  const showFilaHub = useMemo(
    () => (ownerEmailConfigured ? isHubOwner : true),
    [ownerEmailConfigured, isHubOwner]
  );

  const usersQuery = useQuery({
    queryKey: ['governance', 'users-page', showFilaHub],
    queryFn: () => fetchAdminUsersBundle(supabase, showFilaHub),
    enabled: Boolean(supabase),
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
          <button
            type="button"
            onClick={() => setPanel({ open: true, kind: 'solic', row: row.original })}
            className="text-[10px] font-black uppercase tracking-widest border border-primary text-primary px-2 py-1 hover:bg-primary hover:text-white"
          >
            Abrir
          </button>
        ),
      }),
    ];
  }, []);

  const profileColumns = useMemo(() => {
    const h = createColumnHelper();
    return [
      h.accessor('email', {
        header: 'E-mail',
        cell: ({ getValue }) => <span className="font-mono text-xs break-all">{getValue() || '—'}</span>,
      }),
      h.accessor('full_name', {
        header: 'Nome',
        cell: ({ getValue }) => <span className="min-w-0 break-words">{getValue() || '—'}</span>,
      }),
      h.accessor('role', {
        header: 'Papel',
        cell: ({ getValue }) => {
          const r = getValue();
          return (
            <span
              className={`text-[10px] font-black uppercase px-2 py-0.5 ${
                r === 'owner' ? 'bg-primary text-white' : r === 'admin' ? 'bg-tertiary/20 text-primary' : 'bg-slate-100 text-on-surface-variant'
              }`}
            >
              {r}
            </span>
          );
        },
      }),
      h.accessor('can_access_audit', {
        header: 'Audit',
        cell: ({ getValue }) => (
          <span className={`text-[10px] font-black uppercase px-2 py-0.5 ${getValue() ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-on-surface-variant'}`}>
            {getValue() ? 'Sim' : 'Não'}
          </span>
        ),
      }),
      h.accessor('updated_at', {
        header: 'Atualizado',
        cell: ({ getValue }) => (
          <span className="text-xs text-on-surface-variant whitespace-nowrap">{getValue() ? new Date(getValue()).toLocaleString('pt-BR') : '—'}</span>
        ),
      }),
      h.display({
        id: 'actions',
        header: 'Ações',
        cell: ({ row }) => (
          <button
            type="button"
            onClick={() => setPanel({ open: true, kind: 'profile', row: row.original })}
            className="text-[10px] font-black uppercase tracking-widest border border-primary text-primary px-2 py-1 hover:bg-primary hover:text-white"
          >
            Ver
          </button>
        ),
      }),
    ];
  }, []);

  const solicRow = panel.kind === 'solic' ? panel.row : null;
  const profileRow = panel.kind === 'profile' ? panel.row : null;

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
                  Utilizadores no HUB
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

        {showFilaHub && (
          <section className="overflow-hidden rounded-sm border border-surface-container-high bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-[#f8fafc] px-4 py-3 sm:px-5 sm:py-3.5">
              <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-700">
                Solicitações — acesso administrativo HUB
              </h2>
              {usersQuery.isFetching && !loading ? (
                <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-on-surface-variant/70">A atualizar…</p>
              ) : null}
            </div>
            <div className="p-4 sm:p-5">
              {!loading ? (
                <EntityDataTable
                  data={solicitacoes}
                  columns={solicColumns}
                  getRowId={(r) => r.id}
                  searchPlaceholder="Buscar solicitações…"
                  pageSize={8}
                  emptyLabel="Nenhuma solicitação."
                />
              ) : null}
            </div>
          </section>
        )}

        <section className="overflow-hidden rounded-sm border border-surface-container-high bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-[#f8fafc] px-4 py-3 sm:px-5 sm:py-3.5">
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-700">Usuários (profiles)</h2>
          </div>
          <div className="p-4 sm:p-5">
            {!loading ? (
              <EntityDataTable
                data={profiles}
                columns={profileColumns}
                getRowId={(r) => r.id}
                searchPlaceholder="Buscar usuários…"
                pageSize={10}
                emptyLabel="Nenhum usuário."
              />
            ) : null}
          </div>
        </section>
      </div>

      <AppSideover
        key={solicRow?.id ?? 'solic'}
        open={panel.open && panel.kind === 'solic' && !!solicRow}
        onClose={() => setPanel({ open: false, kind: null, row: null })}
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
                          <button
                            type="button"
                            disabled={busySolicId === solicRow.id}
                            onClick={() => resolverSolicitacao(solicRow.id, 'aprovado')}
                            className="bg-tertiary px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-primary hover:bg-tertiary/90 disabled:opacity-50"
                          >
                            Aprovar
                          </button>
                          <button
                            type="button"
                            disabled={busySolicId === solicRow.id}
                            onClick={() => resolverSolicitacao(solicRow.id, 'rejeitado')}
                            className="border border-primary px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary hover:text-white disabled:opacity-50"
                          >
                            Rejeitar
                          </button>
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
        key={profileRow?.id ?? 'profile'}
        open={panel.open && panel.kind === 'profile' && !!profileRow}
        onClose={() => setPanel({ open: false, kind: null, row: null })}
        title="Perfil"
        subtitle={profileRow?.email}
        tabItems={
          profileRow
            ? [
                {
                  id: 'p',
                  label: 'Dados',
                  content: (
                    <dl className="space-y-3 text-sm">
                      <div>
                        <dt className="text-[10px] font-black uppercase text-on-surface-variant">ID</dt>
                        <dd className="mt-0.5 break-all font-mono text-[11px]">{profileRow.id}</dd>
                      </div>
                      <div>
                        <dt className="text-[10px] font-black uppercase text-on-surface-variant">Nome</dt>
                        <dd className="mt-0.5">{profileRow.full_name || '—'}</dd>
                      </div>
                      <div>
                        <dt className="text-[10px] font-black uppercase text-on-surface-variant">Papel</dt>
                        <dd className="mt-0.5">{profileRow.role}</dd>
                      </div>
                      <div>
                        <dt className="text-[10px] font-black uppercase text-on-surface-variant">Acesso audit</dt>
                        <dd className="mt-0.5">{profileRow.can_access_audit ? 'Sim' : 'Não'}</dd>
                      </div>
                      <div>
                        <dt className="text-[10px] font-black uppercase text-on-surface-variant">Atualizado</dt>
                        <dd className="mt-0.5 font-mono text-xs">
                          {profileRow.updated_at ? new Date(profileRow.updated_at).toLocaleString('pt-BR') : '—'}
                        </dd>
                      </div>
                    </dl>
                  ),
                },
                {
                  id: 'g',
                  label: 'Gestão',
                  content: (
                    <div className="flex flex-col gap-2 text-sm">
                        <Link
                          to="/adm/auditoria"
                          onClick={() => setPanel({ open: false, kind: null, row: null })}
                          className="inline-flex items-center justify-center border border-primary px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary hover:text-white"
                        >
                          Auditoria
                        </Link>
                        <Link
                          to="/adm/configuracoes"
                          onClick={() => setPanel({ open: false, kind: null, row: null })}
                          className="inline-flex items-center justify-center border border-primary px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary hover:text-white"
                        >
                          Configurações
                        </Link>
                    </div>
                  ),
                },
              ]
            : []
        }
      />
    </>
  );
}
