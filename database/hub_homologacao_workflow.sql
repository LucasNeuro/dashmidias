-- =============================================================================
-- Homologação: etapas operacionais (Kanban HUB) + timeline pública
-- Documentação: docs/CADASTRO_ORGANIZACOES_E_USUARIOS.md, docs/ESTRUTURA_CODIGOS_IDENTIFICADORES_HUB.md §5
-- -----------------------------------------------------------------------------
-- workflow_etapa: pendente | aguardando_retorno | em_analise | aprovado
--   (enquanto status ∈ {pendente, aprovado}; limpo em processado/rejeitado)
-- hub_partner_org_signup_timeline: eventos com rótulo legível para o parceiro
--
-- Aplicar no Supabase após hub_partner_org_signups existir. Depois: actualizar
-- hub_submit + hub_public_homologacao_status no ficheiro RPC (ou reaplicar patch).
-- =============================================================================

-- --- Colunas no pedido ---------------------------------------------------------------
alter table public.hub_partner_org_signups
  add column if not exists workflow_etapa text;

alter table public.hub_partner_org_signups
  add column if not exists workflow_etapa_em timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'hub_partner_org_signups_workflow_etapa_chk'
      and conrelid = 'public.hub_partner_org_signups'::regclass
  ) then
    alter table public.hub_partner_org_signups
      add constraint hub_partner_org_signups_workflow_etapa_chk
      check (
        workflow_etapa is null
        or workflow_etapa = any (
          array[
            'pendente'::text,
            'aguardando_retorno'::text,
            'em_analise'::text,
            'aprovado'::text
          ]
        )
      );
  end if;
end $$;

comment on column public.hub_partner_org_signups.workflow_etapa is
  'Coluna Kanban HUB: pendente → aguardando_retorno → em_analise → aprovado (antes de provisionar).';

-- --- Timeline (só via SECURITY DEFINER + trigger; sem SELECT público directo) -------
create table if not exists public.hub_partner_org_signup_timeline (
  id uuid primary key default gen_random_uuid(),
  signup_id uuid not null references public.hub_partner_org_signups (id) on delete cascade,
  evento text not null default 'workflow_etapa'
    check (evento = any (array['workflow_etapa'::text, 'status_change'::text, 'sistema'::text])),
  etapa_anterior text,
  etapa_nova text,
  rotulo_publico text not null,
  criado_em timestamptz not null default timezone('utc', now())
);

create index if not exists hub_partner_org_signup_timeline_signup_criado
  on public.hub_partner_org_signup_timeline (signup_id, criado_em);

comment on table public.hub_partner_org_signup_timeline is
  'Histórico de etapas da homologação — exposto ao parceiro via hub_public_homologacao_status.';

alter table public.hub_partner_org_signup_timeline enable row level security;

-- Sem políticas: acesso só por funções security definer.

-- --- Trigger: alterações de status (rejeitado / processado) -------------------------
create or replace function public.hub_signup_timeline_on_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if new.status = 'processado' and old.status is distinct from 'processado' then
      insert into public.hub_partner_org_signup_timeline (
        signup_id, evento, rotulo_publico, etapa_anterior, etapa_nova
      )
      values (
        new.id,
        'status_change',
        'Homologação concluída — organização criada. Verifique o e-mail do cadastro para aceitar o convite.',
        old.status::text,
        new.status::text
      );
    elsif new.status = 'rejeitado' then
      insert into public.hub_partner_org_signup_timeline (
        signup_id, evento, rotulo_publico, etapa_anterior, etapa_nova
      )
      values (
        new.id,
        'status_change',
        'O pedido não foi homologado nesta fase. Pode contactar a equipa Obra10+ para mais informações.',
        old.status::text,
        new.status::text
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_hub_signup_timeline_status on public.hub_partner_org_signups;
create trigger trg_hub_signup_timeline_status
  after update of status on public.hub_partner_org_signups
  for each row
  execute function public.hub_signup_timeline_on_status_change();

-- --- Admin HUB: mover cartão Kanban -------------------------------------------------
create or replace function public.hub_admin_set_signup_workflow_etapa(
  p_signup_id uuid,
  p_etapa text
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_uid uuid := auth.uid();
  v_old text;
  v_new text := lower(trim(coalesce(p_etapa, '')));
  v_rotulo text;
  st text;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;
  if not public.is_hub_admin() then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  if p_signup_id is null then
    return jsonb_build_object('ok', false, 'error', 'signup_required');
  end if;

  if v_new not in ('pendente', 'aguardando_retorno', 'em_analise', 'aprovado') then
    return jsonb_build_object('ok', false, 'error', 'invalid_etapa');
  end if;

  select s.status, s.workflow_etapa
  into st, v_old
  from public.hub_partner_org_signups s
  where s.id = p_signup_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if st not in ('pendente', 'aprovado') then
    return jsonb_build_object('ok', false, 'error', 'invalid_state', 'detail', st);
  end if;

  v_rotulo := case v_new
    when 'pendente' then 'Pedido em fila inicial de homologação.'
    when 'aguardando_retorno' then 'Aguardamos documentos ou resposta sua para continuar.'
    when 'em_analise' then 'A equipa Obra10+ está a analisar o pedido.'
    when 'aprovado' then 'Homologação aprovada pela equipa — em preparação da formalização (organização e convite).'
    else 'Actualização do pedido.'
  end;

  update public.hub_partner_org_signups
  set
    workflow_etapa = v_new,
    workflow_etapa_em = timezone('utc', now())
  where id = p_signup_id;

  insert into public.hub_partner_org_signup_timeline (
    signup_id, evento, rotulo_publico, etapa_anterior, etapa_nova
  )
  values (
    p_signup_id,
    'workflow_etapa',
    v_rotulo,
    v_old,
    v_new
  );

  return jsonb_build_object('ok', true);
end;
$$;

comment on function public.hub_admin_set_signup_workflow_etapa(uuid, text) is
  'Admin HUB: actualiza coluna Kanban workflow_etapa e regista linha na timeline pública.';

revoke all on function public.hub_admin_set_signup_workflow_etapa(uuid, text) from public;
grant execute on function public.hub_admin_set_signup_workflow_etapa(uuid, text) to authenticated;

-- --- Backfill -----------------------------------------------------------------------
update public.hub_partner_org_signups
set
  workflow_etapa = case
    when status = 'pendente' then coalesce(workflow_etapa, 'pendente'::text)
    when status = 'aprovado' then coalesce(workflow_etapa, 'aprovado'::text)
    else null
  end,
  workflow_etapa_em = coalesce(workflow_etapa_em, criado_em)
where status in ('pendente', 'aprovado')
  and (workflow_etapa is null or workflow_etapa_em is null);

-- Primeira linha de timeline para pedidos antigos sem histórico
insert into public.hub_partner_org_signup_timeline (signup_id, evento, rotulo_publico, criado_em)
select
  s.id,
  'sistema',
  'Pedido registado na plataforma.',
  s.criado_em
from public.hub_partner_org_signups s
where not exists (
  select 1 from public.hub_partner_org_signup_timeline t where t.signup_id = s.id
);

notify pgrst, 'reload schema';
