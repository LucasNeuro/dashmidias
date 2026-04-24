-- =============================================================================
-- Chat de homologação (parceiro ↔ equipa HUB), ligado ao pedido em
-- hub_partner_org_signups. Leitura/escrita pública só via RPC (SECURITY DEFINER).
-- =============================================================================

create table if not exists public.hub_homologacao_mensagens (
  id uuid primary key default gen_random_uuid(),
  signup_id uuid not null references public.hub_partner_org_signups (id) on delete cascade,
  direcao text not null check (direcao = any (array['parceiro'::text, 'hub'::text])),
  corpo text not null,
  criado_em timestamptz not null default now(),
  criado_por_user_id uuid null,
  constraint hub_homologacao_mensagens_corpo_len check (
    char_length(trim(corpo)) > 0
    and char_length(corpo) <= 8000
  )
);

create index if not exists hub_homologacao_mensagens_signup_criado
  on public.hub_homologacao_mensagens (signup_id, criado_em);

comment on table public.hub_homologacao_mensagens is
  'Mensagens do chat de homologação; signup_id liga ao pedido público até provisionar.';

alter table public.hub_homologacao_mensagens enable row level security;

-- Sem políticas de leitura/escrita directa para anon: só RPCs abaixo.

-- -----------------------------------------------------------------------------
-- Listar mensagens (público)
-- -----------------------------------------------------------------------------
create or replace function public.hub_public_homologacao_list_messages(
  p_ref text,
  p_limit int default 200
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_ref text := trim(coalesce(p_ref, ''));
  v_sid uuid;
  v_lim int := least(greatest(coalesce(p_limit, 200), 1), 500);
  arr jsonb;
begin
  if v_ref = '' then
    return jsonb_build_object('ok', false, 'error', 'ref_required');
  end if;

  select s.id into v_sid
  from public.hub_partner_org_signups s
  where s.codigo_rastreio = v_ref
     or s.id::text = v_ref
  limit 1;

  if v_sid is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', t.id,
        'direcao', t.direcao,
        'corpo', t.corpo,
        'criado_em', t.criado_em
      )
      order by t.criado_em
    ),
    '[]'::jsonb
  )
  into arr
  from (
    select m.id, m.direcao, m.corpo, m.criado_em
    from public.hub_homologacao_mensagens m
    where m.signup_id = v_sid
    order by m.criado_em asc
    limit v_lim
  ) t;

  return jsonb_build_object('ok', true, 'messages', coalesce(arr, '[]'::jsonb));
end;
$$;

revoke all on function public.hub_public_homologacao_list_messages(text, int) from public;
grant execute on function public.hub_public_homologacao_list_messages(text, int) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Enviar mensagem como parceiro (público)
-- -----------------------------------------------------------------------------
create or replace function public.hub_public_homologacao_send_message(
  p_ref text,
  p_corpo text
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_ref text := trim(coalesce(p_ref, ''));
  v_body text := trim(coalesce(p_corpo, ''));
  v_sid uuid;
  st text;
  v_id uuid;
begin
  if v_ref = '' then
    return jsonb_build_object('ok', false, 'error', 'ref_required');
  end if;
  if v_body = '' or char_length(v_body) > 8000 then
    return jsonb_build_object('ok', false, 'error', 'message_invalid');
  end if;

  select s.id, s.status into v_sid, st
  from public.hub_partner_org_signups s
  where s.codigo_rastreio = v_ref
     or s.id::text = v_ref
  limit 1;

  if v_sid is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if st = 'rejeitado' or st = 'processado' then
    return jsonb_build_object('ok', false, 'error', 'chat_closed');
  end if;

  insert into public.hub_homologacao_mensagens (signup_id, direcao, corpo, criado_por_user_id)
  values (v_sid, 'parceiro', v_body, null)
  returning id into v_id;

  return jsonb_build_object('ok', true, 'message_id', v_id);
exception
  when check_violation then
    return jsonb_build_object('ok', false, 'error', 'message_invalid');
  when others then
    return jsonb_build_object('ok', false, 'error', 'sql_error', 'detail', sqlerrm);
end;
$$;

revoke all on function public.hub_public_homologacao_send_message(text, text) from public;
grant execute on function public.hub_public_homologacao_send_message(text, text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Responder como equipa HUB (autenticado + is_hub_admin)
-- -----------------------------------------------------------------------------
create or replace function public.hub_homologacao_hub_reply(
  p_signup_id uuid,
  p_corpo text
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_uid uuid := auth.uid();
  v_body text := trim(coalesce(p_corpo, ''));
  v_id uuid;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  if not public.is_hub_admin() then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  if p_signup_id is null then
    return jsonb_build_object('ok', false, 'error', 'signup_required');
  end if;
  if v_body = '' or char_length(v_body) > 8000 then
    return jsonb_build_object('ok', false, 'error', 'message_invalid');
  end if;

  if not exists (select 1 from public.hub_partner_org_signups s where s.id = p_signup_id) then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  insert into public.hub_homologacao_mensagens (signup_id, direcao, corpo, criado_por_user_id)
  values (p_signup_id, 'hub', v_body, v_uid)
  returning id into v_id;

  return jsonb_build_object('ok', true, 'message_id', v_id);
exception
  when check_violation then
    return jsonb_build_object('ok', false, 'error', 'message_invalid');
  when others then
    return jsonb_build_object('ok', false, 'error', 'sql_error', 'detail', sqlerrm);
end;
$$;

revoke all on function public.hub_homologacao_hub_reply(uuid, text) from public;
grant execute on function public.hub_homologacao_hub_reply(uuid, text) to authenticated;

comment on function public.hub_public_homologacao_list_messages(text, int) is
  'Lista mensagens do chat de homologação por codigo_rastreio ou id do pedido.';
comment on function public.hub_public_homologacao_send_message(text, text) is
  'Parceiro envia mensagem no chat (pedido não rejeitado nem já processado).';
comment on function public.hub_homologacao_hub_reply(uuid, text) is
  'Admin HUB responde no chat de homologação.';

-- Anexos, bucket e histórico de documentos: aplicar a seguir
-- database/hub_homologacao_documentos.sql (substitui list_messages / send_message / hub_reply por versões com anexos).

notify pgrst, 'reload schema';
