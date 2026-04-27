-- Motor de cadastro público: fluxo (slug) + etapas ligadas a registration_form_template.
-- Pré-requisito: tabela public.registration_form_template. Aplicar depois das migrations de templates/RLS.
-- entry_condition (jsonb): regras em AND simples, ex. {"doc_type":"cnpj"} ou {"doc_type":"cnpj","partner_kind":"arquitetos"}.
-- Vazio ou null = etapa aplica-se sempre no ramo filtrado (ver front: filtra por doc_type antes).

create table if not exists public.hub_registration_master_flow (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique check (
    slug ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$'::text
  ),
  description text not null default ''::text,
  is_active boolean not null default true,
  invite_link_enabled boolean not null default true,
  created_by_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.hub_registration_master_flow is
  'Wizard inteligente: um slug público (ex. ob10-intake) agrupa etapas (templates de parceiro).';

create table if not exists public.hub_registration_master_flow_step (
  id uuid primary key default gen_random_uuid(),
  master_flow_id uuid not null references public.hub_registration_master_flow (id) on delete cascade,
  template_id uuid not null references public.registration_form_template (id) on delete restrict,
  sort_order integer not null default 0,
  entry_condition jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.hub_registration_master_flow_step.entry_condition is
  'Filtro AND: doc_type (cpf|cnpj), audience (lead|partner), partner_kind (slug). Objeto vazio/null = sem filtro extra.';

create index if not exists hub_reg_flow_step_flow_sort
  on public.hub_registration_master_flow_step (master_flow_id, sort_order);

create index if not exists hub_reg_flow_slug on public.hub_registration_master_flow (slug) where is_active = true;

alter table public.hub_registration_master_flow enable row level security;
alter table public.hub_registration_master_flow_step enable row level security;

-- Fluxo público (só activos e convite ligado)
drop policy if exists hub_reg_flow_select_public on public.hub_registration_master_flow;
create policy hub_reg_flow_select_public
  on public.hub_registration_master_flow for select
  to anon, authenticated
  using (is_active = true and invite_link_enabled = true);

drop policy if exists hub_reg_flow_all_hub on public.hub_registration_master_flow;
create policy hub_reg_flow_all_hub
  on public.hub_registration_master_flow for all
  to authenticated
  using (public.is_hub_admin())
  with check (public.is_hub_admin());

-- Etapas: leitura pública só se o fluxo pai for público
drop policy if exists hub_reg_flow_step_select_public on public.hub_registration_master_flow_step;
create policy hub_reg_flow_step_select_public
  on public.hub_registration_master_flow_step for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.hub_registration_master_flow f
      where f.id = master_flow_id
        and f.is_active = true
        and f.invite_link_enabled = true
    )
  );

drop policy if exists hub_reg_flow_step_all_hub on public.hub_registration_master_flow_step;
create policy hub_reg_flow_step_all_hub
  on public.hub_registration_master_flow_step for all
  to authenticated
  using (public.is_hub_admin())
  with check (public.is_hub_admin());

grant select on public.hub_registration_master_flow to anon, authenticated;
grant select on public.hub_registration_master_flow_step to anon, authenticated;
grant insert, update, delete on public.hub_registration_master_flow to authenticated;
grant insert, update, delete on public.hub_registration_master_flow_step to authenticated;

-- Fluxo por defeito (sem etapas; o painel de fluxos foi removido do front — dados podem permanecer na BD)
insert into public.hub_registration_master_flow (name, slug, description, is_active, invite_link_enabled)
values (
  'Entrada inteligente Obra10+',
  'ob10-intake',
  'CPF → leads; CNPJ → sequência de templates de parceiro (etapas abaixo).',
  true,
  true
)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  updated_at = now();
