-- Opções do cadastro público por template (CNPJ obrigatório, pedir CPF).
-- Aplicar no SQL Editor do Supabase quando existir `public.registration_form_template`.

ALTER TABLE public.registration_form_template
ADD COLUMN IF NOT EXISTS signup_settings jsonb NOT NULL DEFAULT '{"cnpjRequired": true, "collectCpf": false}'::jsonb;

COMMENT ON COLUMN public.registration_form_template.signup_settings IS
'JSON: { "cnpjRequired": boolean, "collectCpf": boolean, "disabledBuiltinGroups": string[] } — regras da etapa Empresa e blocos built-in (ex.: "logistica", "produto_servico") no convite.';
