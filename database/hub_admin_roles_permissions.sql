-- =============================================================================
-- HUB RBAC (cargos e permissões para administradores da plataforma)
-- Escopo desta fase: apenas admins HUB (não inclui membros de organização).
-- =============================================================================

create table if not exists public.hub_admin_role (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]([a-z0-9_:-]{0,60}[a-z0-9])?$'),
  nome text not null,
  descricao text,
  is_system boolean not null default false,
  is_active boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.hub_admin_permission (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  modulo text not null,
  acao text not null,
  descricao text,
  is_active boolean not null default true,
  criado_em timestamptz not null default now()
);

create table if not exists public.hub_admin_role_permission (
  role_id uuid not null references public.hub_admin_role(id) on delete cascade,
  permission_id uuid not null references public.hub_admin_permission(id) on delete cascade,
  allowed boolean not null default true,
  criado_em timestamptz not null default now(),
  primary key (role_id, permission_id)
);

create table if not exists public.hub_admin_user_role (
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null references public.hub_admin_role(id) on delete cascade,
  is_active boolean not null default true,
  atribuido_em timestamptz not null default now(),
  atribuido_por_user_id uuid references auth.users(id),
  revogado_em timestamptz,
  primary key (user_id, role_id)
);

create table if not exists public.hub_admin_access_audit (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id),
  target_user_id uuid references auth.users(id),
  evento text not null,
  payload jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now()
);

create index if not exists idx_hub_admin_user_role_user on public.hub_admin_user_role(user_id) where is_active = true;
create index if not exists idx_hub_admin_access_audit_criado_em on public.hub_admin_access_audit(criado_em desc);

create or replace function public.touch_hub_admin_role_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

drop trigger if exists trg_touch_hub_admin_role_updated_at on public.hub_admin_role;
create trigger trg_touch_hub_admin_role_updated_at
before update on public.hub_admin_role
for each row
execute function public.touch_hub_admin_role_updated_at();

-- -----------------------------------------------------------------------------
-- Seed inicial de permissões/cargos HUB
-- -----------------------------------------------------------------------------
insert into public.hub_admin_permission (codigo, modulo, acao, descricao)
values
  ('hub_access.manage', 'hub_access', 'manage', 'Gerir cargos e permissões dos admins HUB'),
  ('governance.view', 'governance', 'view', 'Ver área de governança'),
  ('governance.edit', 'governance', 'edit', 'Editar configurações de governança'),
  ('audit.view', 'audit', 'view', 'Ver painel de auditoria'),
  ('crm.view', 'crm', 'view', 'Ver CRM'),
  ('crm.manage', 'crm', 'manage', 'Gerir entidades do CRM'),
  ('templates.manage', 'templates', 'manage', 'Gerir templates e formulários')
on conflict (codigo) do update
set modulo = excluded.modulo,
    acao = excluded.acao,
    descricao = excluded.descricao,
    is_active = true;

insert into public.hub_admin_role (slug, nome, descricao, is_system, is_active)
values
  ('owner', 'Owner HUB', 'Controle total do HUB', true, true),
  ('admin_operacional', 'Admin Operacional', 'Operação diária do HUB (sem gerir acessos)', true, true),
  ('auditor', 'Auditor', 'Somente leitura e auditoria', true, true)
on conflict (slug) do update
set nome = excluded.nome,
    descricao = excluded.descricao,
    is_active = true;

with all_perms as (
  select p.id as permission_id
  from public.hub_admin_permission p
  where p.is_active = true
),
owner_role as (
  select r.id as role_id
  from public.hub_admin_role r
  where r.slug = 'owner'
)
insert into public.hub_admin_role_permission (role_id, permission_id, allowed)
select o.role_id, p.permission_id, true
from owner_role o
cross join all_perms p
on conflict (role_id, permission_id) do update set allowed = true;

with op_role as (
  select r.id as role_id
  from public.hub_admin_role r
  where r.slug = 'admin_operacional'
),
op_perms as (
  select p.id as permission_id
  from public.hub_admin_permission p
  where p.codigo in ('governance.view', 'governance.edit', 'crm.view', 'crm.manage', 'templates.manage')
)
insert into public.hub_admin_role_permission (role_id, permission_id, allowed)
select o.role_id, p.permission_id, true
from op_role o
join op_perms p on true
on conflict (role_id, permission_id) do update set allowed = true;

