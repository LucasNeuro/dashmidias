-- =============================================================================
-- Alinha public.is_hub_admin() com AuthContext.jsx (hub_admins + elevação legada).
--
-- Sintoma: utilizador entra na consola (role owner / administrador_hub / audit)
-- mas cargos e admins HUB aparecem vazios — as políticas RLS usam só hub_admins.
--
-- Rode no SQL Editor do Supabase após revisão. Idempotente (substitui a função).
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
      and (h.ativo is distinct from false)
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (
        p.role in ('admin', 'owner')
        or coalesce(p.can_access_audit, false) = true
      )
  )
  or exists (
    select 1
    from public.perfis pf
    where pf.user_id = auth.uid()
      and coalesce(pf.administrador_hub, false) = true
  );
$$;

comment on function public.is_hub_admin() is
  'Admin HUB: hub_admins (ativo não false), ou profiles admin/owner/audit, ou perfis.administrador_hub. SECURITY DEFINER + row_security off.';

grant execute on function public.is_hub_admin() to authenticated;
