-- Migração: segmentos CRM = PARCEIRO, CLIENTE, IMOVEL (slugs parceiro, cliente, imovel).
-- Rode no SQL Editor do Supabase quando o projeto já tinha hub_lead_segment com valores antigos
-- (projeto, obra-reforma, outro, etc.). Idempotente.

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

update public.hub_lead_segment
set
  is_active = false,
  updated_at = now()
where slug not in ('parceiro', 'cliente', 'imovel');