with aud_role as (
  select r.id as role_id
  from public.hub_admin_role r
  where r.slug = 'auditor'
),
aud_perms as (
  select p.id as permission_id
  from public.hub_admin_permission p
  where p.codigo in ('governance.view', 'audit.view', 'crm.view')
)
insert into public.hub_admin_role_permission (role_id, permission_id, allowed)
select o.role_id, p.permission_id, true
from aud_role o
join aud_perms p on true
on conflict (role_id, permission_id) do update set allowed = true;

-- -----------------------------------------------------------------------------
-- Funções de leitura/permissão
-- -----------------------------------------------------------------------------
create or replace function public.hub_admin_effective_permissions(p_user_id uuid default auth.uid())
returns table (codigo text)
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select distinct p.codigo
  from public.hub_admin_user_role ur
  join public.hub_admin_role r on r.id = ur.role_id and r.is_active = true
  join public.hub_admin_role_permission rp on rp.role_id = r.id and rp.allowed = true
  join public.hub_admin_permission p on p.id = rp.permission_id and p.is_active = true
  join public.hub_admins ha on ha.user_id = ur.user_id and ha.ativo = true
  where ur.user_id = p_user_id
    and ur.is_active = true;
$$;

create or replace function public.hub_admin_has_permission(p_codigo text)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.hub_admin_effective_permissions(auth.uid()) x
    where x.codigo = p_codigo
  );
$$;

create or replace function public.hub_admin_list_users_with_roles()
returns table (
  user_id uuid,
  role_slugs text[],
  role_names text[]
)
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select
    ha.user_id,
    coalesce(array_agg(r.slug order by r.slug) filter (where ur.is_active = true and r.is_active = true), '{}'::text[]) as role_slugs,
    coalesce(array_agg(r.nome order by r.slug) filter (where ur.is_active = true and r.is_active = true), '{}'::text[]) as role_names
  from public.hub_admins ha
  left join public.hub_admin_user_role ur on ur.user_id = ha.user_id
  left join public.hub_admin_role r on r.id = ur.role_id
  where ha.ativo = true
  group by ha.user_id;
$$;

-- -----------------------------------------------------------------------------
-- RLS e grants
-- -----------------------------------------------------------------------------
alter table public.hub_admin_role enable row level security;
alter table public.hub_admin_permission enable row level security;
alter table public.hub_admin_role_permission enable row level security;
alter table public.hub_admin_user_role enable row level security;
alter table public.hub_admin_access_audit enable row level security;

drop policy if exists "hub_admin_role_hub_all" on public.hub_admin_role;
create policy "hub_admin_role_hub_all"
  on public.hub_admin_role
  for all
  to authenticated
  using (public.is_hub_admin())
  with check (public.is_hub_admin());

drop policy if exists "hub_admin_permission_hub_all" on public.hub_admin_permission;
create policy "hub_admin_permission_hub_all"
  on public.hub_admin_permission
  for all
  to authenticated
  using (public.is_hub_admin())
  with check (public.is_hub_admin());

drop policy if exists "hub_admin_role_permission_hub_all" on public.hub_admin_role_permission;
create policy "hub_admin_role_permission_hub_all"
  on public.hub_admin_role_permission
  for all
  to authenticated
  using (public.is_hub_admin())
  with check (public.is_hub_admin());

drop policy if exists "hub_admin_user_role_hub_all" on public.hub_admin_user_role;
create policy "hub_admin_user_role_hub_all"
  on public.hub_admin_user_role
  for all
  to authenticated
  using (public.is_hub_admin())
  with check (public.is_hub_admin());

drop policy if exists "hub_admin_access_audit_hub_select" on public.hub_admin_access_audit;
create policy "hub_admin_access_audit_hub_select"
  on public.hub_admin_access_audit
  for select
  to authenticated
  using (public.is_hub_admin());

drop policy if exists "hub_admin_access_audit_hub_insert" on public.hub_admin_access_audit;
create policy "hub_admin_access_audit_hub_insert"
  on public.hub_admin_access_audit
  for insert
  to authenticated
  with check (public.is_hub_admin());

grant execute on function public.hub_admin_effective_permissions(uuid) to authenticated;
grant execute on function public.hub_admin_has_permission(text) to authenticated;
grant execute on function public.hub_admin_list_users_with_roles() to authenticated;

