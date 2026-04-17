-- =============================================================================
-- Migração: profiles.role — incluir 'owner' (dono da plataforma)
--
-- Semântica sugerida:
--   owner  → dono da plataforma (acesso total HUB / governança; use nos seeds de owner)
--   admin  → administradores (HUB ou legado) sem ser o “dono” único
--   user   → demais
--
-- Rode no SQL Editor do Supabase uma vez. Se der erro no DROP CONSTRAINT, veja a
-- nota no final sobre o nome exato da constraint.
-- =============================================================================

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role = ANY (ARRAY['user'::text, 'admin'::text, 'owner'::text]));

comment on column public.profiles.role is
  'user | admin (admins diversos) | owner (dono da plataforma)';

-- =============================================================================
-- Auditoria: mesmo privilégio que admin para leitura em policies
-- =============================================================================

create or replace function public.has_audit_access()
returns boolean
language sql
stable
security definer
set search_path to public
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

-- Opcional: promover conta existente a dono (ajuste o e-mail):
--   update public.profiles set role = 'owner' where lower(email) = lower('lucasoffgod@hotmail.com');

-- =============================================================================
-- Se DROP CONSTRAINT falhar, descubra o nome:
--   select conname from pg_constraint c
--   join pg_class t on c.conrelid = t.oid
--   where t.relname = 'profiles' and c.contype = 'c';
-- =============================================================================
