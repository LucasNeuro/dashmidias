import { useId, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AuthSplitLayout } from '../components/AuthSplitLayout';
import { useAuth } from '../context/AuthContext';
import { isValidPortal, loginPathForPortal, PORTAL_HUB } from '../lib/appPortal';

export function ForgotPasswordPage() {
  const [searchParams] = useSearchParams();
  const portalParam = searchParams.get('portal');
  const portal = isValidPortal(portalParam) ? portalParam : PORTAL_HUB;
  const loginBack = loginPathForPortal(portal);
  const { resetPasswordForEmail } = useAuth();
  const emailFieldId = useId();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await resetPasswordForEmail(email.trim());
      setSent(true);
    } catch (err) {
      setError(err.message || 'Não foi possível enviar o e-mail');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthSplitLayout heroTitle="Obra10+">
      <div className="w-full max-w-md mx-auto bg-white border-2 border-primary shadow-xl p-8 space-y-6">
        <div>
          <h2 className="text-2xl font-black text-primary tracking-tight">Esqueci minha senha</h2>
        </div>

        {sent ? (
          <div className="space-y-4">
            <p className="text-sm text-on-surface font-medium">Verifique o e-mail.</p>
            <Link
              to={loginBack}
              className="inline-block text-[10px] font-black uppercase tracking-widest text-primary border-b-2 border-primary pb-0.5"
            >
              Voltar ao login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor={emailFieldId} className="block text-[10px] font-black uppercase text-on-surface-variant mb-1">
                E-mail
              </label>
              <input
                id={emailFieldId}
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-outline-variant px-3 py-2 text-sm"
                autoComplete="email"
              />
            </div>
            {error && <p className="text-sm text-red-600 font-medium">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full py-3 bg-tertiary text-white text-[10px] font-black uppercase tracking-[0.2em] hover:bg-tertiary/90 disabled:opacity-50"
            >
              {busy ? 'Enviando…' : 'Enviar link'}
            </button>
          </form>
        )}

        <Link to={loginBack} className="block text-center text-[10px] font-black uppercase tracking-widest text-on-surface-variant hover:text-primary">
          Voltar ao login
        </Link>
      </div>
    </AuthSplitLayout>
  );
}
