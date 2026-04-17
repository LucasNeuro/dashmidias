import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { createColumnHelper } from '@tanstack/react-table';
import { EntityDataTable } from '../components/EntityDataTable';
import { AppSideover } from '../components/AppSideover';
import { useAuth } from '../context/AuthContext';
import { getHubOwnerEmail } from '../lib/hubOwner';

export function AdminUsersPage() {
  const { supabase, session, isHubOwner } = useAuth();
  const [profiles, setProfiles] = useState([]);
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [solicErr, setSolicErr] = useState(null);
  const [busySolicId, setBusySolicId] = useState(null);
  const [panel, setPanel] = useState({ open: false, kind: null, row: null });

  const ownerEmailConfigured = Boolean(getHubOwnerEmail());
  const showFilaHub = useMemo(
    () => (ownerEmailConfigured ? isHubOwner : true),
    [ownerEmailConfigured, isHubOwner]
  );

  const loadSolicitacoes = useCallback(async () => {
    if (!supabase || !showFilaHub) return;
    setSolicErr(null);
    const { data, error } = await supabase
      .from('hub_solicitacoes_admin')
      .select('id, email, nome, telefone, cpf, user_id, mensagem, status, criado_em, resolvido_em')
      .order('criado_em', { ascending: false })
      .limit(200);
    if (error) setSolicErr(error.message);
    else setSolicitacoes(data || []);
  }, [supabase, showFilaHub]);

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, email, full_name, role, can_access_audit, updated_at')
          .order('updated_at', { ascending: false });
        if (error) throw error;
        if (!cancelled) setProfiles(data || []);
        if (!cancelled && showFilaHub) await loadSolicitacoes();
      } catch (e) {
        if (!cancelled) setErr(e.message || 'Erro ao carregar');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, showFilaHub, loadSolicitacoes]);

  async function resolverSolicitacao(id, status) {
    if (!supabase || !session?.user?.id) return;
    setBusySolicId(id);
    setSolicErr(null);
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
      await loadSolicitacoes();
      setPanel((p) =>
        p.open && p.kind === 'solic' && p.row?.id === id
          ? { ...p, row: { ...p.row, status, resolvido_em: new Date().toISOString() } }
          : p
      );
    } catch (e) {
      setSolicErr(e.message || 'Erro ao atualizar');
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
      <div className="w-full space-y-6 min-w-0">
        {loading && <p className="text-[10px] font-black uppercase text-on-surface-variant">Carregando…</p>}
        {err && <p className="text-sm text-red-600 font-semibold">{err}</p>}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-sm border border-surface-container-high bg-gradient-to-br from-primary to-[#152a3d] p-4 text-white shadow-md">
            <p className="text-[10px] font-black uppercase tracking-widest text-white/75">Perfis</p>
            <p className="mt-1 text-2xl font-black tabular-nums">{profiles.length}</p>
          </div>
          <div className="rounded-sm border border-tertiary/40 bg-gradient-to-br from-tertiary/90 to-[#16a34a] p-4 text-primary shadow-md">
            <p className="text-[10px] font-black uppercase tracking-widest text-primary/90">Com audit</p>
            <p className="mt-1 text-2xl font-black tabular-nums">{profiles.filter((p) => p.can_access_audit).length}</p>
          </div>
          <div className="rounded-sm border border-amber-200/80 bg-amber-50 p-4 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-900/80">Pendentes (fila)</p>
            <p className="mt-1 text-2xl font-black tabular-nums text-amber-950">{solicitacoes.filter((s) => s.status === 'pendente').length}</p>
          </div>
        </div>

        {showFilaHub && (
          <section className="overflow-hidden rounded-sm border border-surface-container-high bg-white shadow-sm">
            <div className="border-b border-surface-container-high bg-gradient-to-r from-primary via-[#1a3050] to-[#24364a] px-4 py-3 sm:px-5">
              <h2 className="text-xs font-black uppercase tracking-[0.2em] text-white">Solicitações — acesso administrativo HUB</h2>
            </div>
            {solicErr && <p className="px-4 py-2 text-sm text-red-600 sm:px-5">{solicErr}</p>}
            <div className="p-4 sm:p-5">
              <EntityDataTable
                data={solicitacoes}
                columns={solicColumns}
                getRowId={(r) => r.id}
                searchPlaceholder="Buscar solicitações…"
                pageSize={8}
                emptyLabel="Nenhuma solicitação."
              />
            </div>
          </section>
        )}

        <section className="overflow-hidden rounded-sm border border-surface-container-high bg-white shadow-sm">
          <div className="border-b border-surface-container-high bg-gradient-to-r from-slate-600 to-slate-700 px-4 py-3 sm:px-5">
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-white">Usuários (profiles)</h2>
          </div>
          <div className="p-4 sm:p-5">
            <EntityDataTable
              data={profiles}
              columns={profileColumns}
              getRowId={(r) => r.id}
              searchPlaceholder="Buscar usuários…"
              pageSize={10}
              emptyLabel="Nenhum usuário."
            />
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
