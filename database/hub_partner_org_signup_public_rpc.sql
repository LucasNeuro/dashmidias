-- =============================================================================
-- Cadastro público com código ORG-* reservado + acompanhamento (sem auth)
-- -----------------------------------------------------------------------------
-- 1) _next_org_codigo_rastreio — passa a considerar organizacoes E hub_partner_org_signups
--    (códigos já reservados no pedido contam para a sequência).
-- 2) hub_submit_partner_org_signup — insert SECURITY DEFINER (substitui insert directo
--    anónimo quando o front usa esta RPC).
-- 3) hub_public_homologacao_status — leitura mínima por código para página pública.
--
-- Pré-requisito: tabela hub_partner_org_signups (hub_partner_org_signups.sql) e
-- coluna codigo_rastreio opcional (hub_partner_org_approve_and_invite.sql).
-- Após aplicar: atualizar hub_approve_partner_org_signup para reutilizar código já
-- reservado (ver alteração no mesmo ficheiro hub_partner_org_approve_and_invite.sql).
-- =============================================================================

-- Índice único parcial: um código de acompanhamento por pedido
create unique index if not exists hub_partner_org_signups_codigo_rastreio_uidx
  on public.hub_partner_org_signups (codigo_rastreio)
  where codigo_rastreio is not null;

-- Evita dois pedidos pendentes com o mesmo documento (CNPJ/CPF na coluna cnpj).
-- Se der 23505 por duplicados existentes, execute primeiro:
--   database/hub_partner_org_signups_dedupe_pending_before_unique.sql
create unique index if not exists hub_partner_org_signups_one_pending_per_doc
  on public.hub_partner_org_signups (cnpj)
  where status = 'pendente';

comment on column public.hub_partner_org_signups.codigo_rastreio is
  'Código ORG-[mercado]-ano-seq: reservado ao submeter o pedido (RPC); repetido em organizacoes.codigo_rastreio após provisionar.';

-- --- Sequência ORG-* partilhada (organizações + pedidos) -------------------------------
create or replace function public._next_org_codigo_rastreio(p_prefix text)
returns text
language plpgsql
as $$
declare
  v_year text := to_char(timezone('utc', now()), 'YYYY');
  v_prefix text := upper(regexp_replace(coalesce(nullif(trim(p_prefix), ''), 'HUB'), '[^A-Z0-9]', '', 'g'));
  v_seq int;
  v_try text;
  v_n int := 0;
  v_pat text;
