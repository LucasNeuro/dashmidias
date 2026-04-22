-- Coluna: campos padrão do cadastro HUB (produto/serviço + logística) ocultos por template.
-- Lista de `key` dos builtins; vazio = todos ativos. O cliente compara sem distinguir maiúsculas.
-- Aplicar no SQL Editor do Supabase após existir `public.registration_form_template`.

ALTER TABLE public.registration_form_template
  ADD COLUMN IF NOT EXISTS standard_fields_disabled jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.registration_form_template.standard_fields_disabled IS
  'Keys de campos padrão (código) a não mostrar neste convite; [] = todos visíveis.';
