-- =============================================================================
-- Documentos / anexos da homologação (Storage + registo na base)
-- -----------------------------------------------------------------------------
-- Bucket: hub_homologacao_documentos (privado). Caminhos: homologacao/{signup_id}/{uuid}_{ficheiro}
-- Tabela: hub_homologacao_documentos (histórico por pedido; organizacao_id sincronizado após provisionar)
-- Mensagens: coluna anexos (jsonb) com metadados para o chat
--
-- Front: VITE_HUB_HOMOLOG_DOCS_BUCKET=hub_homologacao_documentos (opcional; defeito no JS)
--
-- Pré-requisitos: hub_homologacao_chat.sql, hub_partner_org_signups, public.organizacoes,
-- e coluna hub_partner_org_signups.organizacao_id (ex.: hub_partner_org_approve_and_invite.sql).
-- =============================================================================

alter table public.hub_partner_org_signups
  add column if not exists organizacao_id uuid references public.organizacoes (id) on delete set null;

-- --- Bucket ------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('hub_homologacao_documentos', 'hub_homologacao_documentos', false)
on conflict (id) do nothing;

drop policy if exists "hub_homolog_docs_insert_anon" on storage.objects;
create policy "hub_homolog_docs_insert_anon"
on storage.objects
for insert
to anon
with check (
  bucket_id = 'hub_homologacao_documentos'
  and name ~ '^homologacao/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/'
);

drop policy if exists "hub_homolog_docs_insert_authenticated" on storage.objects;
create policy "hub_homolog_docs_insert_authenticated"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'hub_homologacao_documentos'
  and name ~ '^homologacao/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/'
);

-- NOTA: a política SELECT que referencia hub_homologacao_documentos fica *depois* do CREATE TABLE.

-- --- Tabela documentos -------------------------------------------------------
create table if not exists public.hub_homologacao_documentos (
  id uuid primary key default gen_random_uuid(),
  signup_id uuid not null references public.hub_partner_org_signups (id) on delete cascade,
  organizacao_id uuid null references public.organizacoes (id) on delete set null,
  bucket_id text not null default 'hub_homologacao_documentos',
  storage_path text not null,
  nome_original text not null,
  mime_type text,
  tamanho_bytes bigint,
  origem text not null check (origem = any (array['parceiro'::text, 'hub'::text])),
  mensagem_id uuid null references public.hub_homologacao_mensagens (id) on delete set null,
  criado_em timestamptz not null default now(),
  criado_por_user_id uuid null,
  constraint hub_homologacao_documentos_path_bucket unique (bucket_id, storage_path)
);

create index if not exists hub_homologacao_documentos_signup on public.hub_homologacao_documentos (signup_id, criado_em desc);
create index if not exists hub_homologacao_documentos_org on public.hub_homologacao_documentos (organizacao_id);

comment on table public.hub_homologacao_documentos is
  'Anexos da homologação (contratos, PDFs, imagens); ligados ao pedido e opcionalmente à organização provisionada.';

alter table public.hub_homologacao_documentos enable row level security;

-- Sem SELECT directo na tabela via API: listagem só por RPC.
-- A política de Storage abaixo precisa de ver linhas em hub_homologacao_documentos; com RLS activo
-- e sem política SELECT, a subquery EXISTS não via nada e createSignedUrl falhava.

create or replace function public.hub_homologacao_storage_path_is_registered(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.hub_homologacao_documentos d
    where d.storage_path = p_object_name
      and d.bucket_id = 'hub_homologacao_documentos'
  );
$$;

revoke all on function public.hub_homologacao_storage_path_is_registered(text) from public;
grant execute on function public.hub_homologacao_storage_path_is_registered(text) to anon, authenticated;

comment on function public.hub_homologacao_storage_path_is_registered(text) is
  'Usada na política RLS de storage.objects; confirma registo do path sem expor SELECT na tabela à API.';

-- Leitura Storage: ficheiro tem de existir no registo (evita adivinhação de path)
drop policy if exists "hub_homolog_docs_select_registered" on storage.objects;
create policy "hub_homolog_docs_select_registered"
on storage.objects
for select
to anon, authenticated
using (
  bucket_id = 'hub_homologacao_documentos'
  and public.hub_homologacao_storage_path_is_registered(name)
);

-- --- Mensagens: anexos + constraint corpo OU ficheiros ----------------------
alter table public.hub_homologacao_mensagens
  add column if not exists anexos jsonb not null default '[]'::jsonb;

alter table public.hub_homologacao_mensagens
  drop constraint if exists hub_homologacao_mensagens_corpo_len;

alter table public.hub_homologacao_mensagens
  add constraint hub_homologacao_mensagens_corpo_ou_anexos check (
    (
      char_length(trim(corpo)) >= 1
      and char_length(corpo) <= 8000
    )
    or coalesce(jsonb_array_length(anexos), 0) > 0
  );

