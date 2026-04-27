import { Fragment, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AppSideover } from '../components/AppSideover';
import { HubButton } from '../components/HubButton';
import { HomologacaoChatThread } from '../components/HomologacaoChatThread';
import { HomologacaoDocumentosPanel } from '../components/HomologacaoDocumentosPanel';
import { HomologacaoWorkflowKanban } from '../components/HomologacaoWorkflowKanban';
import { DashboardMetricCard } from '../components/DashboardMetricCard';
import { useAuth } from '../context/AuthContext';
import { fetchPartnerOrgSignups } from '../lib/governanceQueries';
import { rpcApprovePartnerOrgSignup } from '../lib/hubPartnerOrgGovernance';
import {
  buildCnpjSnapshotPresentation,
  buildFormularioGroupedSections,
  describeProvisioningCodeHint,
  hubMarketLegendItems,
  labelPartnerKind,
  normalizeHubCnpjSnapshotInput,
  shortTemplateRef,
} from '../lib/partnerOrgGovernanceDisplay';
import { onlyDigits } from '../lib/opencnpj';

/** @param {{ icon: string, title: string, children: import('react').ReactNode, className?: string }} p */
function GovernanceReportCard({ icon, title, children, className = '' }) {
  return (
    <div
      className={`rounded-2xl border border-slate-200/85 bg-gradient-to-b from-white to-slate-50/35 p-5 shadow-sm ${className}`}
    >
      <div className="flex items-center gap-3 border-b border-slate-100/90 pb-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-tertiary/12 text-tertiary" aria-hidden>
          <span className="material-symbols-outlined text-[24px] leading-none">{icon}</span>
        </span>
        <h4 className="text-xs font-black uppercase tracking-[0.16em] text-primary">{title}</h4>
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

/** @param {{ section: { id: string, title: string, icon: string, rows: Array<{ label: string, value: string }> } }} p */
function GovernanceGroupedCard({ section }) {
  if (!section.rows.length) return null;
  return (
    <GovernanceReportCard icon={section.icon} title={section.title}>
      <dl className="grid grid-cols-1 gap-x-10 gap-y-3 sm:grid-cols-2">
        {section.rows.map((r) => (
          <div key={`${section.id}-${r.label}`} className="min-w-0">
            <dt className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">{r.label}</dt>
            <dd className="mt-0.5 text-sm font-semibold leading-snug text-primary break-words">{r.value}</dd>
          </div>
        ))}
      </dl>
    </GovernanceReportCard>
  );
}

/** @param {{ row: Record<string, unknown> }} p */
function OrgConsultaReportView({ row }) {
  const rawSnap = row.cnpja_snapshot;
  const { snapshot } = normalizeHubCnpjSnapshotInput(rawSnap);
  const snapEmpty =
    rawSnap == null ||
    (typeof rawSnap === 'object' && rawSnap !== null && Object.keys(rawSnap).length === 0);
  const pres = buildCnpjSnapshotPresentation(rawSnap);
  const hasBody =
    !snapEmpty &&
    snapshot &&
    (pres.sections.length > 0 || pres.members.length > 0 || (pres.suframaLines && pres.suframaLines.length > 0));

  if (!hasBody) {
    return (
      <article className="space-y-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-sm leading-relaxed">
        <h3 className="text-base font-black text-primary">Relatório da consulta CNPJ</h3>
        <hr className="border-slate-200" />
        <p className="text-on-surface-variant">
          <strong className="text-primary">Não há dados de consulta guardados neste pedido.</strong> Situações comuns:
        </p>
        <ul className="list-disc space-y-1.5 pl-5 text-on-surface-variant">
          <li>cadastro anterior à gravação do snapshot na base;</li>
          <li>indisponibilidade da API no momento do envio;</li>
          <li>CNPJ não consultado na sessão antes de submeter o formulário.</li>
        </ul>
        <p className="text-on-surface-variant">
          Use a aba <strong className="text-primary">Formulário</strong> para os dados declarados pelo parceiro.
        </p>
      </article>
    );
  }

  return (
    <article className="space-y-5 text-sm leading-relaxed text-primary">
      <header className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-tertiary">Relatório · consulta CNPJ</p>
        <h3 className="mt-2 text-xl font-black tracking-tight text-primary">{pres.title}</h3>
      </header>

      {pres.sections.map((sec) => (
        <section key={sec.id} className="rounded-2xl border border-slate-200/85 bg-white p-5 shadow-sm">
          <h4 className="flex items-center gap-2 border-b border-slate-100 pb-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-600">
            <span className="material-symbols-outlined text-[20px] text-tertiary" aria-hidden>
              segment
            </span>
            {sec.title}
          </h4>
          <dl className="mt-4 space-y-4">
            {sec.fields.map((f) => (
              <div key={`${sec.id}-${f.label}`} className="border-l-2 border-tertiary/25 pl-4">
                <dt className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">{f.label}</dt>
                <dd className="mt-1 text-sm font-medium text-primary">{f.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}

      {pres.members.length > 0 ? (
        <section className="rounded-2xl border border-slate-200/85 bg-white p-5 shadow-sm">
          <h4 className="border-b border-slate-100 pb-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-600">
            Quadro societário e administradores
          </h4>
          <ol className="mt-4 list-decimal space-y-2.5 pl-5 marker:font-semibold text-primary">
            {pres.members.map((line, i) => (
              <li key={i} className="pl-1">
                {line}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {pres.suframaLines && pres.suframaLines.length > 0 ? (
        <section className="rounded-2xl border border-amber-200/60 bg-gradient-to-br from-amber-50/50 to-white p-5">
          <h4 className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-950">SUFRAMA — detalhe</h4>
          <ul className="mt-3 space-y-1.5 text-sm text-primary">
            {pres.suframaLines.map((line, i) => (
              <li
                key={i}
                className={line.startsWith('-') ? 'border-l border-amber-300/60 pl-3 text-on-surface-variant' : 'font-semibold'}
              >
                {line}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}

function HubCodeLegend({ className = '' }) {
  const items = hubMarketLegendItems();
  const y = new Date().getFullYear();
  return (
    <div
      className={`rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50/90 via-white to-slate-50/50 p-4 shadow-inner ${className}`}
    >
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">Padrão de códigos (CRM)</p>
      <p className="mt-2 text-[11px] leading-relaxed text-on-surface-variant">
        <strong className="text-primary">NEG</strong> e <strong className="text-primary">OPP</strong> identificam negócios e oportunidades; são imutáveis após criação. Na homologação, a{' '}
        <strong>organização</strong> recebe <strong className="text-primary">HUB-OPP-[mercado]-data UTC-sufixo aleatório</strong> (par com o padrão OPP), com os mesmos códigos de mercado.
      </p>
      <p className="mt-3 border-t border-slate-200/80 pt-3 text-[11px] leading-relaxed text-on-surface-variant">
        No ciclo de vida do CRM, o <strong className="text-primary">negócio</strong> (<span className="font-mono">NEG-*</span>) agrega a demanda; as{' '}
        <strong className="text-primary">oportunidades</strong> (<span className="font-mono">OPP-*</span>) ligam receita e etapas. A{' '}
        <strong className="text-primary">organização</strong> homologada (<span className="font-mono">HUB-OPP-*</span>) participa desses fluxos como tenant.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {items.map((m) => (
          <div
            key={m.code}
            className="min-w-[8.5rem] rounded-lg bg-gradient-to-br from-primary to-[#1a3550] px-3 py-2 text-white shadow-md"
            title={m.hint}
          >
            <p className="font-mono text-[10px] font-bold tracking-tight">
              NEG-{m.code}-{y}-001
            </p>
            <p className="text-[9px] font-semibold text-white/90">{m.label}</p>
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.map((m) => (
          <div
            key={`opp-${m.code}`}
            className="min-w-[8.5rem] rounded-lg bg-gradient-to-br from-amber-600 to-orange-700 px-3 py-2 text-white shadow-md"
            title={m.hint}
          >
            <p className="font-mono text-[10px] font-bold tracking-tight">
              OPP-{m.code}-{y}-001
            </p>
            <p className="text-[9px] font-semibold text-white/90">{m.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/** @param {{ row: Record<string, unknown> }} p */
function OrgExpandedTabs({ row }) {
  const [tab, setTab] = useState('formulario');
  const dados = stripSensitiveDados(row.dados_formulario);
  const formGroups = buildFormularioGroupedSections(dados);
  const hint = describeProvisioningCodeHint('', row.partner_kind);
  const codigoGravado = row.codigo_rastreio != null && String(row.codigo_rastreio).trim() !== '' ? String(row.codigo_rastreio) : null;

  const tabs = [
    { id: 'formulario', label: 'Formulário' },
    { id: 'consulta', label: 'Consulta CNPJ' },
    { id: 'contexto', label: 'Contexto' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-0 overflow-x-auto border-b border-slate-200/80 bg-white/60 no-scrollbar">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`shrink-0 border-b-[3px] px-3 py-2.5 text-[10px] font-black uppercase tracking-widest transition-colors ${
              tab === t.id ? 'border-tertiary text-primary' : 'border-transparent text-on-surface-variant hover:text-primary'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'formulario' ? (
        <div className="space-y-4">
          <p className="text-[11px] leading-relaxed text-on-surface-variant">
            Relatório dos dados declarados no formulário público, agrupados por tema.
          </p>
          {formGroups.length === 0 ? (
            <p className="text-sm text-on-surface-variant">Sem campos de formulário neste pedido.</p>
          ) : (
            formGroups.map((g) => <GovernanceGroupedCard key={g.id} section={g} />)
          )}
        </div>
      ) : null}

      {tab === 'consulta' ? <OrgConsultaReportView row={row} /> : null}

      {tab === 'contexto' ? (
        <article className="space-y-5 text-sm leading-relaxed">
          <GovernanceReportCard icon="receipt_long" title="Relatório de contexto do pedido">
            <dl className="grid grid-cols-1 gap-x-10 gap-y-3 sm:grid-cols-2">
              <div>
                <dt className="text-[10px] font-bold uppercase text-on-surface-variant">ID do pedido</dt>
                <dd className="mt-0.5 font-mono text-xs text-primary">{String(row.id)}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase text-on-surface-variant">E-mail</dt>
                <dd className="mt-0.5 text-primary">{String(row.email || '—')}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase text-on-surface-variant">Recebido em</dt>
                <dd className="mt-0.5 text-primary">{row.criado_em ? new Date(row.criado_em).toLocaleString('pt-BR') : '—'}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase text-on-surface-variant">Formulário</dt>
                <dd className="mt-0.5 text-primary">{shortTemplateRef(row.template_id)}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase text-on-surface-variant">Tipo de parceiro</dt>
                <dd className="mt-0.5 text-primary">{labelPartnerKind(row.partner_kind)}</dd>
              </div>
              {codigoGravado ? (
                <div className="sm:col-span-2">
                  <dt className="text-[10px] font-bold uppercase text-on-surface-variant">Código HUB-OPP atribuído</dt>
                  <dd className="mt-0.5 font-mono text-sm font-bold text-tertiary">{codigoGravado}</dd>
                </div>
              ) : null}
            </dl>
          </GovernanceReportCard>
          <GovernanceReportCard icon="tag" title="Código da organização (padronização HUB)" className="border-tertiary/20 bg-tertiary/[0.06]">
            {codigoGravado ? (
              <p className="text-primary">
                Este pedido já foi provisionado. Código interno da organização:{' '}
                <strong className="font-mono text-tertiary">{codigoGravado}</strong>
              </p>
            ) : (
              <>
                <p className="text-primary">
                  Prefixo esperado pelo tipo de parceiro: <strong className="font-mono">{hint.prefix}</strong> · exemplo:{' '}
                  <strong className="font-mono">{hint.exemploOrg}</strong>
                </p>
                <p className="mt-2 text-on-surface-variant">
                  O código <span className="font-mono">HUB-OPP-*</span> é reservado ao enviar o formulário; após provisionar, mantém-se como identificador da
                  organização.
                </p>
              </>
            )}
          </GovernanceReportCard>
          <HubCodeLegend />
        </article>
      ) : null}
    </div>
  );
}

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
  const [busyApprove, setBusyApprove] = useState(false);
  const [actionErr, setActionErr] = useState(null);
  const [approveBanner, setApproveBanner] = useState(/** @type {{ link: string, codigo: string } | null} */ (null));

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
    const provisionados = processado + aprovado;
    return { total: rows.length, pendente, aprovado, rejeitado, processado, provisionados };
  }, [rows]);

  const active = panel.row;

  useEffect(() => {
    if (!active) return;
    setApproveBanner(null);
  }, [active?.id]);

  async function refreshSignupRow(id) {
    if (!supabase || !id) return;
    await queryClient.invalidateQueries({ queryKey: ['governance', 'partner-org-signups'] });
    const { data, error } = await supabase.from('hub_partner_org_signups').select('*').eq('id', id).maybeSingle();
    if (error || !data) return;
    setPanel((p) => (p.open && p.row?.id === id ? { ...p, row: data } : p));
  }

  async function setSignupStatus(id, status) {
    if (!supabase || !session?.user?.id) return;
    setBusyId(id);
    setActionErr(null);
    try {
      const { error } = await supabase.from('hub_partner_org_signups').update({ status }).eq('id', id);
      if (error) throw error;
      await refreshSignupRow(id);
    } catch (e) {
      setActionErr(e?.message || 'Erro ao atualizar');
    } finally {
      setBusyId(null);
    }
  }

  async function runProvisionSignup(row) {
    if (!supabase || !row?.id) return;
    setBusyApprove(true);
    setActionErr(null);
    setApproveBanner(null);
    try {
      const r = await rpcApprovePartnerOrgSignup(supabase, {
        signupId: row.id,
        moduloSlugs: [],
        /** Sempre o tipo do template (`partner_kind` no pedido); a RPC usa coalesce com este campo. */
        tipoOrganizacao: null,
      });
      if (!r.ok) {
        setActionErr(r.error || 'RPC falhou');
        return;
      }
      const raw = r.raw && typeof r.raw === 'object' ? r.raw : {};
      if (raw.ok === false) {
        setActionErr(
          [raw.error, raw.detail].filter(Boolean).join(': ') || 'Aprovação rejeitada pela base de dados'
        );
        return;
      }
      const token = raw.invite_token != null ? String(raw.invite_token) : '';
      const codigo = raw.codigo_rastreio != null ? String(raw.codigo_rastreio) : '';
      const origin = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : '';
      const link = token ? `${origin}#/convite/organizacao?token=${encodeURIComponent(token)}` : '';
      setApproveBanner(link ? { link, codigo } : null);
      await queryClient.invalidateQueries({ queryKey: ['governance', 'partner-org-signups'] });
      void queryClient.invalidateQueries({ queryKey: ['homologacaoChat'] });
      setPanel((p) =>
        p.open && p.row?.id === row.id
          ? {
              ...p,
              row: {
                ...p.row,
                status: 'processado',
                organizacao_id: raw.organizacao_id,
                codigo_rastreio: codigo || p.row.codigo_rastreio,
                workflow_etapa: null,
              },
            }
          : p
      );
    } catch (e) {
      setActionErr(e?.message || 'Erro ao provisionar');
    } finally {
      setBusyApprove(false);
    }
  }

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
                Pedidos de cadastro
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
            label="Provisionados"
            value={metrics.provisionados}
            surface="whiteMedia"
            valueClassName="text-3xl sm:text-4xl font-black text-tertiary tracking-tighter tabular-nums mb-2"
            footer={
              <>
                <span className="material-symbols-outlined text-sm">check_circle</span>
                Org + convite (processado ou legado aprovado)
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
            Expanda a linha para mini-abas com formulário, consulta CNPJ e contexto. Use o painel para homologar (módulos, tipo e convite).
          </p>
        </div>

        {!loading ? (
          <>
            <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <label className="sr-only" htmlFor="org-search">
                Pesquisar organizações
              </label>
              <input
                id="org-search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Pesquisar por nome, e-mail, CNPJ, status…"
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
                    <th className="hidden px-3 py-3 md:table-cell md:px-4">Quando</th>
                    <th className="px-3 py-3 text-right sm:px-4">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-12 text-center text-sm text-on-surface-variant">
                        Nenhum cadastro de organização.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((row, i) => {
                  const open = expandedId === row.id;
                  return (
                    <Fragment key={row.id}>
                      <tr className={i % 2 === 1 ? 'bg-slate-50/70' : 'bg-white'}>
                        <td className="align-middle px-2 py-3 sm:px-3">
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-none border border-sky-300 bg-sky-50 text-primary hover:bg-sky-100"
                            aria-expanded={open}
                            onClick={() => setExpandedId(open ? null : row.id)}
                            title={open ? 'Ocultar detalhes' : 'Ver detalhes'}
                          >
                            <span className="material-symbols-outlined text-[20px]" aria-hidden>
                              {open ? 'expand_less' : 'expand_more'}
                            </span>
                          </button>
                        </td>
                        <td className="align-top px-3 py-3 sm:px-4">
                          <div className="font-bold text-primary leading-snug">{orgNameFromRow(row)}</div>
                          {row.codigo_rastreio ? (
                            <div className="mt-0.5 font-mono text-[11px] font-semibold text-tertiary">{String(row.codigo_rastreio)}</div>
                          ) : null}
                          <div className="mt-0.5 font-mono text-[10px] text-slate-400">
                            Pedido · {String(row.id).slice(0, 8)}…
                          </div>
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
                        <td className="hidden align-middle whitespace-nowrap px-3 py-3 text-xs text-on-surface-variant md:table-cell md:px-4">
                          {row.criado_em ? new Date(row.criado_em).toLocaleString('pt-BR') : '—'}
                        </td>
                        <td className="align-middle px-3 py-3 text-right sm:px-4">
                          <button
                            type="button"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-none border border-sky-300 bg-sky-50 text-primary transition hover:bg-sky-100"
                            onClick={() => setPanel({ open: true, row })}
                            title="Abrir painel de homologação"
                            aria-label="Abrir painel de homologação"
                          >
                            <span className="material-symbols-outlined text-[22px] leading-none" aria-hidden>
                              dock_to_right
                            </span>
                          </button>
                        </td>
                      </tr>
                      {open ? (
                        <tr key={`${row.id}-detail`} className="bg-slate-50/90">
                          <td colSpan={7} className="border-t border-slate-200 px-4 py-4 sm:px-6">
                            <OrgExpandedTabs key={row.id} row={row} />
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
        eyebrow="Homologação · Organizações"
        title="Cadastro de organização"
        subtitle={active?.email}
        variant="operational"
        bodyClassName="p-4 sm:p-5 bg-slate-50"
        tabItems={
          active
            ? [
                {
                  id: 'consulta',
                  label: 'Consulta CNPJ',
                  content: <OrgConsultaReportView row={active} />,
                },
                {
                  id: 'dados',
                  label: 'Dados do pedido',
                  content: (
                    <div className="space-y-4">
                      <GovernanceReportCard icon="assignment_ind" title="Registo do pedido">
                        <dl className="grid grid-cols-1 gap-x-10 gap-y-3 sm:grid-cols-2">
                          <div>
                            <dt className="text-[10px] font-bold uppercase text-on-surface-variant">Status</dt>
                            <dd className="mt-0.5 text-primary">{String(active.status || '—')}</dd>
                          </div>
                          <div>
                            <dt className="text-[10px] font-bold uppercase text-on-surface-variant">Etapa (Kanban)</dt>
                            <dd className="mt-0.5 text-primary">
                              {active.workflow_etapa ? String(active.workflow_etapa) : '—'}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-[10px] font-bold uppercase text-on-surface-variant">Organização na base</dt>
                            <dd className="mt-0.5 text-primary" title={active.organizacao_id ? String(active.organizacao_id) : undefined}>
                              {active.organizacao_id
                                ? `Ref. interna · …${String(active.organizacao_id).slice(-8)}`
                                : 'Ainda não provisionada'}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-[10px] font-bold uppercase text-on-surface-variant">CNPJ / documento</dt>
                            <dd className="mt-0.5 font-mono text-xs">{formatCnpjMask(active.cnpj)}</dd>
                          </div>
                          <div>
                            <dt className="text-[10px] font-bold uppercase text-on-surface-variant">Pedido recebido</dt>
                            <dd className="mt-0.5 text-primary">
                              {active.criado_em ? new Date(active.criado_em).toLocaleString('pt-BR') : '—'}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-[10px] font-bold uppercase text-on-surface-variant">Formulário</dt>
                            <dd className="mt-0.5 text-primary">{shortTemplateRef(active.template_id)}</dd>
                          </div>
                          <div>
                            <dt className="text-[10px] font-bold uppercase text-on-surface-variant">Tipo de parceiro</dt>
                            <dd className="mt-0.5 text-primary">{labelPartnerKind(active.partner_kind)}</dd>
                          </div>
                          {active.codigo_rastreio ? (
                            <div className="sm:col-span-2">
                              <dt className="text-[10px] font-bold uppercase text-on-surface-variant">Código HUB-OPP (pedido)</dt>
                              <dd className="mt-0.5 font-mono text-sm font-bold text-tertiary">{String(active.codigo_rastreio)}</dd>
                            </div>
                          ) : null}
                        </dl>
                      </GovernanceReportCard>
                      <div className="space-y-3">
                        <p className="text-[11px] text-on-surface-variant">Campos do formulário, agrupados.</p>
                        {buildFormularioGroupedSections(stripSensitiveDados(active.dados_formulario)).map((g) => (
                          <GovernanceGroupedCard key={g.id} section={g} />
                        ))}
                      </div>
                    </div>
                  ),
                },
                {
                  id: 'chat',
                  label: 'Chat',
                  content: (
                    <div className="space-y-4">
                      <div className="rounded-2xl border border-slate-200/85 bg-gradient-to-b from-white to-slate-50/35 p-4 shadow-sm">
                        <div className="flex items-center gap-2 border-b border-slate-100/90 pb-2">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-tertiary/12 text-tertiary" aria-hidden>
                            <span className="material-symbols-outlined text-[20px] leading-none">forum</span>
                          </span>
                          <div className="min-w-0">
                            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-primary">Chat de homologação</p>
                            <p className="mt-0.5 text-xs text-on-surface-variant">
                              Pedido{' '}
                              <span className="font-mono text-[11px] text-primary" title={String(active.id)}>
                                {String(active.id).slice(0, 8)}…
                              </span>
                              {active.codigo_rastreio ? (
                                <>
                                  {' · '}
                                  <span className="font-mono font-semibold text-tertiary">{String(active.codigo_rastreio)}</span>
                                </>
                              ) : null}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex max-h-[min(65vh,560px)] min-h-[320px] flex-col">
                        <HomologacaoChatThread
                          supabase={supabase}
                          refKey={active.codigo_rastreio ? String(active.codigo_rastreio) : String(active.id)}
                          chatQueryId={String(active.id)}
                          mode="hub"
                          signupId={String(active.id)}
                          readOnly={false}
                          stacked
                          pollMs={8000}
                        />
                      </div>
                    </div>
                  ),
                },
                {
                  id: 'documentos',
                  label: 'Documentos',
                  content: (
                    <div className="space-y-4">
                      <div className="rounded-2xl border border-slate-200/85 bg-gradient-to-b from-white to-slate-50/35 p-4 shadow-sm">
                        <div className="flex items-center gap-2 border-b border-slate-100/90 pb-2">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-tertiary/12 text-tertiary" aria-hidden>
                            <span className="material-symbols-outlined text-[20px] leading-none">folder_special</span>
                          </span>
                          <div className="min-w-0">
                            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-primary">Documentos da homologação</p>
                            <p className="mt-0.5 text-xs text-on-surface-variant">
                              Contratos e anexos enviados no chat; após aprovar o pedido, ficam associados à organização.
                            </p>
                          </div>
                        </div>
                      </div>
                      <HomologacaoDocumentosPanel
                        supabase={supabase}
                        refKey={active.codigo_rastreio ? String(active.codigo_rastreio) : String(active.id)}
                        cacheQueryId={String(active.id)}
                        pollMs={12_000}
                      />
                    </div>
                  ),
                },
                {
                  id: 'decisao',
                  label: 'Decisão',
                  content: (
                    <div className="space-y-4">
                      <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm">
                        <HomologacaoWorkflowKanban
                          supabase={supabase}
                          signupId={String(active.id)}
                          status={active.status}
                          workflowEtapa={active.workflow_etapa}
                          onUpdated={() => void refreshSignupRow(String(active.id))}
                        />
                      </div>
                      <HubCodeLegend />
                      {active.status === 'pendente' ? (
                        <>
                          <div className="rounded-xl border border-tertiary/20 bg-tertiary/5 p-4">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Código HUB-OPP</p>
                            {active.codigo_rastreio ? (
                              <p className="mt-2 font-mono text-lg font-bold text-tertiary">{String(active.codigo_rastreio)}</p>
                            ) : (
                              <p className="mt-2 text-sm text-on-surface-variant">
                                Este pedido ainda não tem código reservado. Ao provisionar, será gerado conforme o tipo de parceiro do template.
                              </p>
                            )}
                            <p className="mt-3 text-sm text-primary">
                              O tipo de cadastro vem do <strong>template de formulário</strong> (ex.: Prestadores de serviço, Imobiliários). O mercado em{' '}
                              <span className="font-mono">HUB-OPP</span> segue esse tipo:{' '}
                              <strong className="font-mono">
                                {describeProvisioningCodeHint('', active.partner_kind).prefix}
                              </strong>{' '}
                              · exemplo:{' '}
                              <strong className="font-mono">
                                {describeProvisioningCodeHint('', active.partner_kind).exemploOrg}
                              </strong>
                            </p>
                            <p className="mt-1 text-[11px] text-on-surface-variant">
                              Os códigos <span className="font-mono">NEG-*</span> e <span className="font-mono">OPP-*</span> pertencem ao CRM; o rastreio da
                              homologação usa <span className="font-mono">HUB-OPP-*</span> (códigos antigos <span className="font-mono">ORG-*</span> podem
                              ainda aparecer em pedidos antigos).
                            </p>
                          </div>
                          <div className="rounded-xl border border-slate-200/90 bg-white px-4 py-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Tipo de parceiro (template)</p>
                            <p className="mt-2 text-sm font-semibold text-primary">
                              {active.partner_kind ? labelPartnerKind(active.partner_kind) : '— não registrado no pedido'}
                            </p>
                            <p className="mt-2 text-[11px] leading-relaxed text-on-surface-variant">
                              Este tipo é definido ao criar o template de cadastro; não precisa ser escolhido de novo aqui. Quem envia o formulário pelo
                              link público será o contacto convidado a aceitar o convite e assumir a administração da organização.
                            </p>
                          </div>
                          <div className="rounded-lg border border-slate-200/90 bg-slate-50/90 p-4">
                            <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Funções e módulos</p>
                            <p className="mt-2 text-sm leading-relaxed text-on-surface">
                              Por agora o provisionamento cria a organização e o convite com o tipo definido no template, sem escolha adicional de módulos
                              aqui.
                            </p>
                          </div>
                          {approveBanner ? (
                            <div className="rounded border border-tertiary/40 bg-tertiary/10 p-3 text-xs">
                              <p className="font-black uppercase tracking-wide text-primary">Organização provisionada</p>
                              <p className="mt-1 font-mono text-[11px] text-primary">Código interno: {approveBanner.codigo}</p>
                              <p className="mt-2 text-[10px] font-bold uppercase text-on-surface-variant">Link único do convite (copiar)</p>
                              <textarea
                                readOnly
                                rows={3}
                                className="mt-1 w-full border border-slate-200 bg-white p-2 font-mono text-[10px] text-primary"
                                value={approveBanner.link}
                              />
                            </div>
                          ) : null}
                          <div className="flex flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:flex-wrap">
                            <HubButton
                              variant="primary"
                              icon="rocket_launch"
                              disabled={busyApprove || busyId === active.id}
                              onClick={() => void runProvisionSignup(active)}
                            >
                              Provisionar org + convite
                            </HubButton>
                            <HubButton
                              variant="secondary"
                              icon="block"
                              disabled={busyId === active.id || busyApprove}
                              onClick={() => setSignupStatus(active.id, 'rejeitado')}
                            >
                              Rejeitar pedido
                            </HubButton>
                          </div>
                        </>
                      ) : (
                        <p className="text-sm text-on-surface-variant">
                          Este cadastro já foi tratado (status: <strong>{active.status}</strong>).
                          {active.organizacao_id ? (
                            <span className="mt-2 block font-mono text-[11px]">
                              Org: {String(active.organizacao_id)}
                            </span>
                          ) : null}
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
