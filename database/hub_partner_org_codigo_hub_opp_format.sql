-- =============================================================================
-- Migração: código de rastreio de homologação → HUB-OPP-{IMB|ARQ|SRV|PRO}-YYYYMMDD-RAND
-- -----------------------------------------------------------------------------
-- Substitui o formato legado ORG-{seg}-{ano}-{seq6} e remove o segmento genérico HUB.
-- Aplicar no Supabase (SQL editor). Idempotente: CREATE OR REPLACE nas funções.
-- Mantém linhas antigas com ORG-*; novos pedidos passam a usar HUB-OPP-*.
-- =============================================================================

create or replace function public.hub_partner_kind_to_org_prefix(p_kind text)
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  k text := lower(trim(coalesce(p_kind, '')));
begin
  if k = '' or k = 'outro' then
    return 'SRV';
  end if;

  if k in ('imobiliaria', 'imobiliarios', 'parceiros_imobiliario') then
    return 'IMB';
  end if;
  if k in ('arquitetura', 'arquitetos', 'parceiros_arquitetura') then
    return 'ARQ';
  end if;
  if k in ('engenharia', 'engenharias') then
    return 'SRV';
  end if;
  if k in ('produtos', 'parceiros_produtos', 'parceiro_produtos') then
    return 'PRO';
  end if;
  if k in ('prestador_servicos', 'prestadores_servico', 'servicos', 'parceiros_servicos') then
    return 'SRV';
  end if;

  if k like '%imob%' then
    return 'IMB';
  end if;
  if k like '%arquit%' then
    return 'ARQ';
  end if;
  if k like '%engenh%' or k like '%prestador%' or (k like '%servic%' and k not like '%produt%') then
    return 'SRV';
  end if;
  if k like '%produt%' then
    return 'PRO';
  end if;

  return 'SRV';
end;
$$;

comment on function public.hub_partner_kind_to_org_prefix(text) is
  'Mercado IMB|ARQ|SRV|PRO para HUB-OPP-* (par com NEG/OPP).';

create or replace function public._next_org_codigo_rastreio(p_prefix text)
returns text
language plpgsql
as $$
declare
  v_seg text := upper(regexp_replace(coalesce(nullif(trim(p_prefix), ''), 'SRV'), '[^A-Z0-9]', '', 'g'));
  v_date text := to_char(timezone('utc', now()), 'YYYYMMDD');
  v_try text;
  v_n int := 0;
  v_rand text;
begin
  if length(v_seg) < 2 then
    v_seg := 'SRV';
  end if;
  v_seg := left(v_seg, 6);

  loop
    v_rand := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    v_try := format('HUB-OPP-%s-%s-%s', v_seg, v_date, v_rand);
    exit when not exists (select 1 from public.organizacoes x where x.codigo_rastreio = v_try)
      and not exists (select 1 from public.hub_partner_org_signups y where y.codigo_rastreio = v_try);
    v_n := v_n + 1;
    exit when v_n > 50;
  end loop;

  if v_n > 50 then
    v_try := format(
      'HUB-OPP-%s-%s-%s',
      v_seg,
      v_date,
      substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)
    );
  end if;

  return v_try;
end;
$$;

notify pgrst, 'reload schema';
