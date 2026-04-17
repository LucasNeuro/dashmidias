import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppShell } from '../../components/AppShell';
import { DataPolicyModal, hasAcceptedDataPolicy } from '../../components/DataPolicyModal';
import { useAuth } from '../../context/AuthContext';
import { money, intFmt } from '../../lib/format';
import { logPanelAccess } from '../../lib/panelAccessLog';
import { getAppNavItems } from '../../lib/appNavItems';
import { isSupabaseConfigured } from '../../lib/supabaseClient';
import { Panel } from './components/Panel';
import { useCampaignsDashboardData } from './hooks/useCampaignsDashboardData';

const TABS = [
  { id: 'overview', label: 'Visão Geral' },
  { id: 'meta', label: 'Meta Ads (FB/IG)' },
  { id: 'google', label: 'Google Ads' },
  { id: 'funnel', label: 'Funil & ROI' },
];

function badgeToneClass(tone) {
  const m = { blue: 'bg-blue-600 text-white', red: 'bg-red-600 text-white', slate: 'bg-slate-700 text-white' };
  return m[tone] || m.slate;
}

function channelPillClass(tone) {
  if (tone === 'blue') return 'bg-blue-50 text-blue-700 border-blue-100';
  if (tone === 'red') return 'bg-red-50 text-red-700 border-red-100';
  return 'bg-slate-50 text-slate-800 border-slate-200';
}

function insightTypeClass(t) {
  if (t === 'risk') return 'text-red-600 border-red-200 bg-red-50';
  if (t === 'opportunity') return 'text-primary border-primary/20 bg-primary/5';
  return 'text-tertiary border-tertiary/20 bg-tertiary/5';
}

function insightTypeLabel(t) {
  if (t === 'risk') return 'Risco';
  if (t === 'opportunity') return 'Oportunidade';
  return 'Otimização';
}

function statusLabel(status) {
  const map = {
    'Em Veiculação': 'Ativa',
    'Em Veiculacao': 'Ativa',
    Otimizacao: 'Otimizando',
    'Em Otimização': 'Otimizando',
    Pausada: 'Pausada',
    Teste: 'Em teste',
  };
  return map[status] || status;
}

function barColor(slug) {
  if (slug === 'meta_ads') return 'bg-tertiary';
  if (slug === 'google_ads') return 'bg-primary';
  return 'bg-outline';
}

function campaignRowVisible(tab, channelSlug) {
  if (tab === 'overview' || tab === 'funnel') return true;
  if (tab === 'meta') return channelSlug === 'meta_ads';
  if (tab === 'google') return channelSlug === 'google_ads';
  return true;
}

function clampDateRange(reportStart, reportEnd, pickedFrom, pickedTo) {
  if (!reportStart || !reportEnd) return null;
  const rs = new Date(reportStart);
  const re = new Date(reportEnd);
  const pf = pickedFrom ? new Date(pickedFrom) : rs;
  const pt = pickedTo ? new Date(pickedTo) : re;
  const start = pf > rs ? pf : rs;
  const end = pt < re ? pt : re;
  if (start > end) return null;
  return { start, end };
}

function campaignOverlapsRange(campaign, dateWindow) {
  const cStart = campaign.started_at ? new Date(campaign.started_at) : null;
  const cEnd = campaign.ended_at ? new Date(campaign.ended_at) : null;
  if (!cStart && !cEnd) return true;
  const start = cStart || cEnd;
  const end = cEnd || cStart;
  return start <= dateWindow.end && end >= dateWindow.start;
}

