-- Corrige: "infinite recursion detected in policy for relation 'hub_admins'"
-- Causa: is_hub_admin() era SECURITY INVOKER e lia hub_admins; a policy em hub_admins
-- chamava is_hub_admin() de novo → recursão.
-- Solução: SECURITY DEFINER (executa com privilégios do dono da função; leitura em hub_admins
-- não reentra na policy como o mesmo utilizador em modo invoker).
--
-- Rode no SQL Editor do Supabase após revisão.

create or replace function public.is_hub_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.hub_admins h
    where h.user_id = auth.uid()
      and h.ativo = true
  );
$$;

comment on function public.is_hub_admin() is 'True se auth.uid() é admin ativo da plataforma (hub_admins). SECURITY DEFINER evita recursão RLS.';

grant execute on function public.is_hub_admin() to authenticated;
