/** Dados fictícios quando .env não está configurado ou a API falha */
export function buildMockPayload() {
  return {
    report: {
      id: 'mock',
      slug: 'demo-outubro-2024',
      document_badge: 'Documento Reservado (mock)',
      governance_label: 'Arqui System Governance',
      title: 'Relatório de Performance de Marketing',
      cycle_label: 'Ciclo Operacional: Outubro 2024',
      unit_label: 'Unidade: Tráfego Pago & Growth',
      period_range_label: '01 Out - 31 Out, 2024',
      campaigns_total_hint: 12,
    },
    executive: {
      total_investment: 124500,
      investment_delta_label: '+12.4% vs Setembro',
      avg_roas: 4.2,
      roas_badge_label: 'Meta Excedida (+20%)',
      cpl: 18.4,
      cpl_delta_label: '-4.5% Redução de Custo',
      total_conversions: 6760,
      qualification_rate_label: '82% Taxa Qualificação',
    },
    channels: [
      { slug: 'meta_ads', display_name: 'Meta Ads', badge_tone: 'blue', investment: 64200, roas: 5.2, participation_bar_pct: 85, performance_caption: 'Melhor Performance' },
      { slug: 'google_ads', display_name: 'Google Ads', badge_tone: 'red', investment: 48100, roas: 3.8, participation_bar_pct: 65, performance_caption: 'Estável' },
      { slug: 'organic', display_name: 'Outros/Organic', badge_tone: 'slate', investment: 12200, roas: 2.1, participation_bar_pct: 35, performance_caption: 'Em Otimização' },
    ],
    meta_metrics: {
      impressions_label: '2.4M',
      link_clicks_label: '48.200',
      ctr_label: '2.01%',
      cpc_label: 'R$ 1,33',
      focus_label: 'Foco: Conversão Direta',
    },
    google_network: [
      { network_name: 'Search', investment: 32400, conversions: 420 },
      { network_name: 'PMax', investment: 15700, conversions: 184 },
    ],
    google_focus: 'Foco: Intenção de Compra',
    funnel_steps: [
      { sort_order: 1, title: '1. Atração', value_display: '342.1k', sublabel: 'Impressões', highlight: false },
      { sort_order: 2, title: '2. Engajamento', value_display: '48.2k', sublabel: 'Cliques (CTR 14%)', highlight: false },
      { sort_order: 3, title: '3. Conversão (Lead)', value_display: '6.760', sublabel: 'Total de Leads', highlight: true },
    ],
    funnel_kpis: {
      qualified_count: 1542,
      qualified_helper: '22.8% de aproveitamento do topo',
      closed_count: 248,
      closed_label: 'Negócios Fechados (ID_NEGOCIO)',
      closed_helper: 'ROI Final de Operação consolidado',
    },
    campaigns: [
      { id: 'mock-0', external_id: 'AQ-2024-001', name: 'Lançamento Residencial Sovereign', channel_slug: 'meta_ads', channel_name: 'Meta Ads', badge_tone: 'blue', invested: 42300, conversions: 2140, roas: 5.2, status: 'Em Veiculação', efficiency_score: 91, optimization_hint: 'Elevar orçamento em AD sets com melhor CPA.' },
      { id: 'mock-1', external_id: 'AQ-2024-004', name: 'Retargeting Branding Arquitetos', channel_slug: 'google_ads', channel_name: 'Google Ads', badge_tone: 'red', invested: 18200, conversions: 890, roas: 3.8, status: 'Em Veiculação', efficiency_score: 84, optimization_hint: 'Refinar lista negativa e sinais PMax.' },
    ],
    insights: [
      { campaign_id: 'mock-0', title: 'Escalar orçamento com segurança', detail: 'Campanhas com ROAS elevado sustentam aumento de spend sem elevar CPL.', impact_label: 'Alto', insight_type: 'optimization' },
      { campaign_id: null, title: 'Fadiga de criativo', detail: 'Rotacionar criativos quando CTR cai por 3 sessões seguidas.', impact_label: 'Alto', insight_type: 'risk' },
    ],
  };
}
