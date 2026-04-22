import { useEffect, useId, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AuthSplitLayout } from '../components/AuthSplitLayout';
import { useAuth } from '../context/AuthContext';
import { isValidPortal, PORTAL_HUB } from '../lib/appPortal';

export function LoginPage() {
  const navigate = useNavigate();
  const { portal: portalParam } = useParams();
  const { session, loading, identityReady, postLoginPath, signIn, setPortal } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const passwordFieldId = useId();

  /** Um único login: default Hub; `/login/imoveis` mantém compatibilidade e grava o portal em localStorage. */
  const portal = isValidPortal(portalParam) ? portalParam : PORTAL_HUB;

  useEffect(() => {
    setPortal(portal);
  }, [portal, setPortal]);

  useEffect(() => {
    if (!loading && identityReady && session) {
      navigate(postLoginPath, { replace: true });
    }
  }, [session, loading, identityReady, postLoginPath, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const path = await signIn(email.trim(), password);
      navigate(path, { replace: true });
    } catch (err) {
      setError(err.message || err.msg || 'Falha na autenticação');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-container-low text-primary text-[10px] font-black uppercase tracking-widest">
        Carregando...
      </div>
    );
  }

  const recuperar = '/login/recuperar-senha';

  return (
    <AuthSplitLayout heroTitle="Obra10+">
      <div className="w-full max-w-md mx-auto border-2 border-primary bg-white/95 shadow-xl backdrop-blur-sm p-8 space-y-6">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 mb-1">Plataforma Obra10+</p>
          <h2 className="text-2xl font-black text-primary tracking-tight">Acesso ao painel</h2>
          <p className="mt-2 text-sm text-on-surface-variant leading-snug">
            Utilize o seu e-mail e senha. O destino após entrar (HUB, participante ou pendente de aprovação) é
            definido automaticamente conforme o seu perfil.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
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
                autoComplete="current-password"
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
          </div>

          {error && <p className="text-sm text-red-600 font-medium">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full py-3 bg-tertiary text-white text-[10px] font-black uppercase tracking-[0.2em] hover:bg-tertiary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? 'Aguarde...' : 'Entrar'}
          </button>
        </form>

        <div className="pt-2 border-t border-surface-container-high">
          <Link
            to={recuperar}
            className="block text-center text-[10px] font-black uppercase tracking-widest text-on-surface-variant hover:text-primary"
          >
            Esqueci minha senha
          </Link>
        </div>
      </div>
    </AuthSplitLayout>
  );
}
