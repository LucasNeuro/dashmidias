-- =============================================================================
-- Fluxo de aprovação de cadastro público de organização (HUB)
-- -----------------------------------------------------------------------------
-- 1) Estende hub_partner_org_signups e organizacoes (código de rastreio interno).
-- 2) RPC hub_approve_partner_org_signup — cria organização, convite admin_org,
--    módulos licenciados; devolve token do convite (mostrar uma vez na UI).
-- 3) RPC hub_preview_org_invite — dados mínimos para página pública (sem auth).
-- 4) RPC hub_claim_org_invite — utilizador autenticado vincula-se à org (e-mail
--    deve coincidir com o convite).
--
-- Pré-requisitos: public.is_hub_admin(); tabelas organizacoes, organizacao_convites,
-- organizacao_membros, organizacao_modulos, modulos_catalogo, papel_template
-- conforme docs/CADASTRO_ORGANIZACOES_E_USUARIOS.md.
--
-- Após aplicar: conceder EXECUTE nas funções a authenticated (e preview a anon se
-- desejar leitura pública — aqui preview é security definer e pode ser chamada
-- por anon se adicionar GRANT).
-- =============================================================================

create extension if not exists pgcrypto;

-- Garantir colunas mínimas em organizacoes (ambientes antigos)
alter table public.organizacoes add column if not exists status text default 'em_onboarding';
alter table public.organizacoes add column if not exists tipo_organizacao text;
alter table public.organizacoes add column if not exists criado_em timestamptz default timezone('utc', now());
alter table public.organizacoes add column if not exists atualizado_em timestamptz default timezone('utc', now());

-- --- Colunas em hub_partner_org_signups -------------------------------------------------
alter table public.hub_partner_org_signups
  add column if not exists organizacao_id uuid references public.organizacoes (id) on delete set null;

alter table public.hub_partner_org_signups
  add column if not exists hub_convite_id uuid;

alter table public.hub_partner_org_signups
  add column if not exists modulos_concedidos jsonb;

alter table public.hub_partner_org_signups
  add column if not exists processado_em timestamptz;

alter table public.hub_partner_org_signups
  add column if not exists processado_por_user_id uuid references auth.users (id) on delete set null;

alter table public.hub_partner_org_signups
  add column if not exists codigo_rastreio text;

comment on column public.hub_partner_org_signups.codigo_rastreio is
  'Código HUB-OPP-[mercado]-dataUTC-sufixo (espelho de organizacoes.codigo_rastreio).';

comment on column public.hub_partner_org_signups.modulos_concedidos is
  'Snapshot dos slugs/códigos de módulos concedidos pelo HUB na aprovação.';

comment on column public.hub_partner_org_signups.hub_convite_id is
  'FK lógica para organizacao_convites.id (evitar dependência circular de FK).';

-- --- Colunas em organizacoes (código interno de rastreio, padrão doc HUB) ---------------
alter table public.organizacoes
  add column if not exists codigo_rastreio text;

create unique index if not exists organizacoes_codigo_rastreio_uidx
  on public.organizacoes (codigo_rastreio)
  where codigo_rastreio is not null;

comment on column public.organizacoes.codigo_rastreio is
  'Identificador interno (ex.: HUB-OPP-ARQ-20260424-A1B2C3D4) — ver docs/ESTRUTURA_CODIGOS_IDENTIFICADORES_HUB.md';

-- Ligar convite à coluna opcional (se a tabela já existir com PK id uuid)
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_schema = 'public'
      and table_name = 'organizacao_convites'
      and constraint_type = 'FOREIGN KEY'
      and constraint_name = 'hub_partner_org_signups_hub_convite_fk'
  ) then
    begin
      alter table public.hub_partner_org_signups
        add constraint hub_partner_org_signups_hub_convite_fk
        foreign key (hub_convite_id) references public.organizacao_convites (id) on delete set null;
    exception
      when duplicate_object then null;
      when undefined_table then null;
    end;
  end if;
end $$;

-- --- hub_partner_kind_to_org_prefix + _next_org_codigo_rastreio (espelho RPC pública) --
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

-- --- Slug único a partir do nome ---------------------------------------------------------
create or replace function public._slugify_org_name(p_nome text, p_suffix text)
returns text
language plpgsql
as $$
declare
  base text;
  s text;
