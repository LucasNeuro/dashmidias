  -- Leads públicos (cliente final / PF), separados de hub_partner_org_signups.
  -- Inserção apenas via RPC hub_submit_public_lead (security definer).

  create table if not exists public.hub_public_leads (
    id uuid primary key default gen_random_uuid(),
    segment_slug text not null references public.hub_lead_segment (slug) on update cascade on delete restrict,
    nome text not null,
    email text not null,
    telefone text,
    cpf text,
    dados_formulario jsonb not null default '{}'::jsonb,
    template_id text,
    flow_slug text,
    status text not null default 'novo'::text check (
      status = any (array['novo'::text, 'contactado'::text, 'descartado'::text, 'convertido'::text])
    ),
    criado_em timestamptz not null default now()
  );

  comment on table public.hub_public_leads is
    'Pedidos de contacto de cliente final; segment_slug classifica intenção; dados_formulario = payload extra (JSON).';

  create index if not exists hub_public_leads_criado on public.hub_public_leads (criado_em desc);
  create index if not exists hub_public_leads_segment on public.hub_public_leads (segment_slug);
  create index if not exists hub_public_leads_email on public.hub_public_leads (lower(trim(email)));
  create index if not exists hub_public_leads_status on public.hub_public_leads (status);

  alter table public.hub_public_leads enable row level security;

  drop policy if exists hub_public_leads_select_hub on public.hub_public_leads;
  create policy hub_public_leads_select_hub
    on public.hub_public_leads for select
    to authenticated
    using (public.is_hub_admin());

  drop policy if exists hub_public_leads_update_hub on public.hub_public_leads;
  create policy hub_public_leads_update_hub
    on public.hub_public_leads for update
    to authenticated
    using (public.is_hub_admin())
    with check (public.is_hub_admin());

  -- Sem política de insert para anon/authenticated: só a RPC (SECURITY DEFINER) insere.

  grant select on public.hub_public_leads to authenticated;
