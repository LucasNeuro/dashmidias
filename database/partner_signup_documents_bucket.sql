-- Bucket privado para anexos do cadastro público de parceiros (hub_partner_org_signups).
-- O front grava em `dados_formulario.extras.<chave>` um JSON com bucket, path, name, etc.
-- Ver `frontend/src/lib/partnerSignupStorage.js`.
--
-- Depois de criar o bucket: no painel Storage → bucket → limites / MIME permitidos (ex.: 15 MB, PDF e imagens).
-- Front opcional: VITE_PARTNER_SIGNUP_DOCS_BUCKET=partner_signup_documents

insert into storage.buckets (id, name, public)
values ('partner_signup_documents', 'partner_signup_documents', false)
on conflict (id) do nothing;

-- Políticas em storage.objects (ajustar SELECT ao vosso modelo de admin).

drop policy if exists "partner_signup_docs_insert_anon" on storage.objects;
create policy "partner_signup_docs_insert_anon"
on storage.objects
for insert
to anon
with check (
  bucket_id = 'partner_signup_documents'
  and name like 'signup_uploads/%'
);

drop policy if exists "partner_signup_docs_insert_authenticated" on storage.objects;
create policy "partner_signup_docs_insert_authenticated"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'partner_signup_documents'
  and name like 'signup_uploads/%'
);

-- Leitura: adicionar policy de SELECT só para perfis HUB/admin ou usar signed URLs via Edge Function (service role).
