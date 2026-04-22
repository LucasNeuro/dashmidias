import { useEffect, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthSplitLayout } from '../components/AuthSplitLayout';
import { useAuth } from '../context/AuthContext';
import { getPasswordChecks, isStrongPassword, strongPasswordMessage } from '../lib/passwordPolicy';

export function ResetPasswordPage() {
  const { supabase, updatePassword } = useAuth();
  const pwdId = useId();
  const pwd2Id = useId();
  const [recovery, setRecovery] = useState(false);
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  const checks = getPasswordChecks(password);
  const match = password.length > 0 && password === password2;

  useEffect(() => {
    if (!supabase) return undefined;
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setRecovery(true);
    });
    const t = setTimeout(() => setTimedOut(true), 12000);
    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(t);
    };
  }, [supabase]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (!isStrongPassword(password)) {
      setError(strongPasswordMessage());
      return;
    }
    if (!match) {
      setError('As senhas não coincidem.');
      return;
    }
    setBusy(true);
    try {
      await updatePassword(password);
      setDone(true);
    } catch (err) {
      setError(err.message || 'Não foi possível atualizar a senha');
    } finally {
      setBusy(false);
    }
  }

  const invalidLink = timedOut && !recovery && !done;

  return (
    <AuthSplitLayout heroTitle="Obra10+">
      <div className="w-full max-w-md mx-auto bg-white border-2 border-primary shadow-xl p-8 space-y-6">
        <div>
          <h2 className="text-2xl font-black text-primary tracking-tight">Redefinir senha</h2>
        </div>

        {done ? (
          <div className="space-y-4">
            <p className="text-sm text-tertiary font-semibold">Senha atualizada. Você já pode entrar com a nova senha.</p>
            <Link
              to="/login"
              className="inline-block w-full text-center py-3 bg-tertiary text-white text-[10px] font-black uppercase tracking-[0.2em]"
            >
              Ir ao login
            </Link>
          </div>
        ) : invalidLink ? (
          <div className="space-y-4">
            <p className="text-sm text-on-surface-variant">
              Link inválido ou expirado. Solicite um novo e-mail em &quot;Esqueci minha senha&quot;.
            </p>
            <Link
              to="/login/recuperar-senha"
              className="inline-block text-[10px] font-black uppercase tracking-widest text-primary border-b-2 border-primary"
            >
              Recuperar senha
            </Link>
          </div>
        ) : !recovery ? (
          <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Validando link…</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor={pwdId} className="block text-[10px] font-black uppercase text-on-surface-variant mb-1">
                Nova senha
              </label>
              <input
                id={pwdId}
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-outline-variant px-3 py-2 text-sm"
                autoComplete="new-password"
              />
              <ul className="mt-2 space-y-1 border border-surface-container-high bg-surface-container-low/40 p-3 rounded-sm">
                {checks.map((c) => (
                  <li key={c.id} className={`text-[11px] flex items-center gap-2 ${c.pass ? 'text-tertiary font-semibold' : 'text-on-surface-variant'}`}>
                    <span className="material-symbols-outlined text-[16px] leading-none shrink-0">
                      {c.pass ? 'check_circle' : 'radio_button_unchecked'}
                    </span>
                    {c.label}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <label htmlFor={pwd2Id} className="block text-[10px] font-black uppercase text-on-surface-variant mb-1">
                Confirmar senha
              </label>
              <input
                id={pwd2Id}
                type="password"
                required
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                className="w-full border border-outline-variant px-3 py-2 text-sm"
                autoComplete="new-password"
              />
              {password2 && !match && (
                <p className="text-[11px] text-red-600 mt-1">As senhas devem ser iguais.</p>
              )}
            </div>
            {error && <p className="text-sm text-red-600 font-medium">{error}</p>}
            <button
              type="submit"
              disabled={busy || !isStrongPassword(password) || !match}
              className="w-full py-3 bg-tertiary text-white text-[10px] font-black uppercase tracking-[0.2em] hover:bg-tertiary/90 disabled:opacity-50"
            >
              {busy ? 'Salvando…' : 'Salvar nova senha'}
            </button>
          </form>
        )}

        <Link to="/login" className="block text-center text-[10px] font-black uppercase tracking-widest text-on-surface-variant hover:text-primary">
          Voltar ao login
        </Link>
      </div>
    </AuthSplitLayout>
  );
}
