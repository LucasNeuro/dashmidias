-- Catálogo global de campos «padrão» do cadastro de parceiro (secções + campos).
-- Leitura pública: apenas linhas activas; gestão: is_hub_admin().
-- Aplicar no SQL Editor do Supabase depois de public.is_hub_admin() estar estável
-- (ver database/fix_is_hub_admin_security_definer.sql se necessário).

-- ---------------------------------------------------------------------------
-- Secções (blocos no editor de template e no wizard)
-- ---------------------------------------------------------------------------
create table if not exists public.hub_standard_field_section (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  sort_order int not null default 0,
  wizard_step text not null default 'commercial',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.hub_standard_field_section is
  'Secções do catálogo padrão. wizard_step deve coincidir com slug; partição pública em hub_signup_wizard_step.partition_bucket.';

-- ---------------------------------------------------------------------------
-- Campos do catálogo
-- ---------------------------------------------------------------------------
create table if not exists public.hub_standard_field (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.hub_standard_field_section (id) on delete restrict,
  field_key text not null unique,
  label text not null,
  field_type text not null default 'text',
  required boolean not null default false,
  options jsonb not null default '[]'::jsonb,
  placeholder text,
  rows int,
  sort_order int not null default 0,
  is_active boolean not null default true,
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hub_standard_field_section_id_idx on public.hub_standard_field (section_id);
create index if not exists hub_standard_field_sort_idx on public.hub_standard_field (section_id, sort_order);

comment on table public.hub_standard_field is
  'Definições de campos padrão reutilizáveis em todos os templates; chaves reservadas nos extras do template.';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.hub_standard_field_section enable row level security;
alter table public.hub_standard_field enable row level security;

drop policy if exists hst_section_select on public.hub_standard_field_section;
create policy hst_section_select on public.hub_standard_field_section
  for select
  using (
    is_active = true
    or (
      auth.role() = 'authenticated'
      and public.is_hub_admin()
    )
  );

drop policy if exists hst_section_insert on public.hub_standard_field_section;
create policy hst_section_insert on public.hub_standard_field_section
  for insert to authenticated
  with check (public.is_hub_admin());

drop policy if exists hst_section_update on public.hub_standard_field_section;
create policy hst_section_update on public.hub_standard_field_section
  for update to authenticated
  using (public.is_hub_admin())
  with check (public.is_hub_admin());

drop policy if exists hst_section_delete on public.hub_standard_field_section;
create policy hst_section_delete on public.hub_standard_field_section
  for delete to authenticated
  using (public.is_hub_admin());

drop policy if exists hst_field_select on public.hub_standard_field;
create policy hst_field_select on public.hub_standard_field
  for select
  using (
    (
      is_active = true
      and exists (
        select 1
        from public.hub_standard_field_section s
        where s.id = section_id
          and s.is_active = true
      )
    )
    or (
      auth.role() = 'authenticated'
      and public.is_hub_admin()
    )
  );

drop policy if exists hst_field_insert on public.hub_standard_field;
create policy hst_field_insert on public.hub_standard_field
  for insert to authenticated
  with check (public.is_hub_admin());

drop policy if exists hst_field_update on public.hub_standard_field;
create policy hst_field_update on public.hub_standard_field
  for update to authenticated
  using (public.is_hub_admin())
  with check (public.is_hub_admin());

drop policy if exists hst_field_delete on public.hub_standard_field;
create policy hst_field_delete on public.hub_standard_field
  for delete to authenticated
  using (public.is_hub_admin());

grant select on public.hub_standard_field_section to anon, authenticated;
grant select on public.hub_standard_field to anon, authenticated;
grant insert, update, delete on public.hub_standard_field_section to authenticated;
grant insert, update, delete on public.hub_standard_field to authenticated;
