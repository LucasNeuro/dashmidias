/** Mensagens em pt-BR para erros comuns do Supabase Auth (signIn/signUp). */

export function formatAuthError(error) {
  if (!error) return 'Falha na autenticação.';
  const raw = String(error.message || error.msg || '').trim();
  const code = error.code || error.status;

  if (!raw && !code) return 'Falha na autenticação.';

  if (/email not confirmed/i.test(raw) || code === 'email_not_confirmed') {
    return (
      'E-mail ainda não confirmado. Peça ao administrador do projeto no Supabase para desativar a confirmação obrigatória ' +
      '(Authentication → Providers → E-mail → desligar “Confirm email”). ' +
      'Alternativa: abra o link de confirmação enviado para a sua caixa de entrada (e spam).'
    );
  }

  if (/invalid login credentials/i.test(raw) || code === 'invalid_credentials') {
    return 'E-mail ou senha incorretos.';
  }

  if (/user already registered/i.test(raw)) {
    return 'Este e-mail já está cadastrado. Use “Entrar” ou recuperação de senha.';
  }

  if (/password should be at least/i.test(raw)) {
    return raw;
  }

  return raw || 'Falha na autenticação.';
}
