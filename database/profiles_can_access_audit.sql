-- =============================================================================
-- Incremental: coluna can_access_audit (quem vê /adm e auditoria)
-- Rode no SQL Editor do Supabase sobre o schema existente.
-- Quem pode auditar: role = 'admin' OU can_access_audit = true
-- Manutenção: atualize via SQL Editor (sem sessão de usuário), ex.:
--   update public.profiles set can_access_audit = true, updated_at = now()
--   where email = 'auditor@empresa.com';
-- =============================================================================

alter table public.profiles
  add column if not exists can_access_audit boolean not null default false;

create index if not exists idx_profiles_can_access_audit
  on public.profiles (can_access_audit)
  where can_access_audit = true;

-- Quem enxerga todas as linhas em profiles / panel_access_logs (rota /adm)
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

-- Mantém compatibilidade com políticas que chamam is_admin()
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.has_audit_access();
$$;

-- Via API só quem já é role admin pode mudar role ou can_access_audit.
-- No SQL Editor auth.uid() é null → alterações liberadas (defina seus 1–2 auditores aí).
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
    raise exception 'Alteração de can_access_audit não permitida (use o SQL Editor como administrador do banco).';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_role_guard on public.profiles;
create trigger profiles_role_guard
  before update on public.profiles
  for each row execute function public.profiles_prevent_privilege_escalation();

drop function if exists public.profiles_prevent_role_escalation();

-- Políticas existentes que chamam is_admin() passam a refletir has_audit_access().
