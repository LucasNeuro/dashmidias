-- Opcional: alinhar preferência de ambiente (UI) ao perfil para futura RLS ou relatórios.
-- O front já persiste em localStorage (`app-portal`); esta coluna permite espelhar no servidor quando fizer sentido.
-- Rode no SQL Editor do Supabase após validar.

alter table public.profiles
  add column if not exists portal_preferido text;

comment on column public.profiles.portal_preferido is
  'Ambiente de produto preferido na UI: hub | imoveis. Mesmo CRM e Auth; segregação de jornada.';

-- Opcional: reforçar valores (descomente se a tabela estiver limpa ou após backfill)
-- alter table public.profiles drop constraint if exists profiles_portal_preferido_check;
-- alter table public.profiles
--   add constraint profiles_portal_preferido_check
--   check (portal_preferido is null or portal_preferido in ('hub', 'imoveis'));
