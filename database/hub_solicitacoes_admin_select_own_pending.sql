-- Permite ao utilizador autenticado ler a própria solicitação pendente.
-- Sem isto, só is_hub_admin() via SELECT → o front nunca deteta hubSolicitacaoPendente
-- e o utilizador cai em /crm em vez de /acesso/pendente-hub.
--
-- Rode no SQL Editor do Supabase após revisão.

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

comment on policy "hub_solic_select_own_pending" on public.hub_solicitacoes_admin is
  'Dono do pedido lê linha pendente (user_id ou email JWT) para o fluxo /acesso/pendente-hub.';
