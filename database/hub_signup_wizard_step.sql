-- Etapas do wizard público de cadastro de parceiro: rótulos e slugs configuráveis.
-- partition_bucket: onde o motor coloca os campos da secção (commercial = etapa «informações comerciais»;
-- logistics = etapa «logística e doca»). Novas etapas visuais no futuro exigirão evolução do PartnerOrgSignupForm.
--
-- Aplicar antes ou depois de hub_standard_catalog.sql. hub_standard_field_section.wizard_step = slug desta tabela.

create table if not exists public.hub_signup_wizard_step (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  label text not null,
  partition_bucket text not null default 'commercial'
    check (partition_bucket in ('commercial', 'logistics')),
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.hub_signup_wizard_step is
  'Etapas do convite público: secções do catálogo referenciam slug; partition_bucket mapeia para o wizard actual (2 blocos de extras).';

-- Linhas iniciais opcionais (instalações sem hub_standard_catalog_seed.sql).
-- Com seed do catálogo, cada secção traz a sua linha (slug = secção).
insert into public.hub_signup_wizard_step (slug, label, partition_bucket, sort_order, is_active)
values
  ('commercial', 'Comercial / informações gerais', 'commercial', 0, true),
  ('logistics', 'Logística e doca', 'logistics', 1, true)
on conflict (slug) do nothing;

alter table public.hub_signup_wizard_step enable row level security;

drop policy if exists wstep_select_anon on public.hub_signup_wizard_step;
create policy wstep_select_anon on public.hub_signup_wizard_step
  for select to anon
  using (is_active = true);

drop policy if exists wstep_select_auth on public.hub_signup_wizard_step;
create policy wstep_select_auth on public.hub_signup_wizard_step
  for select to authenticated
  using (
    is_active = true
    or (auth.role() = 'authenticated' and public.is_hub_admin())
  );

drop policy if exists wstep_insert on public.hub_signup_wizard_step;
create policy wstep_insert on public.hub_signup_wizard_step
  for insert to authenticated
  with check (public.is_hub_admin());

drop policy if exists wstep_update on public.hub_signup_wizard_step;
create policy wstep_update on public.hub_signup_wizard_step
  for update to authenticated
  using (public.is_hub_admin())
  with check (public.is_hub_admin());

drop policy if exists wstep_delete on public.hub_signup_wizard_step;
create policy wstep_delete on public.hub_signup_wizard_step
  for delete to authenticated
  using (public.is_hub_admin());

grant select on public.hub_signup_wizard_step to anon, authenticated;
grant insert, update, delete on public.hub_signup_wizard_step to authenticated;
