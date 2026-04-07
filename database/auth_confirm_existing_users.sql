-- =============================================================================
-- Marca e-mails como confirmados (contas já criadas antes de desligar
-- "Confirm email" no Supabase). Rode no SQL Editor do Supabase com projeto parado
-- de exigir confirmação (ou use só para corrigir usuários legados).
--
-- Preferível em definitivo: Authentication → Providers → Email → OFF "Confirm email"
-- =============================================================================

-- Um usuário específico:
-- update auth.users
-- set email_confirmed_at = coalesce(email_confirmed_at, now())
-- where email = 'seu@email.com';

-- Todos os usuários ainda sem confirmação (use com cuidado em produção):
update auth.users
set email_confirmed_at = coalesce(email_confirmed_at, now())
where email_confirmed_at is null;
