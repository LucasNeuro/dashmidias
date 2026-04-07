import { useEffect, useId, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getPasswordChecks, isStrongPassword, strongPasswordMessage } from '../lib/passwordPolicy';

export function LoginPage() {
  const navigate = useNavigate();
  const { session, loading, signIn, signUp } = useAuth();
  const [showSignup, setShowSignup] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const passwordFieldId = useId();

  const passwordChecks = useMemo(() => getPasswordChecks(password), [password]);
  const signupPasswordOk = isStrongPassword(password);

  useEffect(() => {
    if (!loading && session) navigate('/', { replace: true });
  }, [session, loading, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (showSignup && !isStrongPassword(password)) {
      setError(strongPasswordMessage());
      return;
    }

    setBusy(true);
    try {
      if (showSignup) {
        const data = await signUp(email.trim(), password, fullName.trim());
        if (data?.session) {
          setPassword('');
          navigate('/', { replace: true });
          return;
        }
        setMessage(
          'Conta criada. Se a confirmação por e-mail estiver ativa no Supabase, abra o link enviado; depois faça login.'
        );
        setShowSignup(false);
        setPassword('');
      } else {
        await signIn(email.trim(), password);
        navigate('/', { replace: true });
      }
    } catch (err) {
      setError(err.message || err.msg || 'Falha na autenticação');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-container-low text-primary text-[10px] font-black uppercase tracking-widest">
        Carregando…
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-container-low px-4 py-12">
      <div className="w-full max-w-md bg-white border-2 border-primary shadow-xl p-8 space-y-6">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-tertiary mb-2">Arqui System</p>
          <h1 className="text-2xl font-black text-primary tracking-tight">
            {showSignup ? 'Criar conta' : 'Acesso ao painel'}
          </h1>
          <p className="text-sm text-on-surface-variant mt-2">
            {showSignup
              ? 'Preencha os dados para se cadastrar com e-mail e senha.'
              : 'Entre com e-mail e senha.'}
          </p>
        </div>

        {!showSignup && (
          <button
            type="button"
            onClick={() => {
              setShowSignup(true);
              setError(null);
              setMessage(null);
            }}
            className="w-full py-2.5 border-2 border-primary text-[10px] font-black uppercase tracking-[0.2em] text-primary hover:bg-primary hover:text-white transition-colors"
          >
            Criar conta
          </button>
        )}

        {showSignup && (
          <button
            type="button"
            onClick={() => {
              setShowSignup(false);
              setError(null);
              setMessage(null);
            }}
            className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant hover:text-primary"
          >
            ← Voltar ao login
          </button>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {showSignup && (
            <div>
              <label htmlFor="fullName" className="block text-[10px] font-black uppercase text-on-surface-variant mb-1">
                Nome
              </label>
              <input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full border border-outline-variant px-3 py-2 text-sm"
                autoComplete="name"
              />
            </div>
          )}
          <div>
            <label htmlFor="email" className="block text-[10px] font-black uppercase text-on-surface-variant mb-1">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-outline-variant px-3 py-2 text-sm"
              autoComplete="email"
            />
          </div>
          <div>
            <label htmlFor={passwordFieldId} className="block text-[10px] font-black uppercase text-on-surface-variant mb-1">
              Senha
            </label>
            <div className="relative">
              <input
                id={passwordFieldId}
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-outline-variant pl-3 pr-11 py-2 text-sm"
                autoComplete={showSignup ? 'new-password' : 'current-password'}
                aria-describedby={showSignup ? 'password-hint password-rules' : undefined}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-0 top-0 bottom-0 px-3 flex items-center justify-center text-on-surface-variant hover:text-primary"
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              >
                <span className="material-symbols-outlined text-[22px] leading-none">
                  {showPassword ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>

            {showSignup && (
              <div id="password-hint" className="mt-2 space-y-2">
                <p className="text-[11px] font-semibold text-primary">Dicas para senha segura</p>
                <ul className="text-[11px] text-on-surface-variant space-y-1 list-disc pl-4">
                  <li>Evite datas, nomes óbvios ou sequências como &quot;123456&quot;.</li>
                  <li>Combine letras, números e símbolos; quanto mais longa, melhor.</li>
                  <li>Não reutilize a mesma senha de outros serviços.</li>
                </ul>
                <ul id="password-rules" className="mt-2 space-y-1 border border-surface-container-high bg-surface-container-low/40 p-3 rounded-sm">
                  {passwordChecks.map((c) => (
                    <li key={c.id} className={`text-[11px] flex items-center gap-2 ${c.pass ? 'text-tertiary font-semibold' : 'text-on-surface-variant'}`}>
                      <span className="material-symbols-outlined text-[16px] leading-none shrink-0">
                        {c.pass ? 'check_circle' : 'radio_button_unchecked'}
                      </span>
                      {c.label}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {error && <p className="text-sm text-red-600 font-medium">{error}</p>}
          {message && <p className="text-sm text-tertiary font-medium">{message}</p>}

          <button
            type="submit"
            disabled={busy || (showSignup && !signupPasswordOk)}
            className="w-full py-3 bg-primary text-white text-[10px] font-black uppercase tracking-[0.2em] hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? 'Aguarde…' : showSignup ? 'Cadastrar' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
