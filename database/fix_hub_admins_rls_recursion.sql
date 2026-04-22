-- =============================================================================
-- Corrige: "infinite recursion detected in policy for relation 'hub_admins'"
--
-- Causa: a policy em hub_admins usa is_hub_admin(); o corpo da função lia
-- hub_admins com o mesmo papel RLS do invoker → reentrada na policy.
--
-- Solução:
--   1) SECURITY DEFINER (já recomendado)
--   2) SET row_security = off no corpo da função (PG 15+) para a leitura
--      interna a hub_admins não voltar a avaliar RLS.
--
-- Rode no SQL Editor do Supabase (projeto dash-midias) uma vez.
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

comment on function public.is_hub_admin() is
  'True se auth.uid() é admin ativo (hub_admins). SECURITY DEFINER + row_security off evita recursão RLS.';

grant execute on function public.is_hub_admin() to authenticated;

-- Mesma lógica: leitura a hub_admins dentro da função não deve reentrar em RLS.
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

grant execute on function public.has_audit_access() to authenticated;