begin
  base := lower(trim(coalesce(p_nome, 'org')));
  base := regexp_replace(base, '[^a-z0-9]+', '-', 'g');
  base := trim(both '-' from base);
  if base = '' or base is null then
    base := 'org';
  end if;
  base := left(base, 48);
  s := base || '-' || left(regexp_replace(coalesce(p_suffix, gen_random_uuid()::text), '[^a-z0-9]', '', 'g'), 8);
  return s;
end;
$$;

-- =============================================================================
-- RPC: Aprovar cadastro (admin HUB)
-- p_modulo_slugs: text[] com UUID de modulos_catalogo.id (como texto) — o catálogo actual pode não ter coluna codigo/slug
-- =============================================================================
create or replace function public.hub_approve_partner_org_signup(
  p_signup_id uuid,
  p_modulo_slugs text[] default array[]::text[],
  p_tipo_organizacao text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_uid uuid := auth.uid();
  s record;
  v_nome text;
  v_slug text;
  v_tipo text;
  v_prefix text;
  v_codigo text;
  v_org_id uuid;
  v_papel_admin uuid;
  v_email text;
  v_token text;
  v_hash text;
  v_convite_id uuid;
  v_mod text;
  m record;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  if not public.is_hub_admin() then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  select * into s from public.hub_partner_org_signups where id = p_signup_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'signup_not_found');
  end if;
  if s.status is distinct from 'pendente' then
    return jsonb_build_object('ok', false, 'error', 'signup_not_pending', 'status', s.status);
  end if;
  if s.organizacao_id is not null then
    return jsonb_build_object('ok', false, 'error', 'already_provisioned');
  end if;

  v_nome := coalesce(
    nullif(trim(s.dados_formulario ->> 'nome_empresa'), ''),
    nullif(trim(s.dados_formulario ->> 'nome'), ''),
    'Organização'
  );
  v_email := lower(trim(s.email));
  if v_email = '' then
    return jsonb_build_object('ok', false, 'error', 'email_required');
  end if;

  v_tipo := coalesce(nullif(trim(p_tipo_organizacao), ''), nullif(trim(s.partner_kind), ''), 'outro');
  v_prefix := public.hub_partner_kind_to_org_prefix(v_tipo);

  -- Reutilizar código já reservado no pedido (RPC hub_submit_partner_org_signup), se existir.
  v_codigo := nullif(trim(coalesce(s.codigo_rastreio::text, '')), '');
  if v_codigo is null then
    v_codigo := public._next_org_codigo_rastreio(v_prefix);
  end if;
  v_slug := public._slugify_org_name(v_nome, p_signup_id::text);

  select id into v_papel_admin
  from public.papel_template
  where codigo = 'admin_organizacao'
  limit 1;
  if v_papel_admin is null then
    return jsonb_build_object('ok', false, 'error', 'papel_admin_organizacao_missing');
  end if;

  -- Bloco com EXCEPTION reverte inserts em caso de falha (transação atómica).
  begin
    insert into public.organizacoes (
      nome,
      slug,
      status,
      tipo_organizacao,
      criado_por_user_id,
      codigo_rastreio
    )
    values (
      v_nome,
      v_slug,
      'em_onboarding',
      v_tipo,
      v_uid,
      v_codigo
    )
    returning id into v_org_id;

    if p_modulo_slugs is not null and array_length(p_modulo_slugs, 1) > 0 then
      foreach v_mod in array p_modulo_slugs
      loop
        for m in
          select mc.id as mid
          from public.modulos_catalogo mc
          where mc.id::text = trim(v_mod)
          limit 1
        loop
          begin
            insert into public.organizacao_modulos (organizacao_id, modulo_id, ativo)
            values (v_org_id, m.mid, true);
          exception
            when unique_violation then
              update public.organizacao_modulos om
              set ativo = true
              where om.organizacao_id = v_org_id and om.modulo_id = m.mid;
          end;
        end loop;
      end loop;
    end if;

    v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
    v_hash := encode(digest(v_token, 'sha256'), 'hex');

    insert into public.organizacao_convites (
      organizacao_id,
      email,
      token_hash,
      papel_id,
      expira_em,
      criado_por_escopo,
      criado_por_user_id
    )
    values (
      v_org_id,
      v_email,
      v_hash,
      v_papel_admin,
      timezone('utc', now()) + interval '30 days',
      'hub',
      v_uid
    )
    returning id into v_convite_id;

    update public.hub_partner_org_signups
    set
      status = 'processado',
      organizacao_id = v_org_id,
      hub_convite_id = v_convite_id,
      codigo_rastreio = v_codigo,
      modulos_concedidos = to_jsonb(coalesce(p_modulo_slugs, array[]::text[])),
      processado_em = timezone('utc', now()),
      processado_por_user_id = v_uid,
      workflow_etapa = null,
      workflow_etapa_em = timezone('utc', now())
    where id = p_signup_id;

    return jsonb_build_object(
      'ok', true,
      'organizacao_id', v_org_id,
      'codigo_rastreio', v_codigo,
      'slug', v_slug,
      'convite_id', v_convite_id,
      'invite_token', v_token,
      'email', v_email
    );
  exception
    when others then
      return jsonb_build_object('ok', false, 'error', 'sql_error', 'detail', sqlerrm);
  end;
