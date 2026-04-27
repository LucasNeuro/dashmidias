-- Distingue modelos de homologação (parceiro / organização) de modelos de captura de leads (CRM).
-- Idempotente. Aplicar no SQL Editor após registration_form_template existir.

alter table public.registration_form_template
  add column if not exists template_purpose text not null default 'partner_homologacao';

alter table public.registration_form_template
  drop constraint if exists registration_form_template_template_purpose_check;

alter table public.registration_form_template
  add constraint registration_form_template_template_purpose_check
  check (template_purpose = any (array['partner_homologacao'::text, 'lead_capture'::text]));

comment on column public.registration_form_template.template_purpose is
  'partner_homologacao = formulário /cadastro/organizacao; lead_capture = /cadastro/captura → hub_public_leads.';

create index if not exists registration_form_template_purpose_idx
  on public.registration_form_template (template_purpose)
  where organization_id is null;
