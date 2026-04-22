-- Slug opcional para links de convite (?tpl=meu-slug) em vez do UUID.
-- Idempotente. Aplicar no SQL Editor do Supabase.

alter table public.registration_form_template
  add column if not exists invite_slug text;

create unique index if not exists registration_form_template_invite_slug_key
  on public.registration_form_template (invite_slug)
  where invite_slug is not null and trim(invite_slug) <> '';

comment on column public.registration_form_template.invite_slug is
  'Slug único opcional no parâmetro tpl do cadastro público; vazio = usar só id UUID.';
