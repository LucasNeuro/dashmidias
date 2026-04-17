-- =============================================================================
-- Owner do HUB (responsável pela fila de solicitações em /adm)
--
-- Desenvolvimento local — opções:
--   A) SQL Editor: database/seed_owner_dev_auth_sql.sql (e-mail + senha bcrypt + promoção)
--   B) Node: cd frontend && npm run seed:owner (SUPABASE_SERVICE_ROLE_KEY + DEV_OWNER_* no .env.local)
-- Não commite senhas nem service role.
--
-- Este ficheiro SQL só **promove** quem já existe em auth.users (painel Add user ou script acima).
-- O que é só na interface: a fila em /adm pode filtrar por **VITE_HUB_OWNER_EMAIL** (opcional).
--
-- Ordem manual: 1) utilizador em Auth  2) este SQL no SQL Editor  3) VITE_HUB_OWNER_EMAIL no frontend
-- Idempotente.
-- =============================================================================

DO $$
DECLARE
  v_owner_email text := 'lucasoffgod@hotmail.com';  -- alinhar VITE_HUB_OWNER_EMAIL no frontend
  v_id uuid;
BEGIN
  SELECT u.id INTO v_id
  FROM auth.users u
  WHERE lower(trim(u.email)) = lower(trim(v_owner_email));

  IF v_id IS NULL THEN
    RAISE EXCEPTION
      'Nenhum usuário em auth.users com o e-mail "%". Crie a conta em Auth antes de rodar o seed.',
      v_owner_email;
  END IF;

  INSERT INTO public.hub_admins (user_id, ativo, criado_por_user_id)
  VALUES (v_id, true, NULL)
  ON CONFLICT (user_id) DO UPDATE
  SET
    ativo = true,
    atualizado_em = now();

  INSERT INTO public.perfis (user_id, nome_exibicao, administrador_hub, atualizado_em)
  SELECT
    v_id,
    coalesce(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
    true,
    now()
  FROM auth.users u
  WHERE u.id = v_id
  ON CONFLICT (user_id) DO UPDATE
  SET
    administrador_hub = true,
    atualizado_em = now();

  INSERT INTO public.profiles (id, email, full_name, role, can_access_audit, updated_at)
  SELECT
    u.id,
    u.email,
    coalesce(u.raw_user_meta_data->>'full_name', ''),
    'owner',
    true,
    now()
  FROM auth.users u
  WHERE u.id = v_id
  ON CONFLICT (id) DO UPDATE
  SET
    role = 'owner',
    can_access_audit = true,
    updated_at = now();

  RAISE NOTICE 'Owner HUB (admin) configurado para user_id % (%) — defina VITE_HUB_OWNER_EMAIL=% no frontend.',
    v_id,
    v_owner_email,
    lower(trim(v_owner_email));
END $$;
