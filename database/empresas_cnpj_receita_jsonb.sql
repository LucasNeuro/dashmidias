-- Snapshot JSON da Receita Federal via OpenCNPJ (GET https://api.opencnpj.org/{CNPJ}?datasets=receita)
-- Executar no Supabase SQL Editor após revisão. Ajuste nomes se `public.empresas` já existir com outro contrato.

-- Colunas em empresas PJ: CNPJ normalizado + payload completo + cache
alter table public.empresas
  add column if not exists cnpj_normalizado text;

alter table public.empresas
  add column if not exists dados_receita_jsonb jsonb;

alter table public.empresas
  add column if not exists receita_consultado_em timestamptz;

alter table public.empresas
  add column if not exists receita_fonte text default 'opencnpj';

comment on column public.empresas.cnpj_normalizado is '14 dígitos, sem máscara; chave de deduplicação com API';
comment on column public.empresas.dados_receita_jsonb is 'Resposta JSON (receita) da API OpenCNPJ; estrutura pode evoluir';
comment on column public.empresas.receita_consultado_em is 'Última consulta bem-sucedida à API';
comment on column public.empresas.receita_fonte is 'Identificador da origem do snapshot (ex.: opencnpj)';

create unique index if not exists empresas_organizacao_cnpj_unique
  on public.empresas (organizacao_id, cnpj_normalizado)
  where cnpj_normalizado is not null;

create index if not exists empresas_dados_receita_gin
  on public.empresas using gin (dados_receita_jsonb);
