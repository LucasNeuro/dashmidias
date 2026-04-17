-- Solicitações públicas de perfil administrativo HUB (formulário /acesso/governanca-hub).
-- Aprovação na UI em /adm (filtrada por VITE_HUB_OWNER_EMAIL no frontend).

create table if not exists public.hub_solicitacoes_admin (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  nome text not null,
  mensagem text,
  status text not null default 'pendente' check (status in ('pendente', 'aprovado', 'rejeitado')),
  criado_em timestamptz not null default now(),
  resolvido_em timestamptz,
  resolvido_por_user_id uuid
);

create index if not exists hub_solicitacoes_admin_status_criado
  on public.hub_solicitacoes_admin (status, criado_em desc);

alter table public.hub_solicitacoes_admin enable row level security;

drop policy if exists "hub_solic_insert_public" on public.hub_solicitacoes_admin;
create policy "hub_solic_insert_public"
  on public.hub_solicitacoes_admin for insert
  to anon, authenticated
  with check (status = 'pendente');

drop policy if exists "hub_solic_select_hub" on public.hub_solicitacoes_admin;
create policy "hub_solic_select_hub"
  on public.hub_solicitacoes_admin for select
  using (public.is_hub_admin());

-- Dono do pedido: ver própria linha pendente (ver hub_solicitacoes_admin_select_own_pending.sql)
drop policy if exists "hub_solic_select_own_pending" on public.hub_solicitacoes_admin;
create policy "hub_solic_select_own_pending"
  on public.hub_solicitacoes_admin for select
  to authenticated
  using (
    status = 'pendente'
    and (
      user_id = auth.uid()
      or lower(trim(coalesce(email, ''))) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
    )
  );

drop policy if exists "hub_solic_update_hub" on public.hub_solicitacoes_admin;
create policy "hub_solic_update_hub"
  on public.hub_solicitacoes_admin for update
  using (public.is_hub_admin())
  with check (public.is_hub_admin());

comment on table public.hub_solicitacoes_admin is 'Pedidos de acesso administrativo ao HUB; aprovação operacional + promoção em hub_admins separada.';

-- Extensão (migração hub_solicitacoes_admin_campos_credencial): telefone, cpf, user_id + policy insert
-- alter table public.hub_solicitacoes_admin add column if not exists telefone text;
-- alter table public.hub_solicitacoes_admin add column if not exists cpf text;
-- alter table public.hub_solicitacoes_admin add column if not exists user_id uuid references auth.users(id) on delete set null;
-- recreate policy hub_solic_insert_public with check (status = 'pendente' and (user_id is null or user_id = auth.uid()));
