-- Permite wizard_step = slug da secção (alinhado com hub_signup_wizard_step.slug).
-- Correr no SQL Editor do Supabase se ainda existir:
--   check (wizard_step in ('commercial', 'logistics'))
-- Isto desbloqueia criação de etapas vinculadas às secções e corrige dados antigos.

alter table public.hub_standard_field_section
  drop constraint if exists hub_standard_field_section_wizard_step_check;

-- Uma linha em hub_signup_wizard_step por secção (slug = hub_standard_field_section.slug).
insert into public.hub_signup_wizard_step (slug, label, partition_bucket, sort_order, is_active)
select
  s.slug,
  s.title,
  case
    when lower(trim(s.wizard_step)) in ('logistics', 'logistica') then 'logistics'
    when exists (
      select 1
      from public.hub_signup_wizard_step w
      where w.slug = trim(s.wizard_step)
        and w.partition_bucket = 'logistics'
    )
      then 'logistics'
    else 'commercial'
  end,
  s.sort_order,
  s.is_active
from public.hub_standard_field_section s
on conflict (slug) do update set
  label = excluded.label,
  partition_bucket = excluded.partition_bucket,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active;

-- Referência técnica: cada secção aponta para a sua linha no wizard.
update public.hub_standard_field_section s
set wizard_step = s.slug
where true;

comment on column public.hub_standard_field_section.wizard_step is
  'Igual a slug da secção; metadados de rótulo/partição em hub_signup_wizard_step.';

-- Etapas genéricas antigas deixam de ser referenciadas.
delete from public.hub_signup_wizard_step w
where w.slug in ('commercial', 'logistics')
  and not exists (
    select 1 from public.hub_standard_field_section s where s.wizard_step = w.slug
  );
