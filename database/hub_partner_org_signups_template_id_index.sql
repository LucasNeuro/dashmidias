-- Índice para agregações por convite (template_id) em relatórios admin.
-- Idempotente: aplicar no SQL Editor do Supabase se ainda não existir.

CREATE INDEX IF NOT EXISTS hub_partner_org_signups_template_id_idx
  ON public.hub_partner_org_signups (template_id)
  WHERE template_id IS NOT NULL AND trim(template_id) <> '';