begin
  if length(v_prefix) < 2 then
    v_prefix := 'HUB';
  end if;
  v_prefix := left(v_prefix, 6);
  v_pat := '^ORG-' || v_prefix || '-' || v_year || '-[0-9]{6}$';

  loop
    select
      coalesce((
        select count(*)::int
        from public.organizacoes o
        where o.codigo_rastreio is not null
          and o.codigo_rastreio ~ v_pat
      ), 0)
      + coalesce((
        select count(*)::int
        from public.hub_partner_org_signups s
        where s.codigo_rastreio is not null
          and s.codigo_rastreio ~ v_pat
      ), 0)
      + 1
    into v_seq;

    v_try := format('ORG-%s-%s-%s', v_prefix, v_year, lpad(v_seq::text, 6, '0'));
    exit when not exists (select 1 from public.organizacoes x where x.codigo_rastreio = v_try)
      and not exists (select 1 from public.hub_partner_org_signups y where y.codigo_rastreio = v_try);
    v_n := v_n + 1;
    exit when v_n > 50;
  end loop;

  if v_n > 50 then
    v_try := format('ORG-%s-%s-%s', v_prefix, v_year, substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
  end if;

  return v_try;
end;
$$;

-- =============================================================================
-- Submissão pública (gera codigo_rastreio no pedido)
-- =============================================================================
create or replace function public.hub_submit_partner_org_signup(
  p_email text,
  p_cnpj text,
  p_dados_formulario jsonb,
  p_cnpja_snapshot jsonb default null,
  p_consulta_fonte text default null,
  p_template_id text default null,
  p_partner_kind text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_doc text := trim(coalesce(p_cnpj, ''));
  v_tipo text;
  v_prefix text;
  v_codigo text;
  v_id uuid;
begin
  if v_email = '' or position('@' in v_email) = 0 then
    return jsonb_build_object('ok', false, 'error', 'email_invalid');
  end if;
  if v_doc = '' then
    return jsonb_build_object('ok', false, 'error', 'document_required');
  end if;
  if p_dados_formulario is null or jsonb_typeof(p_dados_formulario) != 'object' then
    return jsonb_build_object('ok', false, 'error', 'dados_required');
  end if;

  if exists (
    select 1
    from public.hub_partner_org_signups s
    where s.cnpj = v_doc
      and s.status = 'pendente'
  ) then
    return jsonb_build_object('ok', false, 'error', 'duplicate_pending_signup');
  end if;

  v_tipo := coalesce(nullif(trim(p_partner_kind), ''), 'outro');
  v_prefix := case lower(v_tipo)
    when 'imobiliaria' then 'IMB'
    when 'arquitetura' then 'ARQ'
    when 'produtos' then 'PRO'
    when 'prestador_servicos' then 'SRV'
    when 'servicos' then 'SRV'
    else 'HUB'
  end;

  v_codigo := public._next_org_codigo_rastreio(v_prefix);

  insert into public.hub_partner_org_signups (
    email,
    cnpj,
    dados_formulario,
    cnpja_snapshot,
    consulta_fonte,
    template_id,
    partner_kind,
    status,
    codigo_rastreio
  )
  values (
    v_email,
    v_doc,
    p_dados_formulario,
    p_cnpja_snapshot,
    nullif(trim(p_consulta_fonte), ''),
    nullif(trim(p_template_id), ''),
    nullif(trim(p_partner_kind), ''),
    'pendente',
    v_codigo
  )
  returning id into v_id;

  return jsonb_build_object(
    'ok', true,
    'signup_id', v_id,
    'codigo_rastreio', v_codigo
  );
exception
  when unique_violation then
    if sqlerrm ilike '%hub_partner_org_signups_one_pending_per_doc%' then
      return jsonb_build_object('ok', false, 'error', 'duplicate_pending_signup', 'detail', sqlerrm);
    end if;
    return jsonb_build_object('ok', false, 'error', 'duplicate_codigo', 'detail', sqlerrm);
  when others then
    return jsonb_build_object('ok', false, 'error', 'sql_error', 'detail', sqlerrm);
end;
$$;

comment on function public.hub_submit_partner_org_signup(text, text, jsonb, jsonb, text, text, text) is
  'Cadastro público de parceiro: insere pedido pendente e reserva codigo_rastreio ORG-* para acompanhamento.';

revoke all on function public.hub_submit_partner_org_signup(text, text, jsonb, jsonb, text, text, text) from public;
grant execute on function public.hub_submit_partner_org_signup(text, text, jsonb, jsonb, text, text, text) to anon, authenticated;

-- =============================================================================
-- Estado público do pedido (por código ORG-* ou UUID do pedido)
-- =============================================================================
create or replace function public.hub_public_homologacao_status(p_ref text)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  r record;
  v_ref text := trim(coalesce(p_ref, ''));
  v_etapa text;
  v_etapa_ordem int;
  v_nome text;
begin
  if v_ref = '' then
    return jsonb_build_object('ok', false, 'error', 'ref_required');
  end if;

  select
    s.id,
    s.status,
    s.criado_em,
    s.processado_em,
    s.codigo_rastreio,
    s.organizacao_id,
    s.hub_convite_id,
    coalesce(nullif(trim(s.dados_formulario ->> 'nome_empresa'), ''), nullif(trim(s.dados_formulario ->> 'nome'), ''), '—') as nome_empresa
  into r
  from public.hub_partner_org_signups s
  where s.codigo_rastreio = v_ref
     or s.id::text = v_ref
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  v_nome := r.nome_empresa;

  if r.status = 'rejeitado' then
    v_etapa := 'decisao';
    v_etapa_ordem := 4;
  elsif r.status = 'processado' or r.organizacao_id is not null then
    v_etapa := 'provisionado';
    v_etapa_ordem := 5;
  elsif r.status = 'aprovado' then
    v_etapa := 'aprovado_legado';
    v_etapa_ordem := 4;
  else
    v_etapa := 'analise';
    v_etapa_ordem := 3;
  end if;

  return jsonb_build_object(
    'ok', true,
    'signup_id', r.id,
    'codigo_rastreio', r.codigo_rastreio,
    'nome_empresa', v_nome,
    'status', r.status,
    'etapa', v_etapa,
    'etapa_ordem', v_etapa_ordem,
    'criado_em', r.criado_em,
    'processado_em', r.processado_em,
    'organizacao_criada', r.organizacao_id is not null,
    'convite_gerado', r.hub_convite_id is not null
  );
end;
$$;

comment on function public.hub_public_homologacao_status(text) is
  'Leitura pública mínima do pedido de homologação por codigo_rastreio ou id do pedido.';

revoke all on function public.hub_public_homologacao_status(text) from public;
grant execute on function public.hub_public_homologacao_status(text) to anon, authenticated;

-- Recarrega o schema exposto pela API (evita “schema cache” desactualizado após CREATE FUNCTION).
notify pgrst, 'reload schema';
