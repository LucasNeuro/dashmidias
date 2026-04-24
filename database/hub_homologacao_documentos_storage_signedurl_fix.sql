-- Correção incremental: links assinados (createSignedUrl) falhavam com RLS na tabela
-- hub_homologacao_documentos sem política SELECT — a subquery EXISTS na política Storage não via linhas.
-- Execute este ficheiro no SQL Editor se já tinha aplicado hub_homologacao_documentos.sql antes desta correcção.

create or replace function public.hub_homologacao_storage_path_is_registered(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.hub_homologacao_documentos d
    where d.storage_path = p_object_name
      and d.bucket_id = 'hub_homologacao_documentos'
  );
$$;

revoke all on function public.hub_homologacao_storage_path_is_registered(text) from public;
grant execute on function public.hub_homologacao_storage_path_is_registered(text) to anon, authenticated;

drop policy if exists "hub_homolog_docs_select_registered" on storage.objects;
create policy "hub_homolog_docs_select_registered"
on storage.objects
for select
to anon, authenticated
using (
  bucket_id = 'hub_homologacao_documentos'
  and public.hub_homologacao_storage_path_is_registered(name)
);

notify pgrst, 'reload schema';
