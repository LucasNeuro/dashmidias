-- =============================================================================
-- Governança total para Administrador HUB (ler e gerir tudo o que for da plataforma)
-- Rode no SQL Editor do Supabase após revisão.
--
-- Pré-requisito: função is_hub_admin() = utilizador em public.hub_admins com ativo.
-- Políticas novas somam-se às existentes (OR em modo PERMISSIVE).
-- =============================================================================

create or replace function public.is_hub_admin()
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.hub_admins h
    where h.user_id = auth.uid()
      and h.ativo = true
  );
$$;

comment on function public.is_hub_admin() is 'True se auth.uid() é admin ativo da plataforma (hub_admins). SECURITY DEFINER evita recursão RLS em policies que leem hub_admins.';

grant execute on function public.is_hub_admin() to authenticated;

-- hub_admins: além do SELECT, permitir INSERT/UPDATE/DELETE a outros admins pela plataforma
drop policy if exists "hub_admins_manage_by_hub" on public.hub_admins;
create policy "hub_admins_manage_by_hub"
  on public.hub_admins
  for all
  using (public.is_hub_admin())
  with check (public.is_hub_admin());

-- perfis: visão e ajuste global (suporte, governança)
drop policy if exists "perfis_hub_admin_all" on public.perfis;
create policy "perfis_hub_admin_all"
  on public.perfis
  for all
  using (public.is_hub_admin())
  with check (public.is_hub_admin());

-- Convites (HUB e organizações): hoje só HUB admin opera; expandir depois para admin_org
drop policy if exists "convites_admin_hub_all" on public.convites_administrador_hub;
create policy "convites_admin_hub_all"
  on public.convites_administrador_hub
  for all
  using (public.is_hub_admin())
  with check (public.is_hub_admin());

drop policy if exists "convites_org_hub_all" on public.organizacao_convites;
create policy "convites_org_hub_all"
  on public.organizacao_convites
  for all
  using (public.is_hub_admin())
  with check (public.is_hub_admin());

-- =============================================================================
-- Alinhamento com public.profiles / auditoria
-- has_audit_access() alimenta is_admin(); incluir admin HUB para SELECT em profiles.
-- =============================================================================

create or replace function public.has_audit_access()
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (
        p.role in ('admin', 'owner')
        or coalesce(p.can_access_audit, false) = true
      )
  )
  or exists (
    select 1 from public.hub_admins h
    where h.user_id = auth.uid()
      and h.ativo = true
  );
$$;

-- UPDATE em qualquer linha de profiles (governança); SELECT já coberto por is_admin()
drop policy if exists "profiles_update_hub_admin" on public.profiles;
create policy "profiles_update_hub_admin"
  on public.profiles
  for update
  using (public.is_hub_admin())
  with check (public.is_hub_admin());