-- --- Sincronizar organizacao_id nos documentos quando o pedido é provisionado
create or replace function public.hub_homologacao_doc_sync_org()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and new.organizacao_id is not null
     and new.organizacao_id is distinct from old.organizacao_id then
    update public.hub_homologacao_documentos
    set organizacao_id = new.organizacao_id
    where signup_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_hub_homologacao_doc_sync_org on public.hub_partner_org_signups;
create trigger trg_hub_homologacao_doc_sync_org
  after update of organizacao_id on public.hub_partner_org_signups
  for each row
  execute function public.hub_homologacao_doc_sync_org();

-- =============================================================================
-- Preparar caminho de upload (público)
-- =============================================================================
create or replace function public.hub_public_homologacao_prepare_upload(
  p_ref text,
  p_filename text,
  p_mime text,
  p_size bigint
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
  st text;
  v_safe text;
  v_path text;
  v_mime text := lower(trim(coalesce(p_mime, '')));
  v_max bigint := 15 * 1024 * 1024;
begin
  if v_ref = '' then
    return jsonb_build_object('ok', false, 'error', 'ref_required');
  end if;
  if p_size is null or p_size < 1 or p_size > v_max then
    return jsonb_build_object('ok', false, 'error', 'size_invalid');
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

  if v_mime not in (
    'application/pdf',
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) then
    return jsonb_build_object('ok', false, 'error', 'mime_not_allowed');
  end if;

  v_safe := regexp_replace(coalesce(p_filename, ''), '[^a-zA-Z0-9._\- ]', '_', 'g');
  v_safe := left(nullif(trim(v_safe), ''), 160);
  if v_safe is null then
    v_safe := 'documento';
  end if;

  v_path := format('homologacao/%s/%s_%s', v_sid, gen_random_uuid(), v_safe);

  return jsonb_build_object(
    'ok', true,
    'bucket', 'hub_homologacao_documentos',
    'path', v_path
  );
end;
$$;

revoke all on function public.hub_public_homologacao_prepare_upload(text, text, text, bigint) from public;
grant execute on function public.hub_public_homologacao_prepare_upload(text, text, text, bigint) to anon, authenticated;

-- =============================================================================
-- Listar documentos do pedido (público / admin via mesma RPC)
-- =============================================================================
create or replace function public.hub_public_homologacao_list_documents(p_ref text)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_ref text := trim(coalesce(p_ref, ''));
  v_sid uuid;
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
        'id', d.id,
        'nome_original', d.nome_original,
        'mime_type', d.mime_type,
        'tamanho_bytes', d.tamanho_bytes,
        'origem', d.origem,
        'storage_path', d.storage_path,
        'bucket_id', d.bucket_id,
        'criado_em', d.criado_em,
        'mensagem_id', d.mensagem_id
      )
      order by d.criado_em desc
    ),
    '[]'::jsonb
  )
  into arr
  from public.hub_homologacao_documentos d
  where d.signup_id = v_sid;

  return jsonb_build_object('ok', true, 'documentos', coalesce(arr, '[]'::jsonb));
end;
$$;

revoke all on function public.hub_public_homologacao_list_documents(text) from public;
grant execute on function public.hub_public_homologacao_list_documents(text) to anon, authenticated;

