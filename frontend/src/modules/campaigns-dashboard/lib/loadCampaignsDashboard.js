import { getReportSlug, getSupabase } from '../../../lib/supabaseClient';

/**
 * Apelidos ? slug exato em public.reports.
 * ?til quando VITE_REPORT_SLUG na Vercel ? curto (ex.: obra10) e no banco s? existe o slug longo.
 */
const REPORT_SLUG_ALIASES = {
  obra10: 'obra10-2025-12-2026-02',
};

export async function listAvailableReports() {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('reports')
    .select('id, slug, period_range_label, cycle_label, period_start, period_end, created_at')
    .order('period_start', { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}

async function resolveReport(supabase, desiredSlug) {
  const candidates = [desiredSlug, REPORT_SLUG_ALIASES[desiredSlug]].filter(
    (s, i, arr) => Boolean(s) && arr.indexOf(s) === i
  );

  for (const slug of candidates) {
    const { data: exact, error: e1 } = await supabase.from('reports').select('*').eq('slug', slug).maybeSingle();
    if (e1) throw new Error(e1.message);
    if (exact) return { report: exact, notice: null };
  }

  const { data: fallback, error: e2 } = await supabase
    .from('reports')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (e2) throw new Error(e2.message);
  if (!fallback) throw new Error('Nenhum relat?rio encontrado na tabela reports.');

  return {
    report: fallback,
    notice: `Slug �${desiredSlug}� n?o existe no banco. Exibindo �${fallback.slug}�. Ajuste VITE_REPORT_SLUG na Vercel para esse slug e redeploy.`,
  };
}

/**
 * Carrega e normaliza o painel a partir do Supabase.
 */
export async function loadDashboardFromSupabase() {
  const desiredSlug = getReportSlug();
  return loadDashboardBySlug(desiredSlug);
}

export async function loadDashboardBySlug(desiredSlug = getReportSlug()) {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase n?o configurado');

  const { report, notice } = await resolveReport(supabase, desiredSlug);
  const reportId = report.id;

  const [
    { data: executive },
    { data: channelKpis },
    { data: channels },
    { data: meta_metrics },
    { data: google_stats },
    { data: google_meta },
    { data: funnel_steps },
    { data: funnel_kpis },
    { data: campaigns },
    { data: insights },
  ] = await Promise.all([
    supabase.from('executive_kpis').select('*').eq('report_id', reportId).maybeSingle(),
    supabase.from('channel_kpis').select('*, channels(*)').eq('report_id', reportId),
    supabase.from('channels').select('*').order('sort_order'),
    supabase.from('meta_metrics').select('*').eq('report_id', reportId).maybeSingle(),
    supabase.from('google_network_stats').select('*').eq('report_id', reportId).order('sort_order'),
    supabase.from('google_metrics_meta').select('*').eq('report_id', reportId).maybeSingle(),
    supabase.from('funnel_steps').select('*').eq('report_id', reportId).order('sort_order'),
    supabase.from('funnel_kpis').select('*').eq('report_id', reportId).maybeSingle(),
    supabase.from('campaigns').select('*, channels(*)').eq('report_id', reportId).order('sort_order'),
    supabase.from('campaign_insights').select('*').eq('report_id', reportId).order('sort_order'),
  ]);

  const chMap = Object.fromEntries((channels || []).map((c) => [c.id, c]));

  const normalizedChannels = (channelKpis || [])
    .map((row) => {
      const ch = row.channels || chMap[row.channel_id];
      if (!ch) return null;
      return {
        slug: ch.slug,
        display_name: ch.display_name,
        badge_tone: ch.badge_tone,
        investment: Number(row.investment),
        roas: Number(row.roas),
        participation_bar_pct: row.participation_bar_pct,
        performance_caption: row.performance_caption,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const order = { meta_ads: 0, google_ads: 1, organic: 2 };
      return (order[a.slug] ?? 9) - (order[b.slug] ?? 9);
    });

  const normalizedCampaigns = (campaigns || [])
    .map((row) => {
      const ch = row.channels || chMap[row.channel_id];
      if (!ch) return null;
      return {
        id: row.id,
        external_id: row.external_id,
        name: row.name,
        channel_slug: ch.slug,
        channel_name: ch.display_name,
        badge_tone: ch.badge_tone,
        invested: Number(row.invested),
        conversions: row.conversions,
        roas: Number(row.roas),
        status: row.status,
        started_at: row.started_at || null,
        ended_at: row.ended_at || null,
        efficiency_score: Number(row.efficiency_score),
        optimization_hint: row.optimization_hint,
      };
    })
    .filter(Boolean);

  const normalizedInsights = (insights || []).map((i) => ({
    campaign_id: i.campaign_id,
    title: i.title,
    detail: i.detail,
    impact_label: i.impact_label,
    insight_type: i.insight_type || 'optimization',
  }));

  return {
    notice,
    report,
    executive,
    channels: normalizedChannels,
    meta_metrics,
    google_network: google_stats || [],
    google_focus: google_meta?.focus_label || 'Foco: Intenção de compra',
    funnel_steps: (funnel_steps || []).map((s) => ({
      sort_order: s.sort_order,
      title: s.title,
      value_display: s.value_display,
      sublabel: s.sublabel,
      highlight: s.step_key === 'conversion',
    })),
    funnel_kpis: funnel_kpis || {},
    campaigns: normalizedCampaigns,
    insights: normalizedInsights,
  };
}
