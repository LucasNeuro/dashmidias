-- =============================================================================
-- panel_access_logs: RLS auditável + índices + RPC de métricas (Supabase SQL)
-- Pré-requisito: public.has_audit_access() (ver rls_hub_admin_governanca_total.sql)
-- Rode no SQL Editor após revisão.
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_panel_access_logs_accessed_at_desc
  ON public.panel_access_logs (accessed_at DESC);

CREATE INDEX IF NOT EXISTS idx_panel_access_logs_user_id
  ON public.panel_access_logs (user_id);

ALTER TABLE public.panel_access_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "panel_access_logs_insert_own" ON public.panel_access_logs;
CREATE POLICY "panel_access_logs_insert_own"
  ON public.panel_access_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "panel_access_logs_select_audit" ON public.panel_access_logs;
CREATE POLICY "panel_access_logs_select_audit"
  ON public.panel_access_logs
  FOR SELECT
  TO authenticated
  USING (public.has_audit_access());

COMMENT ON POLICY "panel_access_logs_insert_own" ON public.panel_access_logs IS
  'Cada utilizador regista apenas os próprios acessos ao painel.';
COMMENT ON POLICY "panel_access_logs_select_audit" ON public.panel_access_logs IS
  'Leitura global dos logs apenas para quem tem has_audit_access() (governança).';

-- Métricas agregadas no servidor (evita carregar milhares de linhas no cliente)
CREATE OR REPLACE FUNCTION public.audit_panel_stats(p_since timestamptz DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r jsonb;
BEGIN
  IF NOT public.has_audit_access() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'total',
      (SELECT count(*)::bigint FROM public.panel_access_logs pal
       WHERE (p_since IS NULL OR pal.accessed_at >= p_since)),
    'distinct_users',
      (SELECT count(DISTINCT user_id)::bigint FROM public.panel_access_logs pal
       WHERE (p_since IS NULL OR pal.accessed_at >= p_since)),
    'distinct_paths',
      (SELECT count(DISTINCT path)::bigint FROM public.panel_access_logs pal
       WHERE (p_since IS NULL OR pal.accessed_at >= p_since)),
    'last_access',
      (SELECT max(accessed_at) FROM public.panel_access_logs pal
       WHERE (p_since IS NULL OR pal.accessed_at >= p_since)),
    'by_kind',
      jsonb_build_object(
        'gov',
          (SELECT count(*)::bigint FROM public.panel_access_logs pal
           WHERE (p_since IS NULL OR pal.accessed_at >= p_since) AND coalesce(path, '') LIKE '/adm%'),
        'ops',
          (SELECT count(*)::bigint FROM public.panel_access_logs pal
           WHERE (p_since IS NULL OR pal.accessed_at >= p_since)
             AND (coalesce(path, '') = '/' OR coalesce(path, '') LIKE '/painel%' OR coalesce(path, '') LIKE '/crm%')),
        'auth',
          (SELECT count(*)::bigint FROM public.panel_access_logs pal
           WHERE (p_since IS NULL OR pal.accessed_at >= p_since)
             AND (coalesce(path, '') LIKE '/entrada%' OR coalesce(path, '') LIKE '/login%')),
        'other',
          (SELECT count(*)::bigint FROM public.panel_access_logs pal
           WHERE (p_since IS NULL OR pal.accessed_at >= p_since)
             AND NOT (
               coalesce(path, '') LIKE '/adm%'
               OR coalesce(path, '') = '/'
               OR coalesce(path, '') LIKE '/painel%'
               OR coalesce(path, '') LIKE '/crm%'
               OR coalesce(path, '') LIKE '/entrada%'
               OR coalesce(path, '') LIKE '/login%'
             ))
      )
  )
  INTO r;

  RETURN r;
END;
$$;

COMMENT ON FUNCTION public.audit_panel_stats(timestamptz) IS
  'Métricas de panel_access_logs para o painel de auditoria; só has_audit_access().';

GRANT EXECUTE ON FUNCTION public.audit_panel_stats(timestamptz) TO authenticated;
