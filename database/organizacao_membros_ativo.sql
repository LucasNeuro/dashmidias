-- Ativação/desativação lógica de membros de organização (para Controles e acessos).
alter table public.organizacao_membros
  add column if not exists ativo boolean not null default true;

create index if not exists idx_organizacao_membros_ativo
  on public.organizacao_membros (ativo);

comment on column public.organizacao_membros.ativo is
  'Ativo/inativo no acesso da organização (controle operacional no HUB).';

