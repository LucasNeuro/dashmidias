import { useId, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthSplitLayout } from '../components/AuthSplitLayout';
import { useAuth } from '../context/AuthContext';
import { isCpfValid, normalizeCpfDigits } from '../lib/cpf';
import { getPasswordChecks, isStrongPassword, strongPasswordMessage } from '../lib/passwordPolicy';

/**
 * Cadastro para futuro administrador HUB: cria conta (senha no Auth) + registo com CPF/telefone.
 * Liberação em /adm é só pelo owner (hub_admins + seed/RPC).
 */
export function HubAdminSolicitacaoPage() {
  const navigate = useNavigate();
  const { supabase, signUp, signOut, loadProfileForUser } = useAuth();
  const nomeId = useId();
  const emailId = useId();
  const telId = useId();
  const cpfId = useId();
  const pwdId = useId();
  const pwd2Id = useId();
  const msgId = useId();

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefoneDigits, setTelefoneDigits] = useState('');
  const [cpf, setCpf] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showPassword2, setShowPassword2] = useState(false);
  const passwordChecks = getPasswordChecks(password);
  const pwdOk = isStrongPassword(password);
  const pwdMatch = password.length > 0 && password === password2;

  function formatTelDisplay(d) {
    const x = String(d).replace(/\D/g, '').slice(0, 11);
    if (x.length === 0) return '';
    if (x.length <= 2) return `(${x}`;
    if (x.length <= 6) return `(${x.slice(0, 2)}) ${x.slice(2)}`;
    if (x.length <= 10) return `(${x.slice(0, 2)}) ${x.slice(2, 6)}-${x.slice(6)}`;
    return `(${x.slice(0, 2)}) ${x.slice(2, 7)}-${x.slice(7)}`;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (!supabase) {
      setError('Serviço indisponível.');
      return;
    }
    const cpfDigits = normalizeCpfDigits(cpf);
    if (!isCpfValid(cpfDigits)) {
      setError('Informe um CPF válido.');
      return;
    }
    if (!pwdOk) {
      setError(strongPasswordMessage());
      return;
    }
    if (!pwdMatch) {
      setError('As senhas não coincidem.');
      return;
    }
    const telDigits = telefoneDigits.replace(/\D/g, '');
    if (telDigits.length < 10) {
      setError('Informe um telefone com DDD (mínimo 10 dígitos).');
      return;
    }

    setBusy(true);
    try {
      const data = await signUp(email.trim().toLowerCase(), password, nome.trim());
      if (!data?.session?.user?.id) {
        setError(
          'Conta criada, mas sem sessão imediata. Desligue "Confirm email" no Supabase (Auth → Providers → Email) ou confirme o link no e-mail; depois faça login e abra esta rota de novo se precisar.'
        );
        setBusy(false);
        return;
      }
      const uid = data.session.user.id;
      const { error: insErr } = await supabase.from('hub_solicitacoes_admin').insert({
        nome: nome.trim(),
        email: email.trim().toLowerCase(),
        telefone: telDigits,
        cpf: cpfDigits,
        mensagem: mensagem.trim() || null,
        status: 'pendente',
        user_id: uid,
      });
      if (insErr) {
        await signOut();
        throw insErr;
      }
      await loadProfileForUser(uid);
      navigate('/acesso/pendente-hub', { replace: true });
    } catch (err) {
      const msg = err.message || 'Não foi possível concluir o cadastro';
      if (/already registered|User already registered|already been registered/i.test(msg)) {
        setError('Este e-mail já possui conta. Use o login e solicite ao owner se precisar de acesso HUB.');
      } else {
        setError(msg);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthSplitLayout
      heroTitle="Cadastro de administrador da plataforma"
      heroSubtitle="Você cria login e senha aqui. O acesso à governança (/adm) só é liberado quando o owner da plataforma aprovar e promover sua conta em hub_admins."
    >
      <div className="w-full max-w-md mx-auto bg-white border-2 border-primary shadow-xl p-8 space-y-6">
        <div>
          <h2 className="text-2xl font-black text-primary tracking-tight">Registro para aprovação</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor={nomeId} className="block text-[10px] font-black uppercase text-on-surface-variant mb-1">
                Nome completo
              </label>
              <input
                id={nomeId}
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="w-full border border-outline-variant px-3 py-2 text-sm"
                autoComplete="name"
              />
            </div>
            <div>
              <label htmlFor={emailId} className="block text-[10px] font-black uppercase text-on-surface-variant mb-1">
                E-mail
              </label>
              <input
                id={emailId}
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-outline-variant px-3 py-2 text-sm"
                autoComplete="email"
              />
            </div>
            <div>
              <label htmlFor={telId} className="block text-[10px] font-black uppercase text-on-surface-variant mb-1">
                Telefone (com DDD)
              </label>
              <input
                id={telId}
                type="tel"
                required
                value={formatTelDisplay(telefoneDigits)}
                onChange={(e) => setTelefoneDigits(e.target.value.replace(/\D/g, '').slice(0, 11))}
                className="w-full border border-outline-variant px-3 py-2 text-sm"
                autoComplete="tel"
                placeholder="(00) 00000-0000"
              />
            </div>
            <div>
              <label htmlFor={cpfId} className="block text-[10px] font-black uppercase text-on-surface-variant mb-1">
                CPF
              </label>
              <input
                id={cpfId}
                required
                value={cpf}
                onChange={(e) => {
                  const d = normalizeCpfDigits(e.target.value);
                  const formatted =
                    d.length <= 3
                      ? d
                      : d.length <= 6
                        ? `${d.slice(0, 3)}.${d.slice(3)}`
                        : d.length <= 9
                          ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
                          : `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`;
                  setCpf(formatted);
                }}
                className="w-full border border-outline-variant px-3 py-2 text-sm"
                autoComplete="off"
                placeholder="000.000.000-00"
                maxLength={14}
              />
            </div>
            <div>
              <label htmlFor={pwdId} className="block text-[10px] font-black uppercase text-on-surface-variant mb-1">
                Senha de acesso
              </label>
              <div className="relative">
                <input
                  id={pwdId}
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border border-outline-variant pl-3 pr-11 py-2 text-sm"
                  autoComplete="new-password"
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
              <ul className="mt-2 space-y-1 border border-surface-container-high bg-surface-container-low/40 p-3 rounded-sm">
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
            <div>
              <label htmlFor={pwd2Id} className="block text-[10px] font-black uppercase text-on-surface-variant mb-1">
                Confirmar senha
              </label>
              <div className="relative">
                <input
                  id={pwd2Id}
                  type={showPassword2 ? 'text' : 'password'}
                  required
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  className="w-full border border-outline-variant pl-3 pr-11 py-2 text-sm"
                  autoComplete="new-password"
                  aria-invalid={password2.length > 0 && !pwdMatch}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword2((v) => !v)}
                  className="absolute right-0 top-0 bottom-0 px-3 flex items-center justify-center text-on-surface-variant hover:text-primary"
                  aria-label={showPassword2 ? 'Ocultar confirmação' : 'Mostrar confirmação'}
                >
                  <span className="material-symbols-outlined text-[22px] leading-none">
                    {showPassword2 ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
              {password2.length > 0 && !pwdMatch && (
                <p className="text-[11px] text-red-600 mt-1">As senhas devem ser iguais.</p>
              )}
            </div>
            <div>
              <label htmlFor={msgId} className="block text-[10px] font-black uppercase text-on-surface-variant mb-1">
                Observações (opcional)
              </label>
              <textarea
                id={msgId}
                rows={3}
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                className="w-full border border-outline-variant px-3 py-2 text-sm resize-y min-h-[72px]"
              />
            </div>
            {error && <p className="text-sm text-red-600 font-medium">{error}</p>}
            <button
              type="submit"
              disabled={busy || !pwdOk || !pwdMatch}
              className="w-full py-3 bg-tertiary text-white text-[10px] font-black uppercase tracking-[0.2em] hover:bg-tertiary/90 disabled:opacity-50"
            >
              {busy ? 'Registrando…' : 'Criar conta e enviar para aprovação'}
            </button>
        </form>

        <p className="text-[10px] text-on-surface-variant leading-relaxed">
          Já tem conta?{' '}
          <Link to="/login" className="font-black uppercase tracking-widest text-primary">
            Login
          </Link>
        </p>
      </div>
    </AuthSplitLayout>
  );
}
