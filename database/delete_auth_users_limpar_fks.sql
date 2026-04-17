-- =============================================================================
-- Por que o Dashboard não apaga utilizadores
-- -----------------------------------------------------------------------------
-- Várias tabelas em `public` têm FK para `auth.users` com ON DELETE NO ACTION
-- (ou equivalente). O painel tenta apagar o utilizador e o Postgres bloqueia.
--
-- Este script: 1) anula ou apaga linhas em `public` 2) apaga `auth.users`.
-- Rode no SQL Editor. Ajuste a lista de e-mails. Revise antes em produção.
-- =============================================================================

BEGIN;

CREATE TEMP TABLE _alvo_auth_delete ON COMMIT DROP AS
SELECT id, email
FROM auth.users
WHERE email IN (
  'lucasoffgod@hotmail.com',
  'marcondeslucas979@gmail.com',
  'nice.engemp@gmail.com',
  'ramonexercito@gmail.com'
);

UPDATE public.domain_events e
SET ator_user_id = NULL
WHERE EXISTS (SELECT 1 FROM _alvo_auth_delete a WHERE a.id = e.ator_user_id);

UPDATE public.negocios n
SET responsavel_user_id = NULL
WHERE EXISTS (SELECT 1 FROM _alvo_auth_delete a WHERE a.id = n.responsavel_user_id);

UPDATE public.convites_administrador_hub c
SET criado_por_user_id = NULL
WHERE EXISTS (SELECT 1 FROM _alvo_auth_delete a WHERE a.id = c.criado_por_user_id);

UPDATE public.convites_administrador_hub c
SET usado_por_user_id = NULL
WHERE EXISTS (SELECT 1 FROM _alvo_auth_delete a WHERE a.id = c.usado_por_user_id);

UPDATE public.organizacao_convites o
SET criado_por_user_id = NULL
WHERE EXISTS (SELECT 1 FROM _alvo_auth_delete a WHERE a.id = o.criado_por_user_id);

UPDATE public.organizacao_convites o
SET usado_por_user_id = NULL
WHERE EXISTS (SELECT 1 FROM _alvo_auth_delete a WHERE a.id = o.usado_por_user_id);

UPDATE public.organizacoes org
SET criado_por_user_id = NULL
WHERE EXISTS (SELECT 1 FROM _alvo_auth_delete a WHERE a.id = org.criado_por_user_id);

UPDATE public.hub_admins h
SET criado_por_user_id = NULL
WHERE EXISTS (SELECT 1 FROM _alvo_auth_delete a WHERE a.id = h.criado_por_user_id);

UPDATE public.pessoas p
SET user_id = NULL
WHERE EXISTS (SELECT 1 FROM _alvo_auth_delete a WHERE a.id = p.user_id);

UPDATE public.hub_solicitacoes_admin s
SET resolvido_por_user_id = NULL
WHERE EXISTS (SELECT 1 FROM _alvo_auth_delete a WHERE a.id = s.resolvido_por_user_id);

DELETE FROM public.organizacao_membros m
WHERE EXISTS (SELECT 1 FROM _alvo_auth_delete a WHERE a.id = m.user_id);

DELETE FROM public.hub_admins h
WHERE EXISTS (SELECT 1 FROM _alvo_auth_delete a WHERE a.id = h.user_id);

DELETE FROM public.perfis p
WHERE EXISTS (SELECT 1 FROM _alvo_auth_delete a WHERE a.id = p.user_id);

DELETE FROM public.profiles pr
WHERE EXISTS (SELECT 1 FROM _alvo_auth_delete a WHERE a.id = pr.id);

DELETE FROM public.panel_access_logs pal
WHERE EXISTS (SELECT 1 FROM _alvo_auth_delete a WHERE a.id = pal.user_id);

DELETE FROM auth.users u
WHERE EXISTS (SELECT 1 FROM _alvo_auth_delete a WHERE a.id = u.id);

COMMIT;

-- Se algum DELETE falhar, rode ROLLBACK; manualmente e copie a mensagem de erro.
-- Para listar FKs para auth.users:
--   select conrelid::regclass, pg_get_constraintdef(oid)
--   from pg_constraint where confrelid = 'auth.users'::regclass and contype = 'f';