end;
$$;

comment on function public.hub_approve_partner_org_signup(uuid, text[], text) is
  'Admin HUB: provisiona organização, módulos e convite admin_organizacao; marca signup como processado.';

revoke all on function public.hub_approve_partner_org_signup(uuid, text[], text) from public;
grant execute on function public.hub_approve_partner_org_signup(uuid, text[], text) to authenticated;

-- =============================================================================
-- Preview público (token na URL)
-- =============================================================================
create or replace function public.hub_preview_org_invite(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_hash text;
  c record;
  o record;
begin
  if p_token is null or length(trim(p_token)) < 16 then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;
  v_hash := encode(digest(trim(p_token), 'sha256'), 'hex');

  select c.organizacao_id, c.email, c.expira_em, c.usado_em
  into c
  from public.organizacao_convites c
  where c.token_hash = v_hash
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if c.usado_em is not null then
    return jsonb_build_object('ok', false, 'error', 'already_used');
  end if;
  if c.expira_em < timezone('utc', now()) then
    return jsonb_build_object('ok', false, 'error', 'expired');
  end if;

  select o.nome, o.slug, o.codigo_rastreio
  into o
  from public.organizacoes o
  where o.id = c.organizacao_id;

  return jsonb_build_object(
    'ok', true,
    'organizacao_nome', o.nome,
    'organizacao_slug', o.slug,
    'codigo_rastreio', o.codigo_rastreio,
    'email_convite', c.email
  );
end;
$$;

revoke all on function public.hub_preview_org_invite(text) from public;
grant execute on function public.hub_preview_org_invite(text) to anon, authenticated;

-- =============================================================================
-- Vincular utilizador autenticado ao convite
-- =============================================================================
create or replace function public.hub_claim_org_invite(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_uid uuid := auth.uid();
  v_hash text;
  c record;
  uemail text;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  if p_token is null or length(trim(p_token)) < 16 then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  select email into uemail from auth.users where id = v_uid;
  v_hash := encode(digest(trim(p_token), 'sha256'), 'hex');

  select *
  into c
  from public.organizacao_convites
  where token_hash = v_hash
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if c.usado_em is not null then
    return jsonb_build_object('ok', false, 'error', 'already_used');
  end if;
  if c.expira_em < timezone('utc', now()) then
    return jsonb_build_object('ok', false, 'error', 'expired');
  end if;
  if lower(trim(uemail)) is distinct from lower(trim(c.email)) then
    return jsonb_build_object('ok', false, 'error', 'email_mismatch');
  end if;

  begin
    insert into public.organizacao_membros (organizacao_id, user_id, papel_id)
    values (c.organizacao_id, v_uid, c.papel_id);
  exception
    when unique_violation then
      update public.organizacao_membros m
      set papel_id = c.papel_id
      where m.organizacao_id = c.organizacao_id and m.user_id = v_uid;
  end;

  update public.organizacao_convites
  set usado_em = timezone('utc', now()), usado_por_user_id = v_uid
  where id = c.id;

  return jsonb_build_object('ok', true, 'organizacao_id', c.organizacao_id);
exception
  when others then
    return jsonb_build_object('ok', false, 'error', 'sql_error', 'detail', sqlerrm);
end;
$$;

revoke all on function public.hub_claim_org_invite(text) from public;
grant execute on function public.hub_claim_org_invite(text) to authenticated;