export function CampaignsDashboardPage() {
  const { session, isAdmin, hubAdmin, isHubOwner, isPlatformOwner, signOut, portal } = useAuth();
  const { loading, banner, payload, syncLabel, reportOptions, selectedSlug, setSelectedSlug } = useCampaignsDashboardData();
  const [tab, setTab] = useState('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [channelFilter, setChannelFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [pickedFrom, setPickedFrom] = useState('');
  const [pickedTo, setPickedTo] = useState('');
  const [expandedCampaignId, setExpandedCampaignId] = useState(null);
  const [insightTypeFilter, setInsightTypeFilter] = useState('all');
  const [campaignSort, setCampaignSort] = useState('priority');
  const [policyRequiredOpen, setPolicyRequiredOpen] = useState(() => !hasAcceptedDataPolicy());
  const [policyInfoOpen, setPolicyInfoOpen] = useState(false);

  const {
    report = {},
    executive,
    channels = [],
    meta_metrics,
    google_network = [],
    google_focus,
    funnel_steps = [],
    funnel_kpis = {},
    campaigns = [],
    insights = [],
  } = payload || {};

  const exec = executive || {
    total_investment: 0,
    investment_delta_label: 'Sem dado',
    avg_roas: 0,
    roas_badge_label: 'Sem dado',
    cpl: 0,
    cpl_delta_label: 'Sem dado',
    total_conversions: 0,
    qualification_rate_label: 'Sem dado',
  };

  const sortedSteps = [...funnel_steps].sort((a, b) => a.sort_order - b.sort_order);

  const channelOptions = useMemo(() => ['all', ...new Set(campaigns.map((c) => c.channel_slug))], [campaigns]);
  const statusOptions = useMemo(() => ['all', ...new Set(campaigns.map((c) => c.status))], [campaigns]);
  const dataBounds = useMemo(() => {
    const starts = campaigns.map((c) => c.started_at).filter(Boolean);
    const ends = campaigns.map((c) => c.ended_at).filter(Boolean);
    const minStart = starts.length ? starts.sort()[0] : report.period_start;
    const maxEnd = ends.length ? ends.sort()[ends.length - 1] : report.period_end;
    return { minStart, maxEnd };
  }, [campaigns, report.period_end, report.period_start]);

  const filteredCampaigns = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const dateWindow = clampDateRange(report.period_start, report.period_end, pickedFrom, pickedTo);
    if (!dateWindow) return [];

    return campaigns.filter((c) => {
      if (!campaignOverlapsRange(c, dateWindow)) return false;
      if (!campaignRowVisible(tab, c.channel_slug)) return false;
      if (channelFilter !== 'all' && c.channel_slug !== channelFilter) return false;
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.external_id.toLowerCase().includes(q) ||
        c.channel_name.toLowerCase().includes(q)
      );
    });
  }, [campaigns, tab, channelFilter, statusFilter, searchTerm, report.period_start, report.period_end, pickedFrom, pickedTo]);

  const filteredInsights = useMemo(() => {
    const ids = new Set(filteredCampaigns.map((c) => c.id));
    return insights.filter((i) => {
      if (i.campaign_id && !ids.has(i.campaign_id)) return false;
      if (insightTypeFilter !== 'all' && i.insight_type !== insightTypeFilter) return false;
      return true;
    });
  }, [insights, filteredCampaigns, insightTypeFilter]);

  const insightsByCampaign = useMemo(() => {
    const m = new Map();
    for (const i of filteredInsights) {
      if (!i.campaign_id) continue;
      if (!m.has(i.campaign_id)) m.set(i.campaign_id, []);
      m.get(i.campaign_id).push(i);
    }
    return m;
  }, [filteredInsights]);

  const enrichedCampaigns = useMemo(
    () =>
      filteredCampaigns.map((c) => {
        const cpa = c.conversions > 0 ? Number(c.invested) / Number(c.conversions) : 0;
        const insightsCount = (insightsByCampaign.get(c.id) || []).length;
        const priority = Number(c.roas) >= 4.5 || Number(c.efficiency_score) >= 85 ? 'Alta' : Number(c.roas) >= 3 ? 'Média' : 'Baixa';
        return { ...c, cpa, insightsCount, priority };
      }),
    [filteredCampaigns, insightsByCampaign]
  );

  const tableCampaigns = useMemo(() => {
    const arr = [...enrichedCampaigns];
    if (campaignSort === 'roas_desc') return arr.sort((a, b) => Number(b.roas) - Number(a.roas));
    if (campaignSort === 'eff_desc') return arr.sort((a, b) => Number(b.efficiency_score) - Number(a.efficiency_score));
    if (campaignSort === 'invest_desc') return arr.sort((a, b) => Number(b.invested) - Number(a.invested));
    if (campaignSort === 'conv_desc') return arr.sort((a, b) => Number(b.conversions) - Number(a.conversions));
    return arr.sort((a, b) => (a.priority < b.priority ? 1 : -1));
  }, [enrichedCampaigns, campaignSort]);

  const executiveDynamic = useMemo(() => {
    if (enrichedCampaigns.length === 0) {
      return {
        investment: Number(exec.total_investment || 0),
        conversions: Number(exec.total_conversions || 0),
        roas: Number(exec.avg_roas || 0),
        cpa: Number(exec.cpl || 0),
        active: 0,
        highPriority: 0,
        insights: filteredInsights.length,
      };
    }

    const investment = enrichedCampaigns.reduce((s, c) => s + Number(c.invested || 0), 0);
    const conversions = enrichedCampaigns.reduce((s, c) => s + Number(c.conversions || 0), 0);
    const roasNum = enrichedCampaigns.reduce((s, c) => s + Number(c.invested || 0) * Number(c.roas || 0), 0);
    const roas = investment > 0 ? roasNum / investment : 0;
    const cpa = conversions > 0 ? investment / conversions : 0;
    const active = enrichedCampaigns.filter((c) => statusLabel(c.status) !== 'Pausada').length;
    const highPriority = enrichedCampaigns.filter((c) => c.priority === 'Alta').length;

    return {
      investment,
      conversions,
      roas,
      cpa,
      active,
      highPriority,
      insights: filteredInsights.length,
    };
  }, [enrichedCampaigns, exec.avg_roas, exec.cpl, exec.total_conversions, exec.total_investment, filteredInsights.length]);

  const channelBreakdown = useMemo(() => {
    const grouped = new Map();
    for (const c of filteredCampaigns) {
      if (!grouped.has(c.channel_slug)) {
        grouped.set(c.channel_slug, {
          slug: c.channel_slug,
          name: c.channel_name,
          campaigns: 0,
          spend: 0,
          conversions: 0,
          roasWeightedNum: 0,
        });
      }
      const row = grouped.get(c.channel_slug);
      row.campaigns += 1;
      row.spend += Number(c.invested || 0);
      row.conversions += Number(c.conversions || 0);
      row.roasWeightedNum += Number(c.roas || 0) * Number(c.invested || 0);
    }
    return [...grouped.values()].map((r) => ({
      ...r,
      roas: r.spend > 0 ? r.roasWeightedNum / r.spend : 0,
      cpa: r.conversions > 0 ? r.spend / r.conversions : 0,
    }));
  }, [filteredCampaigns]);

  const channelCardsDynamic = useMemo(() => {
    const bySlug = new Map(channelBreakdown.map((c) => [c.slug, c]));
    const totalSpend = channelBreakdown.reduce((s, c) => s + Number(c.spend || 0), 0);

    return channels.map((ch) => {
      const row = bySlug.get(ch.slug);
      const spend = Number(row?.spend || 0);
      const roas = Number(row?.roas || 0);
      const participation = totalSpend > 0 ? Math.round((spend / totalSpend) * 100) : 0;

      let caption = 'Sem volume no período';
      if (participation >= 50) caption = 'Maior participação';
      else if (participation >= 25) caption = 'Boa participação';
      else if (participation > 0) caption = 'Em otimização';

      return {
        ...ch,
        investment: spend,
        roas,
        participation_bar_pct: participation,
        performance_caption: caption,
      };
    });
  }, [channelBreakdown, channels]);

  const funnelDynamic = useMemo(() => {
    const qualified = Number(executiveDynamic.conversions || 0);
    const baseQualified = Number(funnel_kpis?.qualified_count || 0);
    const baseClosed = Number(funnel_kpis?.closed_count || 0);
    const closeRate = baseQualified > 0 ? baseClosed / baseQualified : 0;
    const closed = Math.round(qualified * closeRate);
    const qualificationPct = executiveDynamic.investment > 0 ? (qualified / executiveDynamic.investment) * 100 : 0;

    return {
      qualified,
      closed,
      qualificationPct,
      closeRatePct: closeRate * 100,
      closedLabel: funnel_kpis?.closed_label || 'Negócios Fechados',
      closedHelper:
        funnel_kpis?.closed_helper ||
        'Valor dinâmico estimado a partir da taxa histórica de fechamento do relatório.',
    };
  }, [executiveDynamic.conversions, executiveDynamic.investment, funnel_kpis]);

  /** Ranking só por eficiência: scores finitos, ordenação estável e barras vs. líder do filtro. */
  const efficiencyRanking = useMemo(() => {
    const rows = enrichedCampaigns.map((c) => {
      const raw = Number(c.efficiency_score);
      const eff = Number.isFinite(raw) ? raw : 0;
      return { ...c, eff };
    });
    rows.sort((a, b) => b.eff - a.eff || String(a.name).localeCompare(String(b.name)));
    const n = rows.length;
    if (n === 0) {
      return { rows: [], maxEff: 1, minEff: 0, avg: 0 };
    }
    const sum = rows.reduce((s, r) => s + r.eff, 0);
    return {
      rows,
      maxEff: Math.max(...rows.map((r) => r.eff), 1e-6),
      minEff: rows[rows.length - 1].eff,
      avg: sum / n,
    };
  }, [enrichedCampaigns]);

  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid || !isSupabaseConfigured()) return;
    logPanelAccess(uid, '/');
  }, [session?.user?.id]);

  useEffect(() => {
    setTab('overview');
    setSearchTerm('');
    setChannelFilter('all');
    setStatusFilter('all');
    setExpandedCampaignId(null);
    setInsightTypeFilter('all');
    setCampaignSort('priority');
  }, [selectedSlug]);

  useEffect(() => {
    const current = (reportOptions || []).find((r) => r.slug === selectedSlug);
    if (!current) return;
    // Só inicializa datas quando ainda estão vazias.
    // Isso preserva o período escolhido pelo usuário (filtro real).
    if (!pickedFrom && current.period_start) setPickedFrom(current.period_start);
    if (!pickedTo && current.period_end) setPickedTo(current.period_end);
  }, [selectedSlug, reportOptions, pickedFrom, pickedTo]);

  useEffect(() => {
    if (!dataBounds.minStart || !dataBounds.maxEnd) return;
    if (pickedFrom && pickedFrom < dataBounds.minStart) setPickedFrom(dataBounds.minStart);
    if (pickedTo && pickedTo > dataBounds.maxEnd) setPickedTo(dataBounds.maxEnd);
  }, [dataBounds.maxEnd, dataBounds.minStart, pickedFrom, pickedTo]);

  const resolveSlugByDateRange = useCallback((from, to) => {
    const options = reportOptions || [];
    if (!from || !to || options.length === 0) return;

    const overlaps = options.filter((r) => r.period_start && r.period_end && r.period_start <= to && r.period_end >= from);
    if (overlaps.length > 0) {
      const best = [...overlaps].sort((a, b) => new Date(b.period_end) - new Date(a.period_end))[0];
      if (best?.slug && best.slug !== selectedSlug) setSelectedSlug(best.slug);
      return;
    }

    const nearest = [...options]
      .filter((r) => !!r.period_start)
      .sort((a, b) => Math.abs(new Date(a.period_start) - new Date(from)) - Math.abs(new Date(b.period_start) - new Date(from)))[0];
    if (nearest?.slug && nearest.slug !== selectedSlug) setSelectedSlug(nearest.slug);
  }, [reportOptions, selectedSlug, setSelectedSlug]);

  function handleDateRangeChange(field, value) {
    if (field === 'from') setPickedFrom(value);
    if (field === 'to') setPickedTo(value);
  }

  useEffect(() => {
    if (!pickedFrom || !pickedTo) return;
    resolveSlugByDateRange(pickedFrom, pickedTo);
  }, [pickedFrom, pickedTo, reportOptions, resolveSlugByDateRange]);

  function handleQuickFilterByChannel(slug) {
    setChannelFilter(slug);
    setStatusFilter('all');
    setSearchTerm('');
    if (slug === 'meta_ads') setTab('meta');
    else if (slug === 'google_ads') setTab('google');
    else setTab('overview');
  }

  const hubGovernance = hubAdmin || isHubOwner || isPlatformOwner;
  const navItems = useMemo(
    () => getAppNavItems({ isAdmin, hubGovernance, portal }),
    [isAdmin, hubGovernance, portal]
  );

  const usePlatformShell = isSupabaseConfigured();
  const showAsPlatformOwner = isHubOwner || isPlatformOwner;
  const shellSubtitle = showAsPlatformOwner
    ? 'Visão consolidada — gestão global de campanhas (dono da plataforma ou e-mail owner). Obras, imóveis e projetos · Meta e Google.'
    : 'Visão consolidada na rota da plataforma — gestão geral de campanhas e insights. Obras, imóveis e projetos · Meta e Google.';

  const headerActions = (
    <Link
      to="/"
      className="text-[10px] font-black uppercase tracking-widest border border-primary px-4 py-2 hover:bg-primary hover:text-white transition-colors"
    >
      Hub
    </Link>
  );

  const dashboardInner = (
      <div className={`w-full max-w-[1800px] mx-auto px-4 py-8 lg:px-6 space-y-8 min-w-0 ${banner ? 'pt-16' : ''}`}>
        <header className="flex flex-col md:flex-row justify-between items-end gap-6 pb-8 border-b-2 border-primary">
          <div className="space-y-3">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <span className="bg-primary text-white text-[10px] font-black px-2 py-1 tracking-[0.2em] uppercase">
                {report.document_badge}
              </span>
              <span className="text-tertiary text-[10px] font-black tracking-widest uppercase flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px]">security</span>
                {report.governance_label}
              </span>
              {usePlatformShell && showAsPlatformOwner ? (
                <span className="bg-white/90 text-primary border border-primary text-[9px] font-black px-2 py-1 tracking-[0.2em] uppercase">
                  Dono da plataforma
                </span>
              ) : null}
            </div>
            <h1 className="text-3xl md:text-4xl font-black leading-tight tracking-tighter text-primary">
              Performance de campanhas e insights
            </h1>
            <p className="text-lg text-on-surface-variant font-semibold">
              Obras, imóveis e projetos · Meta Ads e Google Ads
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="bg-white border border-outline-variant px-4 py-3 flex items-center gap-3">
              <label htmlFor="report-date-from" className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                Período
              </label>
              <input
                id="report-date-from"
                type="date"
                value={pickedFrom}
                onChange={(e) => handleDateRangeChange('from', e.target.value)}
                min={dataBounds.minStart || undefined}
                max={pickedTo || dataBounds.maxEnd || undefined}
                className="text-sm font-semibold text-primary bg-transparent border border-outline-variant px-2 py-1"
              />
              <span className="text-xs font-black text-on-surface-variant">até</span>
              <input
                id="report-date-to"
                type="date"
                value={pickedTo}
                onChange={(e) => handleDateRangeChange('to', e.target.value)}
                min={pickedFrom || dataBounds.minStart || undefined}
                max={dataBounds.maxEnd || undefined}
                className="text-sm font-semibold text-primary bg-transparent border border-outline-variant px-2 py-1"
              />
            </div>
            <div className="bg-white border border-outline-variant px-4 py-3 flex items-center">
              <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                Dados disponíveis: {dataBounds.minStart || '—'} até {dataBounds.maxEnd || '—'}
              </span>
            </div>
          </div>
        </header>

        <nav
          className="flex border-b border-outline-variant overflow-x-auto no-scrollbar"
          role="tablist"
          aria-label="Seções do painel"
        >
          {TABS.map((t) => {
            const on = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setTab(t.id)}
                className={`px-8 py-4 text-[11px] font-black uppercase tracking-[0.2em] shrink-0 transition-colors ${
                  on
                    ? 'text-primary border-b-[3px] border-primary'
                    : 'text-on-surface-variant hover:bg-surface-container border-b-2 border-transparent'
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </nav>

        <section className="bg-white border border-surface-container-high p-4 md:p-5">
          <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
            <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-primary">Filtros de análise</h3>
            <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
              {filteredCampaigns.length} campanha(s) exibida(s)
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nome, ID ou canal"
              className="md:col-span-2 bg-surface border border-outline-variant px-3 py-2 text-sm"
            />
            <select
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
              className="bg-surface border border-outline-variant px-3 py-2 text-sm"
            >
              {channelOptions.map((slug) => (
                <option key={slug} value={slug}>
                  {slug === 'all' ? 'Todos os canais' : channels.find((c) => c.slug === slug)?.display_name || slug}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-surface border border-outline-variant px-3 py-2 text-sm"
            >
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status === 'all' ? 'Todos os status' : statusLabel(status)}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-3">
            <button
              type="button"
              className="text-[10px] font-black uppercase tracking-[0.15em] text-primary hover:underline"
              onClick={() => {
                setSearchTerm('');
                setChannelFilter('all');
                setStatusFilter('all');
              }}
            >
              Limpar filtros
            </button>
          </div>
        </section>

        {/* Sumário executivo */}
        <Panel tabs="overview" activeTab={tab}>
          <section>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-1.5 h-6 bg-tertiary" />
              <h2 className="text-xs font-black uppercase tracking-[0.2em] text-primary">Sumário Executivo</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <div className="bg-white p-8 border-l-4 border-l-primary border-y border-r border-surface-container-high shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-4">Investimento Total</p>
                <div className="text-4xl font-black text-primary tracking-tighter mb-2">{money(executiveDynamic.investment)}</div>
                <div className="flex items-center gap-2 text-tertiary font-bold text-[11px]">
                  <span className="material-symbols-outlined text-sm">trending_up</span>
                  Baseado no filtro aplicado
                </div>
              </div>
              <div className="bg-primary p-8 border-l-4 border-l-tertiary shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-widest text-white/60 mb-4">Retorno (ROAS Médio)</p>
                <div className="text-5xl font-black text-tertiary tracking-tighter mb-2">{executiveDynamic.roas.toFixed(2)}x</div>
                <div className="flex items-center gap-2 text-white font-bold text-[11px] uppercase tracking-widest">
                  <span className="material-symbols-outlined text-sm">verified</span>
                  Métrica dinâmica por campanhas
                </div>
              </div>
              <div className="bg-white p-8 border border-surface-container-high shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-4">Custo por Conversão</p>
                <div className="text-4xl font-black text-primary tracking-tighter mb-2">{money(executiveDynamic.cpa)}</div>
                <div className="flex items-center gap-2 text-tertiary font-bold text-[11px]">
                  <span className="material-symbols-outlined text-sm">trending_down</span>
                  Investimento dividido por conversões
                </div>
              </div>
              <div className="bg-white p-8 border border-surface-container-high shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-4">Conversões Totais</p>
                <div className="text-4xl font-black text-primary tracking-tighter mb-2">{intFmt(executiveDynamic.conversions)}</div>
                <div className="flex items-center gap-2 text-on-surface-variant font-bold text-[11px]">
                  <span className="material-symbols-outlined text-sm">check_circle</span>
                  Volume no período selecionado
                </div>
              </div>
              <div className="bg-white p-8 border border-surface-container-high shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-4">Campanhas Ativas</p>
                <div className="text-4xl font-black text-primary tracking-tighter mb-2">{intFmt(executiveDynamic.active)}</div>
                <div className="flex items-center gap-2 text-on-surface-variant font-bold text-[11px]">
                  <span className="material-symbols-outlined text-sm">bolt</span>
                  Exclui status pausada
                </div>
              </div>
              <div className="bg-white p-8 border border-surface-container-high shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-4">Prioridade Alta / Insights</p>
                <div className="text-4xl font-black text-primary tracking-tighter mb-2">
                  {intFmt(executiveDynamic.highPriority)} / {intFmt(executiveDynamic.insights)}
                </div>
                <div className="flex items-center gap-2 text-on-surface-variant font-bold text-[11px]">
                  <span className="material-symbols-outlined text-sm">insights</span>
                  Pronto para ação comercial
                </div>
              </div>
            </div>
          </section>
        </Panel>

        {/* Canais */}
        <Panel tabs="overview" activeTab={tab}>
          <section>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-1.5 h-6 bg-tertiary" />
              <h2 className="text-xs font-black uppercase tracking-[0.2em] text-primary">Comparativo por Canal &amp; Eficiência</h2>
            </div>
            <div className="bg-white border border-surface-container-high overflow-hidden">
              <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-surface-container-high">
                {channelCardsDynamic.map((ch) => (
                  <button
                    key={ch.slug}
                    type="button"
                    className="p-8 space-y-4 text-left hover:bg-surface-container-low/40 transition-colors"
                    onClick={() => handleQuickFilterByChannel(ch.slug)}
                  >
                    <div className="flex justify-between items-center">
                      <span className={`${badgeToneClass(ch.badge_tone)} text-[9px] font-black px-2 py-0.5 uppercase tracking-widest`}>
                        {ch.display_name}
                      </span>
                      <span className={`${ch.slug === 'meta_ads' ? 'text-tertiary' : 'text-primary'} font-black text-lg`}>
                        {Number(ch.roas || 0).toFixed(2)}x ROAS
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="text-2xl font-black text-primary">{money(ch.investment)}</div>
                      <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Investimento Realizado</p>
                    </div>
                    <div className="pt-4 border-t border-surface-container">
                      <div className="flex justify-between text-[10px] font-black uppercase mb-2">
                        <span>Participação ROI</span>
                        <span>{ch.performance_caption}</span>
                      </div>
                      <div className="w-full bg-surface-container h-1.5">
                        <div
                          className={`${barColor(ch.slug)} h-full transition-all`}
                          style={{ width: `${ch.participation_bar_pct}%` }}
                        />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </section>
        </Panel>

        <Panel tabs="overview meta google" activeTab={tab}>
          <section>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-1.5 h-6 bg-tertiary" />
              <h2 className="text-xs font-black uppercase tracking-[0.2em] text-primary">Detalhe por canal (dinâmico)</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {channelBreakdown.map((c) => (
                <div key={c.slug} className="bg-white border border-surface-container-high p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-black text-primary">{c.name}</span>
                    <span className="text-[10px] uppercase font-bold text-on-surface-variant">{c.campaigns} campanhas</span>
                  </div>
                  <p className="text-[11px] text-on-surface-variant">
                    Investimento: <strong className="text-primary">{money(c.spend)}</strong>
                  </p>
                  <p className="text-[11px] text-on-surface-variant">
                    Conversões: <strong className="text-primary">{intFmt(c.conversions)}</strong>
                  </p>
                  <p className="text-[11px] text-on-surface-variant">
                    ROAS médio: <strong className="text-tertiary">{c.roas.toFixed(2)}x</strong>
                  </p>
                  <p className="text-[11px] text-on-surface-variant">
                    Custo por conversão: <strong className="text-primary">{money(c.cpa)}</strong>
                  </p>
                </div>
              ))}
            </div>
          </section>
        </Panel>

        {/* Meta + Google */}
        <Panel
          tabs="overview meta google"
          activeTab={tab}
          className={tab === 'overview' ? 'grid grid-cols-1 lg:grid-cols-2 gap-8' : 'grid grid-cols-1 gap-8'}
        >
          <Panel tabs="overview meta" activeTab={tab} className="space-y-6">
            <div className="flex items-center justify-between border-b border-surface-container-high pb-4">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-blue-600">facebook</span>
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-primary">Métricas Meta Ads</h3>
              </div>
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">{meta_metrics?.focus_label}</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                ['Impressões', meta_metrics?.impressions_label, false],
                ['Cliques no Link', meta_metrics?.link_clicks_label, false],
                ['CTR Médio', meta_metrics?.ctr_label, false],
                ['CPC Médio', meta_metrics?.cpc_label, true],
              ].map(([label, val, tertiary]) => (
                <div key={label} className="bg-white p-6 border border-surface-container-high">
                  <p className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant mb-1">{label}</p>
                  <p className={`text-2xl font-black ${tertiary ? 'text-tertiary' : 'text-primary'}`}>{val ?? '—'}</p>
                </div>
              ))}
            </div>
          </Panel>
          <Panel tabs="overview google" activeTab={tab} className="space-y-6">
            <div className="flex items-center justify-between border-b border-surface-container-high pb-4">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-red-500">search</span>
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-primary">Métricas Google Ads</h3>
              </div>
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">{google_focus}</span>
            </div>
            <div className="bg-white border border-surface-container-high overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-surface-container-low text-[9px] font-black uppercase tracking-widest text-on-surface-variant border-b border-surface-container-high">
                    <th className="px-6 py-4">Rede</th>
                    <th className="px-6 py-4">Investimento</th>
                    <th className="px-6 py-4 text-right">Conv.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container-high">
                  {(google_network || []).map((r) => (
                    <tr key={r.network_name} className="text-sm">
                      <td className="px-6 py-4 font-bold text-primary">{r.network_name}</td>
                      <td className="px-6 py-4">{money(r.investment)}</td>
                      <td className="px-6 py-4 text-right font-bold text-tertiary">{intFmt(r.conversions)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </Panel>

        {/* Funil */}
        <Panel tabs="overview funnel" activeTab={tab}>
          <section>
            <div className="flex items-center gap-3 mb-8">
              <div className="w-1.5 h-6 bg-tertiary" />
              <h2 className="text-xs font-black uppercase tracking-[0.2em] text-primary">Eficiência do Funil de Conversão</h2>
            </div>
            <div className="bg-primary text-white p-12 relative overflow-hidden">
              <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-tertiary/10 skew-x-[-12deg] translate-x-20" aria-hidden />
              <div className="grid grid-cols-1 md:grid-cols-5 gap-8 relative z-10">
                {sortedSteps.flatMap((s, i) => {
                  const nodes = [
                    <div key={`s-${s.sort_order}`} className="space-y-4">
                      <p className={`text-[9px] font-black uppercase tracking-[0.2em] ${s.highlight ? 'text-tertiary' : 'text-white/50'}`}>
                        {s.title}
                      </p>
                      <div>
                        <div className={`text-3xl font-black tracking-tighter ${s.highlight ? 'text-tertiary' : ''}`}>{s.value_display}</div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-white/70">{s.sublabel}</div>
                      </div>
                    </div>,
                  ];
                  if (i < sortedSteps.length - 1) {
                    nodes.push(
                      <div key={`a-${s.sort_order}`} className="flex items-center justify-center md:justify-start">
                        <span className="material-symbols-outlined text-white/20 text-3xl">arrow_forward</span>
                      </div>
                    );
                  }
                  return nodes;
                })}
              </div>
              <div className="mt-12 pt-12 border-t border-white/10 grid grid-cols-1 md:grid-cols-2 gap-12">
                <div className="flex items-start gap-6">
                  <div className="p-4 bg-white/5 border border-white/10">
                    <span className="material-symbols-outlined text-tertiary text-4xl">verified_user</span>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/60 mb-1">Oportunidades Qualificadas</p>
                    <p className="text-3xl font-black">{intFmt(funnelDynamic.qualified)}</p>
                    <p className="text-[11px] font-medium text-white/50 mt-1">
                      {funnel_kpis.qualified_helper || `${funnelDynamic.qualificationPct.toFixed(2)}% de conversões por investimento no período filtrado`}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-6">
                  <div className="p-4 bg-tertiary border border-tertiary">
                    <span className="material-symbols-outlined text-primary text-4xl">handshake</span>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/60 mb-1">
                      {funnelDynamic.closedLabel}
                    </p>
                    <p className="text-3xl font-black text-white">
                      {intFmt(funnelDynamic.closed)}
                    </p>
                    <p className="text-[11px] font-medium text-white/50 mt-1">
                      {funnelDynamic.closedHelper} ({funnelDynamic.closeRatePct.toFixed(1)}% de fechamento estimado).
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </Panel>

        {/* Otimização */}
        <Panel tabs="overview funnel meta google" activeTab={tab}>
          <section>
            <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-6 bg-tertiary" />
                <h2 className="text-xs font-black uppercase tracking-[0.2em] text-primary">Otimização &amp; Performance das Campanhas</h2>
              </div>
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
                Sinais priorizados para escala e eficiência
              </span>
            </div>
            <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <select
                value={insightTypeFilter}
                onChange={(e) => setInsightTypeFilter(e.target.value)}
                className="bg-white border border-outline-variant px-3 py-2 text-sm"
              >
                <option value="all">Todos os tipos de insight</option>
                <option value="optimization">Otimização</option>
                <option value="opportunity">Oportunidade</option>
                <option value="risk">Risco</option>
              </select>
              <select
                value={campaignSort}
                onChange={(e) => setCampaignSort(e.target.value)}
                className="bg-white border border-outline-variant px-3 py-2 text-sm"
              >
                <option value="priority">Ordenar por prioridade</option>
                <option value="roas_desc">ROAS maior primeiro</option>
                <option value="eff_desc">Eficiência maior primeiro</option>
                <option value="invest_desc">Investimento maior primeiro</option>
                <option value="conv_desc">Conversões maiores primeiro</option>
              </select>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:items-stretch">
              {/* Mesma altura nas duas colunas; rolagem só na área útil */}
              <div className="flex min-h-0 h-[min(62vh,480px)] lg:h-[min(68vh,520px)] flex-col border border-surface-container-high bg-white shadow-sm">
                <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 py-3 space-y-2">
                  {filteredInsights.map((i, idx) => {
                    const camp = campaigns.find((c) => c.id === i.campaign_id);
                    return (
                      <div key={idx} className="border-b border-surface-container-high last:border-0 pb-2 last:pb-0 flex gap-3">
                        <div
                          className={`shrink-0 self-start px-1.5 py-0.5 text-[8px] font-black uppercase border ${insightTypeClass(i.insight_type)}`}
                        >
                          {insightTypeLabel(i.insight_type)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                            <p className="text-xs font-black text-primary leading-tight">{i.title}</p>
                            {camp && <span className="text-[9px] font-bold text-on-surface-variant">{camp.external_id}</span>}
                            {i.impact_label && (
                              <span className="text-[9px] font-black uppercase text-on-surface-variant">{i.impact_label}</span>
                            )}
                          </div>
                          <p className="text-[11px] text-on-surface-variant leading-snug mt-0.5">{i.detail}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="flex min-h-0 h-[min(62vh,480px)] lg:h-[min(68vh,520px)] flex-col bg-white border border-surface-container-high p-4 md:p-5 shadow-sm">
                <div className="shrink-0 mb-3 space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                    Ranking de eficiência
                  </p>
                  <p className="text-[10px] text-on-surface-variant leading-snug">
                    Ordenação sempre do maior para o menor score. Barras proporcionais ao 1º lugar no filtro atual (não ao limite 100).
                  </p>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-1.5 pr-1">
                  {efficiencyRanking.rows.map((c, i) => {
                    const pct = (c.eff / efficiencyRanking.maxEff) * 100;
                    const topClass =
                      i === 0
                        ? 'bg-tertiary/8 border-l-[3px] border-l-tertiary'
                        : i === 1
                          ? 'bg-slate-100/80 border-l-[3px] border-l-slate-400'
                          : i === 2
                            ? 'bg-amber-50/90 border-l-[3px] border-l-amber-500'
                            : 'border-l-[3px] border-l-transparent';
                    return (
                      <div key={c.id} className={`rounded-sm pl-2 pr-1 py-1.5 ${topClass}`}>
                        <div className="flex items-baseline gap-2 mb-0.5">
                          <span
                            className="shrink-0 w-6 text-[9px] font-black text-on-surface-variant tabular-nums"
                            title="Posição no ranking"
                          >
                            {i + 1}
                          </span>
                          <span className="text-[10px] font-bold uppercase text-on-surface-variant truncate min-w-0 flex-1 leading-tight">
                            {c.name}
                          </span>
                          <span className="shrink-0 text-[10px] font-black tabular-nums text-primary">{c.eff.toFixed(1)}</span>
                        </div>
                        <div className="ml-8 w-[calc(100%-1.5rem)] bg-surface-container h-1.5 rounded-sm overflow-hidden">
                          <div
                            className="bg-tertiary h-full rounded-sm transition-[width] duration-200"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="text-[10px] text-on-surface-variant shrink-0 pt-3 border-t border-surface-container-high space-y-0.5">
                  <p>
                    <span className="font-bold text-primary">Resumo do filtro:</span> mín.{' '}
                    <strong>{efficiencyRanking.rows.length ? efficiencyRanking.minEff.toFixed(1) : '—'}</strong>
                    {' · '}
                    média <strong>{efficiencyRanking.rows.length ? efficiencyRanking.avg.toFixed(1) : '—'}</strong>
                    {' · '}
                    máx. <strong>{efficiencyRanking.rows.length ? efficiencyRanking.rows[0].eff.toFixed(1) : '—'}</strong>
                    <span className="text-on-surface-variant/70"> ({efficiencyRanking.rows.length} camp.)</span>
                  </p>
                </div>
              </div>
            </div>
          </section>
        </Panel>

        {/* Campanhas */}
        <Panel tabs="overview meta google funnel" activeTab={tab}>
          <section>
            <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-6 bg-tertiary" />
                <h2 className="text-xs font-black uppercase tracking-[0.2em] text-primary">Detalhamento de Campanhas Ativas</h2>
              </div>
              <div className="flex gap-2 items-center">
                <div className="w-3 h-3 bg-tertiary" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Alta Performance</span>
              </div>
            </div>
            <div id="campaigns-table-top" className="bg-white border border-surface-container-high shadow-sm overflow-hidden scroll-mt-24">
              <div className="overflow-auto max-h-[650px]">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-surface-container text-[10px] font-black uppercase tracking-[0.15em] text-primary border-b border-surface-container-high">
                      <th className="px-8 py-5">Campanha / ID</th>
                      <th className="px-8 py-5">Canal</th>
                      <th className="px-8 py-5">Investido</th>
                      <th className="px-8 py-5">Conv.</th>
                      <th className="px-8 py-5 hidden md:table-cell">Custo/Conv.</th>
                      <th className="px-8 py-5">ROAS</th>
                      <th className="px-8 py-5 hidden md:table-cell">Efic.</th>
                      <th className="px-8 py-5 hidden lg:table-cell">Prioridade</th>
                      <th className="px-8 py-5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container-high">
                    {tableCampaigns.map((c) => (
                      <Fragment key={c.id}>
                        <tr className="hover:bg-surface-container-low transition-colors">
                          <td className="px-8 py-6">
                            <div className="font-bold text-primary text-sm uppercase">{c.name}</div>
                            <div className="text-[10px] text-on-surface-variant tracking-widest mt-1">ID: {c.external_id}</div>
                            <div className="mt-3 flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setExpandedCampaignId(expandedCampaignId === c.id ? null : c.id)}
                                className="text-[9px] font-black uppercase tracking-widest text-primary border border-outline-variant px-2 py-1 hover:bg-surface"
                              >
                                {expandedCampaignId === c.id ? 'Ocultar detalhes' : 'Ver detalhes'}
                              </button>
                              <span className="text-[9px] font-bold uppercase text-on-surface-variant">{c.insightsCount} insight(s)</span>
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 ${channelPillClass(c.badge_tone)} text-[10px] font-black uppercase tracking-tighter border`}
                            >
                              {c.channel_name}
                            </span>
                          </td>
                          <td className="px-8 py-6 font-semibold text-sm">{money(c.invested)}</td>
                          <td className="px-8 py-6 font-semibold text-sm">{intFmt(c.conversions)}</td>
                          <td className="px-8 py-6 hidden md:table-cell font-semibold text-sm">{money(c.cpa)}</td>
                          <td className="px-8 py-6">
                            <span className="text-tertiary font-black">{c.roas}x</span>
                          </td>
                          <td className="px-8 py-6 hidden md:table-cell">
                            <span className="text-primary font-black">{Number(c.efficiency_score).toFixed(1)}</span>
                          </td>
                          <td className="px-8 py-6 hidden lg:table-cell">
                            <span className="text-[10px] font-black uppercase text-on-surface-variant">{c.priority}</span>
                          </td>
                          <td className="px-8 py-6 text-right">
                            <span className="inline-flex items-center gap-2 px-3 py-1 text-[9px] font-black uppercase bg-tertiary/10 text-tertiary border border-tertiary/20">
                              <span className="w-1 h-1 bg-tertiary animate-pulse" />
                              {statusLabel(c.status)}
                            </span>
                          </td>
                        </tr>
                        {expandedCampaignId === c.id && (
                          <tr className="bg-surface">
                            <td colSpan={9} className="px-8 py-5">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-white border border-surface-container-high p-3">
                                  <p className="text-[10px] font-black uppercase text-on-surface-variant mb-1">Resumo dinâmico</p>
                                  <p className="text-sm text-on-surface-variant">Custo por conversão: <strong className="text-primary">{money(c.cpa)}</strong></p>
                                  <p className="text-sm text-on-surface-variant">Eficiência: <strong className="text-primary">{Number(c.efficiency_score).toFixed(1)}</strong></p>
                                  <p className="text-sm text-on-surface-variant">Prioridade: <strong className="text-primary">{c.priority}</strong></p>
                                </div>
                                <div className="bg-white border border-surface-container-high p-3 md:col-span-2">
                                  <p className="text-[10px] font-black uppercase text-on-surface-variant mb-1">Ação sugerida</p>
                                  <p className="text-sm text-on-surface-variant">{c.optimization_hint || 'Sem recomendação para este item.'}</p>
                                  {(insightsByCampaign.get(c.id) || []).length > 0 && (
                                    <div className="mt-3 space-y-1">
                                      {(insightsByCampaign.get(c.id) || []).slice(0, 2).map((ins, idx) => (
                                        <p key={idx} className="text-[11px] text-on-surface-variant">
                                          • <strong>{ins.title}:</strong> {ins.detail}
                                        </p>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-6 bg-surface-container-low text-center">
                <button
                  type="button"
                  onClick={() => document.getElementById('campaigns-table-top')?.scrollIntoView({ behavior: 'smooth' })}
                  className="text-[10px] font-black uppercase tracking-[0.2em] text-primary hover:underline underline-offset-4 decoration-2"
                >
                  Ver Painel Completo de Campanhas ({report.campaigns_total_hint})
                </button>
              </div>
            </div>
          </section>
        </Panel>

        <footer className="pt-12 pb-12 border-t-2 border-primary flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <span className="text-primary font-black text-xs uppercase tracking-[0.3em]">Arqui System</span>
              <span className="w-px h-4 bg-outline-variant" />
              <span className="text-on-surface-variant font-bold text-[10px] uppercase tracking-widest">Internal Analytics Unit</span>
            </div>
            <p className="text-[10px] text-on-surface-variant/60 max-w-sm leading-relaxed uppercase tracking-wider">
              Este relatório é estritamente confidencial e para uso exclusivo de stakeholders autorizados. A reprodução não autorizada está
              sujeita a sanções de governança.
            </p>
          </div>
          <div className="flex flex-wrap justify-center md:justify-end gap-10 items-center text-[10px] font-black uppercase tracking-widest text-primary">
            <div className="flex items-center gap-3 text-tertiary">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-tertiary/40 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-tertiary" />
              </span>
              {syncLabel}
            </div>
            <button
              type="button"
              onClick={() => setPolicyInfoOpen(true)}
              className="hover:text-tertiary transition-colors border-b border-transparent hover:border-tertiary bg-transparent cursor-pointer"
            >
              Políticas de Dados
            </button>
            {isSupabaseConfigured() && session && !usePlatformShell && (
              <Link
                to="/crm"
                className="hover:text-tertiary transition-colors border-b border-transparent hover:border-tertiary"
              >
                CRM / Plataforma
              </Link>
            )}
            {isSupabaseConfigured() && session && !usePlatformShell && (
              <button
                type="button"
                onClick={() => signOut()}
                className="hover:text-tertiary transition-colors border-b border-transparent hover:border-tertiary bg-transparent cursor-pointer font-black uppercase tracking-widest"
              >
                Sair
              </button>
            )}
            <span className="text-outline">Build 2.4.0-GA</span>
          </div>
        </footer>
      </div>
  );

  return (
    <>
      <DataPolicyModal
        mode="required"
        open={policyRequiredOpen}
        onClose={() => setPolicyRequiredOpen(false)}
        onAccepted={() => setPolicyRequiredOpen(false)}
      />
      <DataPolicyModal mode="info" open={policyInfoOpen} onClose={() => setPolicyInfoOpen(false)} />

      {loading && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-primary text-white text-[10px] font-black uppercase tracking-widest">
          Carregando dados…
        </div>
      )}
      {banner && (
        <div className="fixed top-0 inset-x-0 z-50 bg-red-700 text-white text-center text-[11px] font-semibold py-2 px-4">
          {banner}
        </div>
      )}

      {usePlatformShell ? (
        <AppShell
          title="Painel de campanhas"
          subtitle={shellSubtitle}
          navItems={navItems}
          headerActions={headerActions}
        >
          {dashboardInner}
        </AppShell>
      ) : (
        dashboardInner
      )}
    </>
  );
}




