import { Fragment, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AppSideover } from '../components/AppSideover';
import { DashboardMetricCard } from '../components/DashboardMetricCard';
import { useAuth } from '../context/AuthContext';
import { fetchPartnerOrgSignups } from '../lib/governanceQueries';
import { onlyDigits } from '../lib/opencnpj';

function formatCnpjMask(d) {
  const x = onlyDigits(String(d || ''));
  if (x.length !== 14) return d ? String(d) : '—';
  return `${x.slice(0, 2)}.${x.slice(2, 5)}.${x.slice(5, 8)}/${x.slice(8, 12)}-${x.slice(12, 14)}`;
}

function orgNameFromRow(row) {
  const dados = row?.dados_formulario;
  if (!dados || typeof dados !== 'object') return '—';
  const n = dados.nome_empresa ?? dados.nome;
  return n != null && String(n).trim() ? String(n).trim() : '—';
}

function stripSensitiveDados(dados) {
  if (!dados || typeof dados !== 'object') return {};
  const { senha, confirmar_senha, ...rest } = dados;
  return rest;
}

function statusPillClass(s) {
  if (s === 'pendente') return 'bg-amber-50 text-amber-950 border border-amber-200';
  if (s === 'aprovado') return 'bg-emerald-50 text-emerald-900 border border-emerald-200';
  if (s === 'rejeitado') return 'bg-slate-100 text-slate-800 border border-slate-200';
  if (s === 'processado') return 'bg-sky-50 text-sky-900 border border-sky-200';
  return 'bg-slate-50 text-slate-700 border border-slate-200';
}

