-- Catálogo de segmentos para leads públicos (cliente final), distinto de partner_kind.
-- Leitura pública só de linhas activas; gestão via SQL ou futura UI admin.

create table if not exists public.hub_lead_segment (
  slug text primary key check (
    slug ~ '^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$'::text
  ),
  label text not null,
  description text not null default ''::text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.hub_lead_segment is
  'Segmentação para hub_public_leads: PARCEIRO, CLIENTE, IMOVEL (slugs parceiro, cliente, imovel).';

create index if not exists hub_lead_segment_active_sort on public.hub_lead_segment (is_active, sort_order);

insert into public.hub_lead_segment (slug, label, description, sort_order, is_active)
values
  ('parceiro', 'PARCEIRO', 'Classificação CRM: contacto no ecossistema de parceiros.', 10, true),
  ('cliente', 'CLIENTE', 'Classificação CRM: contacto como cliente.', 20, true),
  ('imovel', 'IMOVEL', 'Classificação CRM: contacto ligado a imóvel.', 30, true)
on conflict (slug) do update set
  label = excluded.label,
  description = excluded.description,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  updated_at = now();

-- Manter só estes três activos nos envios públicos (legados ficam na tabela por FK histórico).
update public.hub_lead_segment
set
  is_active = false,
  updated_at = now()
where slug not in ('parceiro', 'cliente', 'imovel');

alter table public.hub_lead_segment enable row level security;

drop policy if exists hub_lead_segment_select_public on public.hub_lead_segment;
create policy hub_lead_segment_select_public
  on public.hub_lead_segment for select
  to anon, authenticated
  using (is_active = true);

drop policy if exists hub_lead_segment_all_hub on public.hub_lead_segment;
create policy hub_lead_segment_all_hub
  on public.hub_lead_segment for all
  to authenticated
  using (public.is_hub_admin())
  with check (public.is_hub_admin());

grant select on public.hub_lead_segment to anon, authenticated;
grant insert, update, delete on public.hub_lead_segment to authenticated;
