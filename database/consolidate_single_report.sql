-- =============================================================================
-- Um único relatório: move campanhas + insights para o slug canônico e apaga
-- os outros registros em public.reports (com KPIs/funil/meta/google ligados).
--
-- Por que existiam vários slugs? Seeds, testes ou imports antigos criaram
-- várias linhas em public.reports. O script fix_period_* só ATUALIZOU cada
-- linha que já estava lá — não cria duplicata.
--
-- Antes de rodar: faça backup ou use staging. Rode no SQL Editor (PRODUÇÃO).
--
-- Depois: em Vercel/.env use o mesmo VITE_REPORT_SLUG do canônico abaixo
-- (ou renomeie o slug no final — ver comentário).
-- =============================================================================

do $$
declare
  v_canonical_slug text := 'obra10-2025-12-2026-02';
  v_target uuid;
  r record;
begin
  select id into v_target from public.reports where slug = v_canonical_slug limit 1;

  if v_target is null then
    raise exception 'Relatório canônico não encontrado: %. Ajuste v_canonical_slug.', v_canonical_slug;
  end if;

  -- 1) Todas as campanhas apontam para o relatório canônico
  update public.campaigns
  set report_id = v_target
  where report_id <> v_target;

  -- 2) Insights acompanham o report_id da campanha
  update public.campaign_insights ci
  set report_id = c.report_id
  from public.campaigns c
  where ci.campaign_id = c.id;

  -- 3) Remove KPIs / funil / métricas dos relatórios que serão apagados
  for r in select id, slug from public.reports where id <> v_target
  loop
    delete from public.executive_kpis where report_id = r.id;
    delete from public.channel_kpis where report_id = r.id;
    delete from public.meta_metrics where report_id = r.id;
    delete from public.google_network_stats where report_id = r.id;
    delete from public.google_metrics_meta where report_id = r.id;
    delete from public.funnel_steps where report_id = r.id;
    delete from public.funnel_kpis where report_id = r.id;
    delete from public.reports where id = r.id;
    raise notice 'Removido relatório % (%)', r.slug, r.id;
  end loop;

  -- 4) sort_order único por campanha (evita empates após união)
  with ranked as (
    select id, row_number() over (order by sort_order nulls last, id) as rn
    from public.campaigns
    where report_id = v_target
  )
  update public.campaigns c
  set sort_order = ranked.rn
  from ranked
  where c.id = ranked.id;

  raise notice 'Consolidado em um único report: % (%)', v_canonical_slug, v_target;
end $$;

-- Opcional: renomear o slug final (atualize VITE_REPORT_SLUG na Vercel também)
-- update public.reports set slug = 'obra10' where slug = 'obra10-2025-12-2026-02';
