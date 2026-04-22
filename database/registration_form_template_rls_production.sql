-- =============================================================================
-- RLS para `registration_form_template` (campos em coluna `fields jsonb`)
--
-- Alinha ao schema em produção: SEM `slug`, SEM tabela `registration_form_template_field`.
--
-- ANTES (obrigatório se aparecer recursão em hub_admins ao usar is_hub_admin):
--   database/fix_hub_admins_rls_recursion.sql
--
-- Rode no SQL Editor do Supabase (idempotente: DROP POLICY IF EXISTS + recria).
--
-- Coluna `standard_fields_disabled` (ativar/desativar campos padrão por template):
--   database/registration_form_template_standard_fields_disabled.sql
-- =============================================================================

ALTER TABLE public.registration_form_template ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rft_select_invite ON public.registration_form_template;
DROP POLICY IF EXISTS rft_select_anon ON public.registration_form_template;
DROP POLICY IF EXISTS rft_select_auth ON public.registration_form_template;

CREATE POLICY rft_select_anon
  ON public.registration_form_template
  FOR SELECT
  TO anon
  USING (invite_link_enabled = true);

CREATE POLICY rft_select_auth
  ON public.registration_form_template
  FOR SELECT
  TO authenticated
  USING (invite_link_enabled = true OR public.is_hub_admin());

DROP POLICY IF EXISTS rft_insert_platform ON public.registration_form_template;
DROP POLICY IF EXISTS rft_update_platform ON public.registration_form_template;
DROP POLICY IF EXISTS rft_delete_platform ON public.registration_form_template;

CREATE POLICY rft_insert_platform
  ON public.registration_form_template
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_hub_admin()
    AND organization_id IS NULL
  );

CREATE POLICY rft_update_platform
  ON public.registration_form_template
  FOR UPDATE
  TO authenticated
  USING (public.is_hub_admin() AND organization_id IS NULL)
  WITH CHECK (public.is_hub_admin() AND organization_id IS NULL);

CREATE POLICY rft_delete_platform
  ON public.registration_form_template
  FOR DELETE
  TO authenticated
  USING (public.is_hub_admin() AND organization_id IS NULL);

GRANT SELECT ON public.registration_form_template TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.registration_form_template TO authenticated, service_role;

COMMENT ON TABLE public.registration_form_template IS
  'Modelos de convite (cadastro parceiro). Campos extra em `fields` (jsonb). RLS: leitura pública só com convite ativo; CRUD com is_hub_admin() para organization_id nulo.';
