-- =============================================================================
-- Cadastro público com código HUB-OPP-* reservado + acompanhamento (sem auth)
-- -----------------------------------------------------------------------------
-- 1) _next_org_codigo_rastreio — gera HUB-OPP-{IMB|ARQ|SRV|PRO}-{YYYYMMDD}-{8hex}
--    único (organizações + pedidos); colisão → novo sufixo aleatório.
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

-- Um documento (CNPJ/CPF na coluna cnpj) só pode ter um pedido activo (pendente,
-- aprovado ou processado). Rejeitado não entra — permite novo pedido após rejeição.
-- Migração incremental: database/hub_partner_org_signup_document_uniqueness.sql
-- Se der 23505, dedupe + ver hub_partner_org_signups_dedupe_pending_before_unique.sql
create unique index if not exists hub_partner_org_signups_one_active_per_doc
  on public.hub_partner_org_signups (cnpj)
  where (status = any (array['pendente'::text, 'aprovado'::text, 'processado'::text]));

comment on column public.hub_partner_org_signups.codigo_rastreio is
  'Código HUB-OPP-[mercado]-dataUTC-sufixo: reservado ao submeter (RPC); espelho em organizacoes.codigo_rastreio após provisionar.';

-- --- Código HUB-OPP-{SEG}-{YYYYMMDD}-{RAND} (organizações + pedidos) ---------------
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

-- --- Segmento IMB|ARQ|SRV|PRO a partir de partner_kind (alinhado a NEG/OPP) --------
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

  -- Convites antigos / labels: reforça ARQ para links de arquitetos mal gravados
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
      and s.status = any (array['pendente'::text, 'aprovado'::text, 'processado'::text])
  ) then
    return jsonb_build_object('ok', false, 'error', 'duplicate_document');
  end if;

  v_tipo := coalesce(nullif(trim(p_partner_kind), ''), 'outro');
  v_prefix := public.hub_partner_kind_to_org_prefix(v_tipo);

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
    codigo_rastreio,
    workflow_etapa,
    workflow_etapa_em
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
    v_codigo,
    'pendente',
    timezone('utc', now())
  )
  returning id into v_id;

  insert into public.hub_partner_org_signup_timeline (signup_id, evento, rotulo_publico)
  values (v_id, 'sistema', 'Pedido de cadastro recebido com sucesso.');

  return jsonb_build_object(
    'ok', true,
    'signup_id', v_id,
    'codigo_rastreio', v_codigo
  );
exception
  when unique_violation then
    if sqlerrm ilike '%hub_partner_org_signups_one_active_per_doc%'
      or sqlerrm ilike '%hub_partner_org_signups_one_pending_per_doc%' then
      return jsonb_build_object('ok', false, 'error', 'duplicate_document', 'detail', sqlerrm);
    end if;
    return jsonb_build_object('ok', false, 'error', 'duplicate_codigo', 'detail', sqlerrm);
  when others then
    return jsonb_build_object('ok', false, 'error', 'sql_error', 'detail', sqlerrm);
end;
$$;

comment on function public.hub_submit_partner_org_signup(text, text, jsonb, jsonb, text, text, text) is
  'Cadastro público de parceiro: insere pedido pendente e reserva codigo_rastreio HUB-OPP-*; bloqueia documento já em pedido activo.';

-- Disponibilidade do documento no formulário (anon)
create or replace function public.hub_check_partner_org_signup_document(p_doc text)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_doc text := regexp_replace(trim(coalesce(p_doc, '')), '\D', '', 'g');
begin
  if length(v_doc) not in (11, 14) then
    return jsonb_build_object('ok', false, 'error', 'invalid_document');
  end if;

  if exists (
    select 1
    from public.hub_partner_org_signups s
    where s.cnpj = v_doc
      and s.status = any (array['pendente'::text, 'aprovado'::text, 'processado'::text])
  ) then
    return jsonb_build_object('ok', true, 'available', false);
  end if;

  return jsonb_build_object('ok', true, 'available', true);
end;
$$;

comment on function public.hub_check_partner_org_signup_document(text) is
  'Anónimo: indica se CNPJ (14) ou CPF (11) já está em pedido pendente/aprovado/processado.';

revoke all on function public.hub_check_partner_org_signup_document(text) from public;
grant execute on function public.hub_check_partner_org_signup_document(text) to anon, authenticated;

revoke all on function public.hub_submit_partner_org_signup(text, text, jsonb, jsonb, text, text, text) from public;
grant execute on function public.hub_submit_partner_org_signup(text, text, jsonb, jsonb, text, text, text) to anon, authenticated;

-- =============================================================================
-- Estado público do pedido (por código HUB-OPP-* / legado ORG-* ou UUID)
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
  v_wf text;
  v_tl jsonb;
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
    s.workflow_etapa,
    s.workflow_etapa_em,
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
  v_wf := r.workflow_etapa;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', t.id,
        'rotulo', t.rotulo_publico,
        'criado_em', t.criado_em,
        'evento', t.evento
      )
      order by t.criado_em asc
    ),
    '[]'::jsonb
  )
  into v_tl
  from public.hub_partner_org_signup_timeline t
  where t.signup_id = r.id;

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
    v_etapa := coalesce(nullif(trim(v_wf), ''), 'pendente');
    v_etapa_ordem := case coalesce(nullif(trim(v_wf), ''), 'pendente')
      when 'pendente' then 1
      when 'aguardando_retorno' then 2
      when 'em_analise' then 3
      when 'aprovado' then 4
      else 1
    end;
  end if;

  return jsonb_build_object(
    'ok', true,
    'signup_id', r.id,
    'codigo_rastreio', r.codigo_rastreio,
    'nome_empresa', v_nome,
    'status', r.status,
    'workflow_etapa', v_wf,
    'etapa', v_etapa,
    'etapa_ordem', v_etapa_ordem,
    'criado_em', r.criado_em,
    'processado_em', r.processado_em,
    'workflow_etapa_em', r.workflow_etapa_em,
    'organizacao_criada', r.organizacao_id is not null,
    'convite_gerado', r.hub_convite_id is not null,
    'timeline', coalesce(v_tl, '[]'::jsonb)
  );
end;
$$;

comment on function public.hub_public_homologacao_status(text) is
  'Leitura pública mínima do pedido de homologação por codigo_rastreio ou id do pedido.';

revoke all on function public.hub_public_homologacao_status(text) from public;
grant execute on function public.hub_public_homologacao_status(text) to anon, authenticated;

-- Recarrega o schema exposto pela API (evita “schema cache” desactualizado após CREATE FUNCTION).
notify pgrst, 'reload schema';
