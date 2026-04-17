-- =============================================================================
-- DESENVOLVIMENTO — Owner HUB: Auth (e-mail + senha) + hub_admins + perfis + profiles
--
-- O Supabase **não** guarda senha em texto: usa bcrypt. Por isso o SQL usa
--   extensions.crypt(senha, extensions.gen_salt('bf')).
--
-- Como usar (Dashboard Supabase → SQL → New query):
--   1) Ajuste v_email / v_password / v_nome no bloco abaixo, se quiser.
--   2) Execute o script inteiro.
--
-- Idempotente: se o e-mail já existir em auth.users, atualiza a senha (dev)
-- e garante linha em auth.identities + promoção em public.
--
-- Alternativa recomendada: frontend → npm run seed:owner (service role no .env.local).
-- Não use este ficheiro em produção com senhas reais versionadas.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

DO $$
DECLARE
  v_email text := 'lucasoffgod@hotmail.com';
  v_password text := '@sacola47';
  v_nome text := 'Owner HUB';
  v_id uuid;
  v_instance uuid := '00000000-0000-0000-0000-000000000000';
  v_hash text;
BEGIN
  v_hash := extensions.crypt(v_password, extensions.gen_salt('bf'));

  SELECT u.id INTO v_id
  FROM auth.users u
  WHERE lower(trim(u.email)) = lower(trim(v_email));

  IF v_id IS NULL THEN
    v_id := gen_random_uuid();

    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      last_sign_in_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token,
      email_change,
      email_change_token_new
    ) VALUES (
      v_instance,
      v_id,
      'authenticated',
      'authenticated',
      lower(trim(v_email)),
      v_hash,
      now(),
      now(),
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
      jsonb_build_object('full_name', v_nome),
      now(),
      now(),
      '',
      '',
      '',
      ''
    );

    RAISE NOTICE 'auth.users: criado % (%)', v_id, v_email;
  ELSE
    UPDATE auth.users
    SET
      encrypted_password = v_hash,
      email_confirmed_at = coalesce(email_confirmed_at, now()),
      updated_at = now(),
      raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('full_name', v_nome)
    WHERE id = v_id;

    RAISE NOTICE 'auth.users: já existia — senha (re)definida para %', v_email;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM auth.identities i WHERE i.user_id = v_id AND i.provider = 'email'
  ) THEN
    INSERT INTO auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      v_id,
      jsonb_build_object('sub', v_id::text, 'email', lower(trim(v_email))),
      'email',
      v_id::text,
      now(),
      now(),
      now()
    );
    RAISE NOTICE 'auth.identities: criada identidade email para %', v_id;
  END IF;

  INSERT INTO public.hub_admins (user_id, ativo, criado_por_user_id)
  VALUES (v_id, true, NULL)
  ON CONFLICT (user_id) DO UPDATE
  SET ativo = true, atualizado_em = now();

  INSERT INTO public.perfis (user_id, nome_exibicao, administrador_hub, atualizado_em)
  VALUES (v_id, v_nome, true, now())
  ON CONFLICT (user_id) DO UPDATE
  SET
    nome_exibicao = excluded.nome_exibicao,
    administrador_hub = true,
    atualizado_em = now();

  INSERT INTO public.profiles (id, email, full_name, role, can_access_audit, updated_at)
  VALUES (v_id, lower(trim(v_email)), v_nome, 'owner', true, now())
  ON CONFLICT (id) DO UPDATE
  SET
    email = excluded.email,
    full_name = excluded.full_name,
    role = 'owner',
    can_access_audit = true,
    updated_at = now();

  RAISE NOTICE 'OK: owner HUB promovido. user_id = % — defina VITE_HUB_OWNER_EMAIL=% no frontend (opcional).',
    v_id, lower(trim(v_email));
END $$;