export function AdminOrganizationsPage() {
  const { supabase, session } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [panel, setPanel] = useState({ open: false, row: null });
  const [busyId, setBusyId] = useState(null);
  const [actionErr, setActionErr] = useState(null);

  const orgQuery = useQuery({
    queryKey: ['governance', 'partner-org-signups'],
    queryFn: () => fetchPartnerOrgSignups(supabase),
    enabled: Boolean(supabase),
  });

  const rows = orgQuery.data ?? [];
  const loading = orgQuery.isPending && orgQuery.data === undefined;
  const err = orgQuery.isError ? String(orgQuery.error?.message ?? orgQuery.error) : null;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const blob = JSON.stringify(r).toLowerCase();
      return blob.includes(q);
    });
  }, [rows, search]);

  const metrics = useMemo(() => {
    const pendente = rows.filter((r) => r.status === 'pendente').length;
    const aprovado = rows.filter((r) => r.status === 'aprovado').length;
    const rejeitado = rows.filter((r) => r.status === 'rejeitado').length;
    const processado = rows.filter((r) => r.status === 'processado').length;
    return { total: rows.length, pendente, aprovado, rejeitado, processado };
  }, [rows]);

  async function setSignupStatus(id, status) {
    if (!supabase || !session?.user?.id) return;
    setBusyId(id);
    setActionErr(null);
    try {
      const { error } = await supabase.from('hub_partner_org_signups').update({ status }).eq('id', id);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['governance', 'partner-org-signups'] });
      setPanel((p) =>
        p.open && p.row?.id === id ? { ...p, row: { ...p.row, status } } : p
      );
    } catch (e) {
      setActionErr(e?.message || 'Erro ao atualizar');
    } finally {
      setBusyId(null);
    }
  }

  const active = panel.row;

  return (
    <div className="w-full min-w-0 space-y-6">
      {(err || actionErr) && (
        <p className="text-sm font-semibold text-red-600" role="alert">
          {err || actionErr}
        </p>
      )}

      <div className="flex items-center gap-3">
        <div className="h-6 w-1.5 bg-tertiary" aria-hidden />
        <h2 className="text-xs font-black uppercase tracking-[0.2em] text-primary">Resumo — cadastros de organização</h2>
        {orgQuery.isFetching && !loading ? (
          <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/70">A atualizar…</span>
        ) : null}
      </div>
      {loading ? <p className="text-sm text-on-surface-variant">Carregando dados de organizações…</p> : null}

      {!loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <DashboardMetricCard
            label="Total de solicitações"
            value={metrics.total}
            surface="whiteMedia"
            footer={
              <>
                <span className="material-symbols-outlined text-sm">domain</span>
                hub_partner_org_signups
              </>
            }
          />
          <DashboardMetricCard
            label="Pendentes"
            value={metrics.pendente}
            surface="whiteAccentAmber"
            valueClassName="text-3xl sm:text-4xl font-black tabular-nums text-amber-950 mb-2"
            footer={
              <>
                <span className="material-symbols-outlined text-sm text-amber-800">pending_actions</span>
                Aguardando decisão
              </>
            }
          />
          <DashboardMetricCard
            label="Aprovados"
            value={metrics.aprovado}
            surface="whiteMedia"
            valueClassName="text-3xl sm:text-4xl font-black text-tertiary tracking-tighter tabular-nums mb-2"
            footer={
              <>
                <span className="material-symbols-outlined text-sm">check_circle</span>
                Acesso autorizado
              </>
            }
          />
          <DashboardMetricCard
            label="Rejeitados"
            value={metrics.rejeitado}
            surface="whiteMedia"
            footer={
              <>
                <span className="material-symbols-outlined text-sm">block</span>
                Processados: {metrics.processado}
              </>
            }
          />
        </div>
      ) : null}

      <section className="overflow-hidden border border-surface-container-high bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-[#f8fafc] px-4 py-3 sm:px-5">
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-700">Organizações (parceiros)</h2>
          <p className="mt-1 text-xs text-slate-500">
            Linhas expansíveis com resumo; use o painel lateral para ver JSON completo e aprovar ou rejeitar.
          </p>
        </div>

        {!loading ? (
          <>
            <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <label className="sr-only" htmlFor="org-search">
                Buscar organizações
              </label>
              <input
                id="org-search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome, e-mail, CNPJ, status…"
                className="w-full max-w-lg rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-primary shadow-sm placeholder:text-on-surface-variant/60"
              />
              <p className="shrink-0 text-[10px] font-black uppercase tracking-wider text-on-surface-variant tabular-nums">
                {filtered.length} registro(s)
              </p>
            </div>

            <div className="hub-table-scrollbar max-h-[min(60vh,640px)] overflow-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="sticky top-0 z-10 border-b border-slate-200 bg-[#f8fafc] text-[10px] font-black uppercase tracking-wider text-slate-600">
                  <tr>
                    <th className="w-10 px-2 py-3 sm:px-3" />
                    <th className="min-w-[12rem] px-3 py-3 sm:px-4">Organização</th>
                    <th className="hidden px-3 py-3 sm:table-cell sm:px-4">CNPJ</th>
                    <th className="min-w-[10rem] px-3 py-3 sm:px-4">E-mail</th>
                    <th className="px-3 py-3 sm:px-4">Status</th>
                    <th className="hidden px-3 py-3 lg:table-cell lg:px-4">Fonte CNPJ</th>
                    <th className="hidden px-3 py-3 md:table-cell md:px-4">Quando</th>
                    <th className="px-3 py-3 text-right sm:px-4">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-5 py-12 text-center text-sm text-on-surface-variant">
                        Nenhum cadastro de organização.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((row, i) => {
                  const open = expandedId === row.id;
                  const dados = stripSensitiveDados(row.dados_formulario);
                  const snap = row.cnpja_snapshot && typeof row.cnpja_snapshot === 'object' ? row.cnpja_snapshot : null;
                  const mainAct = snap?.mainActivity?.text ?? null;
                  return (
                    <Fragment key={row.id}>
                      <tr className={i % 2 === 1 ? 'bg-slate-50/70' : 'bg-white'}>
                        <td className="align-middle px-2 py-3 sm:px-3">
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-200 bg-white text-primary hover:bg-slate-50"
                            aria-expanded={open}
                            onClick={() => setExpandedId(open ? null : row.id)}
                            title={open ? 'Ocultar detalhes' : 'Ver detalhes'}
                          >
                            <span className="material-symbols-outlined text-[20px]">{open ? 'expand_less' : 'expand_more'}</span>
                          </button>
                        </td>
                        <td className="align-top px-3 py-3 sm:px-4">
                          <div className="font-bold text-primary leading-snug">{orgNameFromRow(row)}</div>
                          <div className="mt-0.5 font-mono text-[11px] text-slate-500">ID: {String(row.id).slice(0, 8)}…</div>
                        </td>
                        <td className="hidden align-middle px-3 py-3 font-mono text-xs sm:table-cell sm:px-4">
                          {formatCnpjMask(row.cnpj)}
                        </td>
                        <td className="align-middle px-3 py-3 font-mono text-xs sm:px-4 break-all">{row.email || '—'}</td>
                        <td className="align-middle px-3 py-3 sm:px-4">
                          <span className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[9px] font-black uppercase tracking-wide ${statusPillClass(row.status)}`}>
                            {row.status === 'aprovado' ? (
                              <span className="h-1.5 w-1.5 rounded-sm bg-emerald-500" aria-hidden />
                            ) : null}
                            {row.status}
                          </span>
                        </td>
                        <td className="hidden align-middle px-3 py-3 text-xs text-on-surface-variant lg:table-cell lg:px-4">
                          {row.consulta_fonte || '—'}
                        </td>
                        <td className="hidden align-middle whitespace-nowrap px-3 py-3 text-xs text-on-surface-variant md:table-cell md:px-4">
                          {row.criado_em ? new Date(row.criado_em).toLocaleString('pt-BR') : '—'}
                        </td>
                        <td className="align-middle px-3 py-3 text-right sm:px-4">
                          <button
                            type="button"
                            className="text-[10px] font-black uppercase tracking-widest text-primary underline-offset-2 hover:underline"
                            onClick={() => setPanel({ open: true, row })}
                          >
                            Painel
                          </button>
                        </td>
                      </tr>
                      {open ? (
                        <tr key={`${row.id}-detail`} className="bg-slate-50/90">
                          <td colSpan={8} className="border-t border-slate-200 px-4 py-4 sm:px-6">
                            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-8">
                              <div className="min-w-0 rounded-sm border border-slate-200 bg-white p-4 shadow-sm">
                                <h3 className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-600">Resumo dinâmico</h3>
                                <dl className="mt-3 space-y-2 text-sm">
                                  <div className="flex flex-wrap gap-x-2">
                                    <dt className="text-on-surface-variant">Cidade / UF:</dt>
                                    <dd className="font-semibold text-primary">
                                      {[dados.cidade, dados.uf].filter(Boolean).join(' / ') || '—'}
                                    </dd>
                                  </div>
                                  <div className="flex flex-wrap gap-x-2">
                                    <dt className="text-on-surface-variant">Template:</dt>
                                    <dd className="font-semibold text-primary">{row.template_id || '—'}</dd>
                                  </div>
                                  <div className="flex flex-wrap gap-x-2">
                                    <dt className="text-on-surface-variant">Tipo parceiro:</dt>
                                    <dd className="font-semibold text-primary">{row.partner_kind || '—'}</dd>
                                  </div>
                                  {mainAct ? (
                                    <div className="pt-1">
                                      <dt className="text-[10px] font-black uppercase text-on-surface-variant">Atividade (snapshot)</dt>
                                      <dd className="mt-0.5 text-sm leading-snug text-primary">{String(mainAct)}</dd>
                                    </div>
                                  ) : null}
                                </dl>
                              </div>
                              <div className="min-w-0 rounded-sm border border-slate-200 bg-white p-4 shadow-sm">
                                <h3 className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-600">Dados enviados (sem senha)</h3>
                                <ul className="mt-3 list-inside list-disc space-y-1.5 text-sm text-primary">
                                  <li>
                                    <span className="text-on-surface-variant">E-mail comercial:</span>{' '}
                                    <span className="font-medium">{dados.email || row.email || '—'}</span>
                                  </li>
                                  <li>
                                    <span className="text-on-surface-variant">Telefone:</span>{' '}
                                    <span className="font-medium">{dados.telefone || '—'}</span>
                                  </li>
                                  <li>
                                    <span className="text-on-surface-variant">Logradouro:</span>{' '}
                                    <span className="font-medium">
                                      {[dados.logradouro, dados.numero, dados.bairro].filter(Boolean).join(', ') || '—'}
                                    </span>
                                  </li>
                                </ul>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </section>

      <AppSideover
        key={active?.id ?? 'org'}
        open={panel.open && !!active}
        onClose={() => setPanel({ open: false, row: null })}
        title="Cadastro de organização"
        subtitle={active?.email}
        variant="operational"
        bodyClassName="p-4 sm:p-5"
        tabItems={
          active
            ? [
                {
                  id: 'dados',
                  label: 'Dados',
                  content: (
                    <div className="space-y-4 text-sm">
                      <dl className="space-y-2">
                        <div>
                          <dt className="text-[10px] font-black uppercase text-on-surface-variant">Status</dt>
                          <dd className="mt-0.5">
                            <span className={`inline-flex rounded px-2 py-0.5 text-[10px] font-black uppercase ${statusPillClass(active.status)}`}>
                              {active.status}
                            </span>
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[10px] font-black uppercase text-on-surface-variant">CNPJ</dt>
                          <dd className="mt-0.5 font-mono text-xs">{formatCnpjMask(active.cnpj)}</dd>
                        </div>
                        <div>
                          <dt className="text-[10px] font-black uppercase text-on-surface-variant">Criado em</dt>
                          <dd className="mt-0.5 font-mono text-xs">
                            {active.criado_em ? new Date(active.criado_em).toLocaleString('pt-BR') : '—'}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[10px] font-black uppercase text-on-surface-variant">Consulta</dt>
                          <dd className="mt-0.5">{active.consulta_fonte || '—'}</dd>
                        </div>
                        <div>
                          <dt className="text-[10px] font-black uppercase text-on-surface-variant">Template / tipo</dt>
                          <dd className="mt-0.5">
                            {active.template_id || '—'} · {active.partner_kind || '—'}
                          </dd>
                        </div>
                      </dl>
                      <div>
                        <h4 className="text-[10px] font-black uppercase text-on-surface-variant">dados_formulario (JSON)</h4>
                        <pre className="mt-2 max-h-48 overflow-auto rounded border border-slate-200 bg-slate-50 p-3 font-mono text-[11px] leading-relaxed text-primary">
                          {JSON.stringify(stripSensitiveDados(active.dados_formulario), null, 2)}
                        </pre>
                      </div>
                      {active.cnpja_snapshot ? (
                        <div>
                          <h4 className="text-[10px] font-black uppercase text-on-surface-variant">cnpja_snapshot</h4>
                          <pre className="mt-2 max-h-48 overflow-auto rounded border border-slate-200 bg-slate-50 p-3 font-mono text-[11px] leading-relaxed text-primary">
                            {JSON.stringify(active.cnpja_snapshot, null, 2)}
                          </pre>
                        </div>
                      ) : null}
                    </div>
                  ),
                },
                {
                  id: 'decisao',
                  label: 'Decisão',
                  content: (
                    <div className="space-y-4">
                      {active.status === 'pendente' ? (
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <button
                            type="button"
                            disabled={busyId === active.id}
                            onClick={() => setSignupStatus(active.id, 'aprovado')}
                            className="bg-tertiary px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-primary hover:bg-tertiary/90 disabled:opacity-50"
                          >
                            Aprovar acesso
                          </button>
                          <button
                            type="button"
                            disabled={busyId === active.id}
                            onClick={() => setSignupStatus(active.id, 'rejeitado')}
                            className="border border-primary px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary hover:text-white disabled:opacity-50"
                          >
                            Rejeitar
                          </button>
                        </div>
                      ) : (
                        <p className="text-sm text-on-surface-variant">
                          Este cadastro já foi tratado (status: <strong>{active.status}</strong>).
                        </p>
                      )}
                    </div>
                  ),
                },
              ]
            : []
        }
      />
    </div>
  );
}
