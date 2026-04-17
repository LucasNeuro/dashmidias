-- =============================================================================
-- Primeiro administrador do HUB (plataforma)
--
-- IMPORTANTE: não dá para criar login (senha) só com SQL no Postgres de forma
-- segura. O fluxo é:
--   1) Criar o usuário em Authentication (recomendado: cadastro pelo app em /login
--      OU Auth → Users → Add user no painel Supabase).
--   2) Ajuste v_email abaixo se for outro endereço; rode no SQL Editor.
--   3) Para role **owner** (dono da plataforma), rode antes: profiles_role_add_owner.sql
--      (expande o CHECK de profiles.role).
--
-- Idempotente: pode rodar de novo sem duplicar.
-- =============================================================================

DO $$
DECLARE
  /** Troque só se promover outro e-mail que JÁ exista em Authentication → Users. */
  v_email text := 'lucasoffgod@hotmail.com';
  v_id uuid;
BEGIN
  SELECT u.id INTO v_id
  FROM auth.users u
  WHERE lower(trim(u.email)) = lower(trim(v_email));

  IF v_id IS NULL THEN
    RAISE EXCEPTION
      'Nenhum usuário em auth.users com o e-mail "%". Crie a conta antes (app ou Supabase Auth).',
      v_email;
  END IF;

  -- Governança HUB
  INSERT INTO public.hub_admins (user_id, ativo, criado_por_user_id)
  VALUES (v_id, true, NULL)
  ON CONFLICT (user_id) DO UPDATE
  SET
    ativo = true,
    atualizado_em = now();

  -- Perfil Obra10 (espelho de admin HUB)
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

  -- public.profiles: **owner** = dono da plataforma (alinhado a hub_admins + perfis).
  -- Para outro perfil só com role **admin** (sem ser dono), mude 'owner' → 'admin' abaixo.
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

  RAISE NOTICE 'HUB admin / owner configurado para user_id % (%)', v_id, v_email;
END $$;
