-- =============================================================================
-- Append: campanhas fictícias — leads imobiliários + corretores (Meta + Google)
-- Mantém canais meta_ads e google_ads apenas. Não remove dados existentes.
--
-- Ajuste o slug do relatório abaixo se o seu for outro:
-- =============================================================================

do $$
declare
  v_report uuid;
  v_meta uuid;
  v_google uuid;
  v_sort int;
  v_ext text;
  v_cid uuid;
begin
  select id into v_report
  from public.reports
  where slug = 'obra10-2025-12-2026-02'
  limit 1;

  if v_report is null then
    raise exception 'Relatório não encontrado. Altere o slug em seed_imobiliario_corretores_append.sql ou crie o report antes.';
  end if;

  select id into v_meta from public.channels where slug = 'meta_ads' limit 1;
  select id into v_google from public.channels where slug = 'google_ads' limit 1;

  select coalesce(max(sort_order), 0) + 1 into v_sort from public.campaigns where report_id = v_report;

  -- Meta: leads / corretores / carteira
  foreach v_ext in array array[
    'IMOB-M-LC-001',
    'IMOB-M-LC-002',
    'IMOB-M-CRT-003',
    'IMOB-M-CAPT-004',
    'IMOB-M-VIS-005',
    'IMOB-M-REM-006',
    'IMOB-M-BRK-007',
    'IMOB-M-ALU-008'
  ]
  loop
    if exists (select 1 from public.campaigns where report_id = v_report and external_id = v_ext) then
      continue;
    end if;

    insert into public.campaigns (
      report_id, channel_id, external_id, name, invested, conversions, roas, status,
      sort_order, started_at, ended_at, efficiency_score, optimization_hint
    )
    values (
      v_report,
      v_meta,
      v_ext,
      case v_ext
        when 'IMOB-M-LC-001' then 'Leads Qualificados — Corretores Parceiros Zona Sul'
        when 'IMOB-M-LC-002' then 'Formulário Captação — Compradores Alto Padrão'
        when 'IMOB-M-CRT-003' then 'Remarketing CRECI — Carteira de Corretores'
        when 'IMOB-M-CAPT-004' then 'Tráfego — Anúncios de Captação de Imóveis'
        when 'IMOB-M-VIS-005' then 'Convite Visita — Empreendimentos em Obra'
        when 'IMOB-M-REM-006' then 'Retarget Lista — Leads Imobiliários 90d'
        when 'IMOB-M-BRK-007' then 'Brand Lift — Rede de Corretores Obra10'
        when 'IMOB-M-ALU-008' then 'Leads Locação — Profissionais CRECI'
      end,
      (8000 + (random() * 12000))::numeric(12,2),
      (120 + floor(random() * 380))::int,
      (3.2 + random() * 2.8)::numeric(6,2),
      (array['Em Veiculação','Em Otimização','Teste'])[1 + floor(random() * 3)::int],
      v_sort,
      '2025-12-05'::date + (floor(random() * 40)::int * interval '1 day'),
      '2026-02-20'::date,
      (64 + floor(random() * 28))::numeric(5,1),
      'Refinar audiências de corretores e formulários de captação; priorizar criativos com prova social CRECI.'
    )
    returning id into v_cid;

    insert into public.campaign_insights (report_id, campaign_id, title, detail, impact_label, insight_type, sort_order)
    values (
      v_report,
      v_cid,
      'Leads imobiliários — qualificação',
      'Separar leads de investidor x morador x corretor no CRM para ajustar oferta e follow-up do time comercial.',
      'Alto',
      'optimization',
      v_sort
    );

    v_sort := v_sort + 1;
  end loop;

  -- Google: compra / busca / PMax intenção
  foreach v_ext in array array[
    'IMOB-G-SRCH-101',
    'IMOB-G-PMAX-102',
    'IMOB-G-LOC-103',
    'IMOB-G-CRT-104',
    'IMOB-G-CAPT-105',
    'IMOB-G-NOVO-106',
    'IMOB-G-USADO-107',
    'IMOB-G-LANC-108'
  ]
  loop
    if exists (select 1 from public.campaigns where report_id = v_report and external_id = v_ext) then
      continue;
    end if;

    insert into public.campaigns (
      report_id, channel_id, external_id, name, invested, conversions, roas, status,
      sort_order, started_at, ended_at, efficiency_score, optimization_hint
    )
    values (
      v_report,
      v_google,
      v_ext,
      case v_ext
        when 'IMOB-G-SRCH-101' then 'Search — Comprar Apartamento Região Metropolitana'
        when 'IMOB-G-PMAX-102' then 'Performance Max — Leads Corretores e Proprietários'
        when 'IMOB-G-LOC-103' then 'Search — Alugar Imóvel Comercial'
        when 'IMOB-G-CRT-104' then 'Display Remarketing — Base Corretores Inativos'
        when 'IMOB-G-CAPT-105' then 'Search — Quero Vender Meu Imóvel'
        when 'IMOB-G-NOVO-106' then 'PMax — Lançamentos e Incorporação'
        when 'IMOB-G-USADO-107' then 'Search — Imóveis Usados Alto Padrão'
        when 'IMOB-G-LANC-108' then 'Search — Obra na Planta e Financiamento'
      end,
      (9000 + (random() * 14000))::numeric(12,2),
      (90 + floor(random() * 320))::int,
      (2.9 + random() * 2.6)::numeric(6,2),
      (array['Em Veiculação','Em Otimização','Pausada','Teste'])[1 + floor(random() * 4)::int],
      v_sort,
      '2025-12-01'::date + (floor(random() * 45)::int * interval '1 day'),
      '2026-02-26'::date,
      (58 + floor(random() * 32))::numeric(5,1),
      'Expandir termos de intenção (comprar, alugar, avaliar) e listas negativas de emprego curso.'
    )
    returning id into v_cid;

    insert into public.campaign_insights (report_id, campaign_id, title, detail, impact_label, insight_type, sort_order)
    values (
      v_report,
      v_cid,
      'Canal Google — intenção imobiliária',
      'Separar campanhas por intenção compra vs locação reduz CPL médio e melhora qualificação dos corretores.',
      'Médio',
      'opportunity',
      v_sort
    );

    v_sort := v_sort + 1;
  end loop;

  raise notice 'Append imobiliário/corretores concluído para report %.', v_report;
end $$;
