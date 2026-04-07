-- =============================================================================
-- Auth: perfis, papéis e auditoria de acessos ao painel (Supabase)
-- Rode no SQL Editor do projeto Supabase APÓS já existir o schema de marketing.
-- =============================================================================

-- Perfis ligados ao auth.users (email espelhado para listagem no painel admin)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'user' check (role in ('user', 'admin')),
  can_access_audit boolean not null default false,
  updated_at timestamptz not null default now()
);

-- Bancos onde profiles já existia sem esta coluna: CREATE TABLE IF NOT EXISTS não altera a tabela.
alter table public.profiles
  add column if not exists can_access_audit boolean not null default false;

create index if not exists idx_profiles_role on public.profiles (role);
create index if not exists idx_profiles_can_access_audit on public.profiles (can_access_audit) where can_access_audit = true;

create table if not exists public.panel_access_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  path text,
  accessed_at timestamptz not null default now(),
  user_agent text,
  meta jsonb not null default '{}'::jsonb
);

create index if not exists idx_panel_access_logs_user on public.panel_access_logs (user_id, accessed_at desc);
create index if not exists idx_panel_access_logs_time on public.panel_access_logs (accessed_at desc);

-- Auditoria (/adm): role admin OU can_access_audit = true
create or replace function public.has_audit_access()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and (
        role = 'admin'
        or coalesce(can_access_audit, false) = true
      )
  );
$$;

-- Compatível com políticas que usam is_admin()
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.has_audit_access();
$$;

-- Novo usuário: cria linha em profiles (padrão user)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, can_access_audit)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email, ''), '@', 1)),
    'user',
    false
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(excluded.full_name, public.profiles.full_name),
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Sincroniza email se mudar no Auth
create or replace function public.handle_user_email_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = new.email, updated_at = now() where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row execute function public.handle_user_email_update();

alter table public.profiles enable row level security;
alter table public.panel_access_logs enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select using (auth.uid() = id);

drop policy if exists profiles_select_admin on public.profiles;
create policy profiles_select_admin on public.profiles
  for select using (public.is_admin());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (auth.uid() = id);

-- Perfis são criados pelo trigger em auth.users (sem política pública de INSERT).
-- Via API: só quem já tem role = admin pode mudar role ou can_access_audit.
-- SQL Editor (auth.uid() null): libera ajustes para 1–2 auditores.
create or replace function public.profiles_prevent_privilege_escalation()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if new.role is distinct from old.role and old.role <> 'admin' then
    raise exception 'Alteração de papel (role) não permitida.';
  end if;

  if new.can_access_audit is distinct from old.can_access_audit and old.role <> 'admin' then
    raise exception 'Alteração de can_access_audit não permitida via API (use o SQL Editor).';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_role_guard on public.profiles;
drop function if exists public.profiles_prevent_role_escalation();
create trigger profiles_role_guard
  before update on public.profiles
  for each row execute function public.profiles_prevent_privilege_escalation();

drop policy if exists access_logs_insert_self on public.panel_access_logs;
create policy access_logs_insert_self on public.panel_access_logs
  for insert with check (auth.uid() = user_id);

drop policy if exists access_logs_select_own on public.panel_access_logs;
create policy access_logs_select_own on public.panel_access_logs
  for select using (auth.uid() = user_id);

drop policy if exists access_logs_select_admin on public.panel_access_logs;
create policy access_logs_select_admin on public.panel_access_logs
  for select using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Dar acesso à auditoria (/adm), sem mudar role (recomendado para 1–2 pessoas):
-- update public.profiles set can_access_audit = true, updated_at = now()
-- where email = 'auditor@empresa.com';
--
-- Ou administrador completo:
-- update public.profiles set role = 'admin', updated_at = now()
-- where email = 'seu-email@empresa.com';
-- ---------------------------------------------------------------------------
