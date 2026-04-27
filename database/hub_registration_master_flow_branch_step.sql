-- Etapas de ramificação no fluxo público: pergunta inicial (JSON) antes de CPF/CNPJ ou leads.
-- template_id passa a ser opcional quando step_kind = 'branch'.

alter table public.hub_registration_master_flow_step
  alter column template_id drop not null;

alter table public.hub_registration_master_flow_step
  add column if not exists step_kind text not null default 'template';

alter table public.hub_registration_master_flow_step
  add column if not exists branch_config jsonb;

comment on column public.hub_registration_master_flow_step.step_kind is
  'template = formulário (registration_form_template); branch = pergunta inicial (branch_config).';

comment on column public.hub_registration_master_flow_step.branch_config is
  'JSON: { prompt, subtitle?, options: [{ id, label, description?, outcome, segment_slug? }] }. outcome: lead_segments | partner_document | lead_direct | advance_branch.';

update public.hub_registration_master_flow_step
set step_kind = 'template'
where step_kind is null or step_kind = '';

alter table public.hub_registration_master_flow_step
  drop constraint if exists hub_reg_flow_step_kind_valid;

alter table public.hub_registration_master_flow_step
  add constraint hub_reg_flow_step_kind_valid check (
    (step_kind = 'template' and template_id is not null and branch_config is null)
    or (step_kind = 'branch' and template_id is null and branch_config is not null)
  );
