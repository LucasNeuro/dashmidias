-- =============================================================================
-- Unicidade de CNPJ/CPF em pedidos de parceiro (coluna hub_partner_org_signups.cnpj)
-- -----------------------------------------------------------------------------
-- Regra: não permitir novo pedido com o mesmo documento (14 ou 11 dígitos) se já
-- existir linha em pendente, aprovado ou processado. Pedidos rejeitados podem ser
-- refeitos (novo pedido com o mesmo documento).
--
-- Inclui:
--   1) Índice único parcial (substitui hub_partner_org_signups_one_pending_per_doc)
--   2) Ajuste em hub_submit_partner_org_signup
--   3) RPC pública hub_check_partner_org_signup_document (validação no formulário)
--
-- Se CREATE UNIQUE INDEX falhar por duplicados históricos, corrija antes, ex.:
--   SELECT cnpj, status, count(*) FROM hub_partner_org_signups
--   WHERE status IN ('pendente','aprovado','processado') GROUP BY 1,2 HAVING count(*) > 1;
-- =============================================================================

DROP INDEX IF EXISTS public.hub_partner_org_signups_one_pending_per_doc;

CREATE UNIQUE INDEX IF NOT EXISTS hub_partner_org_signups_one_active_per_doc
  ON public.hub_partner_org_signups (cnpj)
  WHERE (status = ANY (ARRAY['pendente'::text, 'aprovado'::text, 'processado'::text]));

COMMENT ON INDEX public.hub_partner_org_signups_one_active_per_doc IS
  'Um documento (CNPJ 14 ou CPF 11 em cnpj) só pode ter um pedido activo no funil; rejeitados não entram no índice.';

-- --- Submissão: bloquear duplicado antes do insert + violação do índice ------------
CREATE OR REPLACE FUNCTION public.hub_submit_partner_org_signup(
  p_email text,
  p_cnpj text,
  p_dados_formulario jsonb,
  p_cnpja_snapshot jsonb DEFAULT NULL,
  p_consulta_fonte text DEFAULT NULL,
  p_template_id text DEFAULT NULL,
  p_partner_kind text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = OFF
AS $$
DECLARE
  v_email text := lower(trim(coalesce(p_email, '')));
  v_doc text := trim(coalesce(p_cnpj, ''));
  v_tipo text;
  v_prefix text;
  v_codigo text;
  v_id uuid;
BEGIN
  IF v_email = '' OR position('@' IN v_email) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'email_invalid');
  END IF;
  IF v_doc = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'document_required');
  END IF;
  IF p_dados_formulario IS NULL OR jsonb_typeof(p_dados_formulario) != 'object' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'dados_required');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.hub_partner_org_signups s
    WHERE s.cnpj = v_doc
      AND s.status = ANY (ARRAY['pendente'::text, 'aprovado'::text, 'processado'::text])
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'duplicate_document');
  END IF;

  v_tipo := coalesce(nullif(trim(p_partner_kind), ''), 'outro');
  v_prefix := public.hub_partner_kind_to_org_prefix(v_tipo);

  v_codigo := public._next_org_codigo_rastreio(v_prefix);

  INSERT INTO public.hub_partner_org_signups (
    email,
    cnpj,
    dados_formulario,
    cnpja_snapshot,
    consulta_fonte,
    template_id,
    partner_kind,
    status,
    codigo_rastreio,
    workflow_etapa,
    workflow_etapa_em
  )
  VALUES (
    v_email,
    v_doc,
    p_dados_formulario,
    p_cnpja_snapshot,
    nullif(trim(p_consulta_fonte), ''),
    nullif(trim(p_template_id), ''),
    nullif(trim(p_partner_kind), ''),
    'pendente',
    v_codigo,
    'pendente',
    timezone('utc', now())
  )
  RETURNING id INTO v_id;

  INSERT INTO public.hub_partner_org_signup_timeline (signup_id, evento, rotulo_publico)
  VALUES (v_id, 'sistema', 'Pedido de cadastro recebido com sucesso.');

  RETURN jsonb_build_object(
    'ok', true,
    'signup_id', v_id,
    'codigo_rastreio', v_codigo
  );
EXCEPTION
  WHEN unique_violation THEN
    IF sqlerrm ILIKE '%hub_partner_org_signups_one_active_per_doc%'
      OR sqlerrm ILIKE '%hub_partner_org_signups_one_pending_per_doc%' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'duplicate_document', 'detail', sqlerrm);
    END IF;
    RETURN jsonb_build_object('ok', false, 'error', 'duplicate_codigo', 'detail', sqlerrm);
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', 'sql_error', 'detail', sqlerrm);
END;
$$;

COMMENT ON FUNCTION public.hub_submit_partner_org_signup(text, text, jsonb, jsonb, text, text, text) IS
  'Cadastro público de parceiro: insere pedido pendente e reserva codigo_rastreio HUB-OPP-*; bloqueia documento já usado em pedido activo.';

-- --- Leitura pública: disponibilidade do documento (formulário) --------------------
CREATE OR REPLACE FUNCTION public.hub_check_partner_org_signup_document(p_doc text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = OFF
AS $$
DECLARE
  v_doc text := regexp_replace(trim(coalesce(p_doc, '')), '\D', '', 'g');
BEGIN
  IF length(v_doc) NOT IN (11, 14) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_document');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.hub_partner_org_signups s
    WHERE s.cnpj = v_doc
      AND s.status = ANY (ARRAY['pendente'::text, 'aprovado'::text, 'processado'::text])
  ) THEN
    RETURN jsonb_build_object('ok', true, 'available', false);
  END IF;

  RETURN jsonb_build_object('ok', true, 'available', true);
END;
$$;

COMMENT ON FUNCTION public.hub_check_partner_org_signup_document(text) IS
  'Anónimo: indica se CNPJ (14) ou CPF (11) já está em pedido pendente/aprovado/processado.';

REVOKE ALL ON FUNCTION public.hub_check_partner_org_signup_document(text) FROM public;
GRANT EXECUTE ON FUNCTION public.hub_check_partner_org_signup_document(text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
