-- Cadastros públicos de parceiro (formulário /cadastro/organizacao), sem senha.
-- Inclui snapshot opcional da consulta CNPJ (CNPJA ou BrasilAPI) para auditoria e onboarding.

create table if not exists public.hub_partner_org_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  cnpj text not null,
  dados_formulario jsonb not null,
  cnpja_snapshot jsonb,
  -- Colunas pós-aprovação (HUB): aplicar também database/hub_partner_org_approve_and_invite.sql
  -- organizacao_id, hub_convite_id, codigo_rastreio, modulos_concedidos, processado_em, processado_por_user_id
  consulta_fonte text,
  template_id text,
  partner_kind text,
  status text not null default 'pendente' check (
    status = any (array['pendente'::text, 'aprovado'::text, 'rejeitado'::text, 'processado'::text])
  ),
  criado_em timestamptz not null default now(),
  constraint hub_partner_org_signups_consulta_fonte check (
    consulta_fonte is null or consulta_fonte = any (array['cnpja'::text, 'brasilapi'::text])
  )
);

create index if not exists hub_partner_org_signups_criado on public.hub_partner_org_signups (criado_em desc);
create index if not exists hub_partner_org_signups_email on public.hub_partner_org_signups (lower(trim(email)));
create index if not exists hub_partner_org_signups_cnpj on public.hub_partner_org_signups (cnpj);

comment on table public.hub_partner_org_signups is
  'Pedidos de cadastro de parceiro via link público; dados_formulario sem senha; cnpja_snapshot = resposta bruta da API, se houver.';

alter table public.hub_partner_org_signups enable row level security;

drop policy if exists "hub_partner_org_insert_public" on public.hub_partner_org_signups;
create policy "hub_partner_org_insert_public"
  on public.hub_partner_org_signups for insert
  to anon, authenticated
  with check (status = 'pendente');

drop policy if exists "hub_partner_org_select_hub" on public.hub_partner_org_signups;
create policy "hub_partner_org_select_hub"
  on public.hub_partner_org_signups for select
  using (public.is_hub_admin());

drop policy if exists "hub_partner_org_update_hub" on public.hub_partner_org_signups;
create policy "hub_partner_org_update_hub"
  on public.hub_partner_org_signups for update
  using (public.is_hub_admin())
  with check (public.is_hub_admin());
