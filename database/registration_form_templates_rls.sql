-- =============================================================================
-- Modelos de formulário de cadastro (convites parceiros) — tabelas + RLS
--
-- ANTES, se tiver 500 / recursão em hub_admins ou is_hub_admin, rode:
--   database/fix_hub_admins_rls_recursion.sql
--
-- Aplicar no Supabase: SQL Editor (ou supabase db push) no projeto.
-- =============================================================================

-- Tabela principal
CREATE TABLE IF NOT EXISTS public.registration_form_template (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NULL REFERENCES public.organizacoes (id) ON DELETE SET NULL,
  slug text NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT ''::text,
  partner_kind text NOT NULL,
  invite_link_enabled boolean NOT NULL DEFAULT true,
  created_by_user_id uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT registration_form_template_slug_key UNIQUE (slug)
);

-- Campos extra do template
CREATE TABLE IF NOT EXISTS public.registration_form_template_field (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id uuid NOT NULL REFERENCES public.registration_form_template (id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  field_key text NOT NULL,
  label text NOT NULL,
  field_type text NOT NULL,
  required boolean NOT NULL DEFAULT false,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  lookup_cnpj boolean NULL,
  CONSTRAINT registration_form_template_field_tmpl_key UNIQUE (template_id, field_key)
);

CREATE INDEX IF NOT EXISTS idx_rft_updated ON public.registration_form_template (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_rft_org ON public.registration_form_template (organization_id);
CREATE INDEX IF NOT EXISTS idx_rftf_template ON public.registration_form_template_field (template_id, sort_order);

-- updated_at automático
CREATE OR REPLACE FUNCTION public.set_registration_template_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rft_updated ON public.registration_form_template;
CREATE TRIGGER trg_rft_updated
  BEFORE UPDATE ON public.registration_form_template
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_registration_template_updated_at();

-- RLS
ALTER TABLE public.registration_form_template ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registration_form_template_field ENABLE ROW LEVEL SECURITY;

-- is_hub_admin() só tem GRANT a authenticated: políticas de leitura separadas anon / authenticated.
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
-- Mutação: só admin HUB; nesta fase, só modelos de plataforma (organization_id IS NULL)
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

DROP POLICY IF EXISTS rftf_select ON public.registration_form_template_field;
DROP POLICY IF EXISTS rftf_select_anon ON public.registration_form_template_field;
DROP POLICY IF EXISTS rftf_select_auth ON public.registration_form_template_field;
-- Campos: leitura alinhada ao template
CREATE POLICY rftf_select_anon
  ON public.registration_form_template_field
  FOR SELECT
  TO anon
  USING (EXISTS (
    SELECT 1
    FROM public.registration_form_template t
    WHERE t.id = template_id
      AND t.invite_link_enabled = true
  ));

CREATE POLICY rftf_select_auth
  ON public.registration_form_template_field
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1
    FROM public.registration_form_template t
    WHERE t.id = template_id
      AND (t.invite_link_enabled = true OR public.is_hub_admin())
  ));

DROP POLICY IF EXISTS rftf_insert ON public.registration_form_template_field;
DROP POLICY IF EXISTS rftf_update ON public.registration_form_template_field;
DROP POLICY IF EXISTS rftf_delete ON public.registration_form_template_field;
CREATE POLICY rftf_insert
  ON public.registration_form_template_field
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_hub_admin()
    AND EXISTS (
      SELECT 1
      FROM public.registration_form_template t
      WHERE t.id = template_id
        AND t.organization_id IS NULL
    )
  );

CREATE POLICY rftf_update
  ON public.registration_form_template_field
  FOR UPDATE
  TO authenticated
  USING (
    public.is_hub_admin()
    AND EXISTS (
      SELECT 1
      FROM public.registration_form_template t
      WHERE t.id = template_id
        AND t.organization_id IS NULL
    )
  )
  WITH CHECK (
    public.is_hub_admin()
    AND EXISTS (
      SELECT 1
      FROM public.registration_form_template t
      WHERE t.id = template_id
        AND t.organization_id IS NULL
    )
  );

CREATE POLICY rftf_delete
  ON public.registration_form_template_field
  FOR DELETE
  TO authenticated
  USING (
    public.is_hub_admin()
    AND EXISTS (
      SELECT 1
      FROM public.registration_form_template t
      WHERE t.id = template_id
        AND t.organization_id IS NULL
    )
  );

GRANT SELECT ON public.registration_form_template TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.registration_form_template TO authenticated, service_role;

GRANT SELECT ON public.registration_form_template_field TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.registration_form_template_field TO authenticated, service_role;

COMMENT ON TABLE public.registration_form_template IS
  'Modelos de convite (cadastro parceiro). RLS: leitura pública só com convite ativo; CRUD com is_hub_admin().';
COMMENT ON TABLE public.registration_form_template_field IS
  'Campos extra por template. CASCADE ao apagar o template.';