-- =============================================================================
-- Listar mensagens (inclui anexos)
-- =============================================================================
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
        'anexos', coalesce(t.anexos, '[]'::jsonb),
        'criado_em', t.criado_em
      )
      order by t.criado_em
    ),
    '[]'::jsonb
  )
  into arr
  from (
    select m.id, m.direcao, m.corpo, m.anexos, m.criado_em
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

-- =============================================================================
-- Enviar mensagem (parceiro) com anexos opcionais
-- =============================================================================
drop function if exists public.hub_public_homologacao_send_message(text, text);

create or replace function public.hub_public_homologacao_send_message(
  p_ref text,
  p_corpo text,
  p_anexos jsonb default '[]'::jsonb
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
  v_org_id uuid;
  v_prefix text;
  v_anexos_out jsonb := '[]'::jsonb;
  v_elem jsonb;
  v_path text;
  v_nome text;
  v_mime text;
  v_size bigint;
  v_doc_id uuid;
  i int;
  n int;
  v_final_corpo text;
  v_max bigint := 15 * 1024 * 1024;
begin
  if v_ref = '' then
    return jsonb_build_object('ok', false, 'error', 'ref_required');
  end if;

  if p_anexos is null or jsonb_typeof(p_anexos) != 'array' then
    return jsonb_build_object('ok', false, 'error', 'anexos_invalid');
  end if;

  n := jsonb_array_length(p_anexos);

  if n = 0 and (v_body = '' or char_length(v_body) > 8000) then
    return jsonb_build_object('ok', false, 'error', 'message_invalid');
  end if;
  if n > 0 and char_length(v_body) > 8000 then
    return jsonb_build_object('ok', false, 'error', 'message_invalid');
  end if;

  select s.id, s.status, s.organizacao_id into v_sid, st, v_org_id
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

  v_prefix := 'homologacao/' || v_sid::text || '/';

  if n > 0 then
  for i in 0..n - 1 loop
    v_elem := p_anexos->i;
    v_path := trim(coalesce(v_elem->>'path', v_elem->>'storage_path', ''));
    v_nome := trim(coalesce(v_elem->>'nome_original', v_elem->>'name', 'documento'));
    v_mime := lower(trim(coalesce(v_elem->>'mime_type', v_elem->>'mime', v_elem->>'contentType', '')));
    begin
      v_size := coalesce(nullif(trim(v_elem->>'tamanho_bytes'), '')::bigint, nullif(trim(v_elem->>'size'), '')::bigint);
    exception
      when others then
        return jsonb_build_object('ok', false, 'error', 'anexos_invalid');
    end;

    if v_path = '' or position(v_prefix in v_path) != 1 then
      return jsonb_build_object('ok', false, 'error', 'path_invalid');
    end if;
    if v_size is null or v_size < 1 or v_size > v_max then
      return jsonb_build_object('ok', false, 'error', 'size_invalid');
    end if;
    if v_mime not in (
      'application/pdf',
      'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) then
      return jsonb_build_object('ok', false, 'error', 'mime_not_allowed');
    end if;
  end loop;
  end if;

  v_final_corpo := case
    when v_body <> '' then v_body
    when n > 0 then 'Documento anexado.'
    else ''
  end;

  if v_final_corpo = '' then
    return jsonb_build_object('ok', false, 'error', 'message_invalid');
  end if;

  insert into public.hub_homologacao_mensagens (signup_id, direcao, corpo, criado_por_user_id, anexos)
  values (v_sid, 'parceiro', v_final_corpo, null, '[]'::jsonb)
  returning id into v_id;

  if n > 0 then
  for i in 0..n - 1 loop
    v_elem := p_anexos->i;
    v_path := trim(coalesce(v_elem->>'path', v_elem->>'storage_path', ''));
    v_nome := trim(coalesce(v_elem->>'nome_original', v_elem->>'name', 'documento'));
    v_mime := lower(trim(coalesce(v_elem->>'mime_type', v_elem->>'mime', v_elem->>'contentType', '')));
    v_size := coalesce(nullif(trim(v_elem->>'tamanho_bytes'), '')::bigint, nullif(trim(v_elem->>'size'), '')::bigint);

    insert into public.hub_homologacao_documentos (
      signup_id, organizacao_id, storage_path, nome_original, mime_type, tamanho_bytes, origem, mensagem_id, criado_por_user_id
    )
    values (v_sid, v_org_id, v_path, left(v_nome, 500), nullif(v_mime, ''), v_size, 'parceiro', v_id, null)
    returning id into v_doc_id;

    v_anexos_out := v_anexos_out || jsonb_build_array(
      jsonb_build_object(
        'id', v_doc_id,
        'nome_original', left(v_nome, 500),
        'mime_type', v_mime,
        'storage_path', v_path,
        'tamanho_bytes', v_size
      )
    );
  end loop;

    update public.hub_homologacao_mensagens
    set anexos = v_anexos_out
    where id = v_id;
  end if;

  return jsonb_build_object('ok', true, 'message_id', v_id);
exception
  when check_violation then
    return jsonb_build_object('ok', false, 'error', 'message_invalid');
  when others then
    return jsonb_build_object('ok', false, 'error', 'sql_error', 'detail', sqlerrm);
end;
$$;

revoke all on function public.hub_public_homologacao_send_message(text, text, jsonb) from public;
grant execute on function public.hub_public_homologacao_send_message(text, text, jsonb) to anon, authenticated;

-- =============================================================================
-- Resposta HUB com anexos opcionais
-- =============================================================================
drop function if exists public.hub_homologacao_hub_reply(uuid, text);

create or replace function public.hub_homologacao_hub_reply(
  p_signup_id uuid,
  p_corpo text,
  p_anexos jsonb default '[]'::jsonb
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
  v_org_id uuid;
  v_prefix text;
  v_anexos_out jsonb := '[]'::jsonb;
  v_elem jsonb;
  v_path text;
  v_nome text;
  v_mime text;
  v_size bigint;
  v_doc_id uuid;
  i int;
  n int;
  v_final_corpo text;
  v_max bigint := 15 * 1024 * 1024;
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

  if p_anexos is null or jsonb_typeof(p_anexos) != 'array' then
    return jsonb_build_object('ok', false, 'error', 'anexos_invalid');
  end if;

  n := jsonb_array_length(p_anexos);

  if n = 0 and (v_body = '' or char_length(v_body) > 8000) then
    return jsonb_build_object('ok', false, 'error', 'message_invalid');
  end if;
  if n > 0 and char_length(v_body) > 8000 then
    return jsonb_build_object('ok', false, 'error', 'message_invalid');
  end if;

  if not exists (select 1 from public.hub_partner_org_signups s where s.id = p_signup_id) then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  select s.organizacao_id into v_org_id
  from public.hub_partner_org_signups s
  where s.id = p_signup_id
  limit 1;

  v_prefix := 'homologacao/' || p_signup_id::text || '/';

  if n > 0 then
  for i in 0..n - 1 loop
    v_elem := p_anexos->i;
    v_path := trim(coalesce(v_elem->>'path', v_elem->>'storage_path', ''));
    v_nome := trim(coalesce(v_elem->>'nome_original', v_elem->>'name', 'documento'));
    v_mime := lower(trim(coalesce(v_elem->>'mime_type', v_elem->>'mime', v_elem->>'contentType', '')));
    begin
      v_size := coalesce(nullif(trim(v_elem->>'tamanho_bytes'), '')::bigint, nullif(trim(v_elem->>'size'), '')::bigint);
    exception
      when others then
        return jsonb_build_object('ok', false, 'error', 'anexos_invalid');
    end;

    if v_path = '' or position(v_prefix in v_path) != 1 then
      return jsonb_build_object('ok', false, 'error', 'path_invalid');
    end if;
    if v_size is null or v_size < 1 or v_size > v_max then
      return jsonb_build_object('ok', false, 'error', 'size_invalid');
    end if;
    if v_mime not in (
      'application/pdf',
      'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) then
      return jsonb_build_object('ok', false, 'error', 'mime_not_allowed');
    end if;
  end loop;
  end if;

  v_final_corpo := case
    when v_body <> '' then v_body
    when n > 0 then 'Documento anexado.'
    else ''
  end;

  if v_final_corpo = '' then
    return jsonb_build_object('ok', false, 'error', 'message_invalid');
  end if;

  insert into public.hub_homologacao_mensagens (signup_id, direcao, corpo, criado_por_user_id, anexos)
  values (p_signup_id, 'hub', v_final_corpo, v_uid, '[]'::jsonb)
  returning id into v_id;

  if n > 0 then
  for i in 0..n - 1 loop
    v_elem := p_anexos->i;
    v_path := trim(coalesce(v_elem->>'path', v_elem->>'storage_path', ''));
    v_nome := trim(coalesce(v_elem->>'nome_original', v_elem->>'name', 'documento'));
    v_mime := lower(trim(coalesce(v_elem->>'mime_type', v_elem->>'mime', v_elem->>'contentType', '')));
    v_size := coalesce(nullif(trim(v_elem->>'tamanho_bytes'), '')::bigint, nullif(trim(v_elem->>'size'), '')::bigint);

    insert into public.hub_homologacao_documentos (
      signup_id, organizacao_id, storage_path, nome_original, mime_type, tamanho_bytes, origem, mensagem_id, criado_por_user_id
    )
    values (p_signup_id, v_org_id, v_path, left(v_nome, 500), nullif(v_mime, ''), v_size, 'hub', v_id, v_uid)
    returning id into v_doc_id;

    v_anexos_out := v_anexos_out || jsonb_build_array(
      jsonb_build_object(
        'id', v_doc_id,
        'nome_original', left(v_nome, 500),
        'mime_type', v_mime,
        'storage_path', v_path,
        'tamanho_bytes', v_size
      )
    );
  end loop;

    update public.hub_homologacao_mensagens
    set anexos = v_anexos_out
    where id = v_id;
  end if;

  return jsonb_build_object('ok', true, 'message_id', v_id);
exception
  when check_violation then
    return jsonb_build_object('ok', false, 'error', 'message_invalid');
  when others then
    return jsonb_build_object('ok', false, 'error', 'sql_error', 'detail', sqlerrm);
end;
$$;

revoke all on function public.hub_homologacao_hub_reply(uuid, text, jsonb) from public;
grant execute on function public.hub_homologacao_hub_reply(uuid, text, jsonb) to authenticated;

comment on function public.hub_public_homologacao_list_messages(text, int) is
  'Lista mensagens do chat de homologação (inclui anexos).';
comment on function public.hub_public_homologacao_send_message(text, text, jsonb) is
  'Parceiro envia mensagem e/ou anexos no chat de homologação.';
comment on function public.hub_homologacao_hub_reply(uuid, text, jsonb) is
  'Admin HUB responde no chat com texto e/ou anexos.';

notify pgrst, 'reload schema';
