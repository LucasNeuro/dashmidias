import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AuthSplitLayout } from '../components/AuthSplitLayout';
import { TemplateFieldsPublicForm } from '../components/TemplateFieldsPublicForm';
import { useUiFeedback } from '../context/UiFeedbackContext';
import { normalizeSignupOptions } from '../schemas/partnerOrgSignup';
import { registrationTemplateDetailQueryKey } from '../lib/queryKeys';
import { getRegistrationTemplateById } from '../lib/registrationFormTemplatesApi';
import { getSupabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { rpcSubmitPublicLead } from '../lib/submitPublicLead';
import {
  buildLeadCaptureStepLabels,
  chunkLeadExtraFields,
  validateLeadContactStep,
  validateLeadExtrasSlice,
} from '../lib/leadCapturePublicUtils';

function onlyDigits(s) {
  return String(s ?? '').replace(/\D/g, '');
}

/**
 * Formulário público de captura — fluxo distinto da homologação: assistente em passos (contacto + blocos de perguntas).
 */
export function PublicLeadCapturePage() {
  const { toast } = useUiFeedback();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tplParam = (searchParams.get('tpl') || '').trim();

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [cpf, setCpf] = useState('');
  const [fieldValues, setFieldValues] = useState(/** @type {Record<string, string>} */ ({}));
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [step, setStep] = useState(0);
  /** @type {Record<string, string>} */
  const [contactErr, setContactErr] = useState({});
  /** @type {Record<string, string>} */
  const [extrasErr, setExtrasErr] = useState({});

  const wizardCardRef = useRef(/** @type {HTMLDivElement | null} */ (null));

  const templateQuery = useQuery({
    queryKey: registrationTemplateDetailQueryKey(tplParam || null),
    queryFn: async () => {
      const sb = getSupabase();
      if (!isSupabaseConfigured() || !sb || !tplParam) return null;
      return getRegistrationTemplateById(sb, tplParam);
    },
    enabled: Boolean(tplParam) && isSupabaseConfigured(),
    staleTime: 30_000,
    retry: 1,
  });

  const template = templateQuery.data ?? null;
  const segmentSlug = normalizeSignupOptions(template?.signupSettings).leadSegmentSlug;
  const validPurpose = template?.templatePurpose === 'lead_capture';
  const inviteOk = template?.inviteLinkEnabled !== false;
  const collectCpf = normalizeSignupOptions(template?.signupSettings).collectCpf === true;

  const extraFields = useMemo(() => (Array.isArray(template?.fields) ? template.fields : []), [template?.fields]);
  const extraChunks = useMemo(() => chunkLeadExtraFields(extraFields), [extraFields]);
  const stepLabels = useMemo(() => buildLeadCaptureStepLabels(extraChunks.length), [extraChunks.length]);
  const lastStepIndex = stepLabels.length - 1;

  useEffect(() => {
    if (!tplParam || !template?.templatePurpose) return;
    if (template.templatePurpose !== 'lead_capture') {
      navigate(`/cadastro/organizacao?tpl=${encodeURIComponent(tplParam)}`, { replace: true });
    }
  }, [tplParam, template?.templatePurpose, navigate]);

  useEffect(() => {
    setStep((s) => Math.min(s, lastStepIndex));
  }, [lastStepIndex]);

  useEffect(() => {
    wizardCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [step]);

  const setField = useCallback((key, value) => {
    setFieldValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const validateAllAndFocusStep = useCallback(() => {
    const c = validateLeadContactStep({ nome, email, telefone, cpf }, collectCpf);
    if (Object.keys(c).length) {
      setContactErr(c);
      setExtrasErr({});
      setStep(0);
      return false;
    }
    setContactErr({});
    for (let i = 0; i < extraChunks.length; i++) {
      const slice = extraChunks[i];
      const e = validateLeadExtrasSlice(slice, fieldValues);
      if (Object.keys(e).length) {
        setExtrasErr(e);
        setStep(i + 1);
        return false;
      }
    }
    setExtrasErr({});
    return true;
  }, [nome, email, telefone, cpf, collectCpf, extraChunks, fieldValues]);

  const handlePrimary = useCallback(() => {
    if (step < lastStepIndex) {
      if (step === 0) {
        const c = validateLeadContactStep({ nome, email, telefone, cpf }, collectCpf);
        if (Object.keys(c).length) {
          setContactErr(c);
          toast('Corrija os dados de contacto antes de continuar.', { variant: 'warning' });
          return;
        }
        setContactErr({});
        setExtrasErr({});
        setStep(1);
        return;
      }
      const chunkIndex = step - 1;
      const slice = extraChunks[chunkIndex];
      const e = validateLeadExtrasSlice(slice, fieldValues);
      if (Object.keys(e).length) {
        setExtrasErr(e);
        toast('Preencha os campos obrigatórios deste passo.', { variant: 'warning' });
        return;
      }
      setExtrasErr({});
      setStep((x) => x + 1);
      return;
    }

    void (async () => {
      if (!validateAllAndFocusStep()) {
        toast('Revise os campos destacados antes de enviar.', { variant: 'warning' });
        return;
      }

      const sb = getSupabase();
      if (!sb) {
        toast('Servidor não configurado.', { variant: 'warning' });
        return;
      }
      setBusy(true);
      try {
        const cpfDigits = onlyDigits(cpf);
        const r = await rpcSubmitPublicLead(sb, {
          segmentSlug: segmentSlug || null,
          nome: nome.trim(),
          email: email.trim(),
          telefone: telefone.trim() || null,
          cpf: collectCpf ? cpfDigits : cpfDigits.length === 11 ? cpfDigits : null,
          dadosFormulario: { ...fieldValues },
          templateId: template?.id ?? null,
          flowSlug: null,
        });
        if (!r.ok) {
          toast(r.error || 'Não foi possível enviar.', { variant: 'warning', duration: 6500 });
          return;
        }
        setDone(true);
        toast('Recebemos o seu contacto. A equipa pode responder em breve.', { variant: 'success', duration: 5000 });
      } finally {
        setBusy(false);
      }
    })();
  }, [
    step,
    lastStepIndex,
    nome,
    email,
    telefone,
    cpf,
    collectCpf,
    extraChunks,
    fieldValues,
    segmentSlug,
    template?.id,
    toast,
    validateAllAndFocusStep,
  ]);

  if (!tplParam) {
    return (
      <AuthSplitLayout brandOnlyAside heroTitle="Captura" heroSubtitle="Use o link completo com o código do modelo.">
        <div className="mx-auto max-w-md px-4 py-8 text-center text-sm text-on-surface-variant">
          <Link to="/" className="font-medium text-primary underline underline-offset-2">
            Voltar ao início
          </Link>
        </div>
      </AuthSplitLayout>
    );
  }

  if (templateQuery.isPending) {
    return (
      <AuthSplitLayout brandOnlyAside heroTitle="A carregar…" heroSubtitle="">
        <p className="px-4 py-8 text-center text-sm text-on-surface-variant">A carregar formulário…</p>
      </AuthSplitLayout>
    );
  }

  if (!template || !validPurpose) {
    return (
      <AuthSplitLayout brandOnlyAside heroTitle="Modelo inválido" heroSubtitle="Este link não corresponde a um formulário de captura ativo.">
        <div className="mx-auto max-w-md px-4 py-8 text-center text-sm text-on-surface-variant">
          <Link to="/" className="font-medium text-primary underline underline-offset-2">
            Voltar ao início
          </Link>
        </div>
      </AuthSplitLayout>
    );
  }

  if (!inviteOk) {
    return (
      <AuthSplitLayout brandOnlyAside heroTitle="Convite pausado" heroSubtitle="Este formulário não aceita novos envios.">
        <div className="mx-auto max-w-md px-4 py-8 text-center text-sm text-on-surface-variant">
          <Link to="/" className="font-medium text-primary underline underline-offset-2">
            Voltar ao início
          </Link>
        </div>
      </AuthSplitLayout>
    );
  }

  const activeExtraSlice = step > 0 ? extraChunks[step - 1] ?? [] : [];
  const extrasErrForSlice =
    step > 0 ? Object.fromEntries(Object.entries(extrasErr).filter(([k]) => activeExtraSlice.some((f) => String(f.key) === k))) : {};

  return (
    <AuthSplitLayout brandOnlyAside>
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-3 px-3 py-3 sm:gap-4 sm:px-4 sm:py-5 lg:px-6">
        {done ? (
          <div className="rounded-none border-2 border-primary bg-surface-container-low p-6 text-center shadow-md">
            <p className="text-sm font-bold text-primary">Obrigado.</p>
            <p className="mt-2 text-sm text-on-surface-variant">Registámos o seu pedido com a informação que enviou.</p>
            <Link to="/" className="mt-4 inline-block text-xs font-black uppercase tracking-[0.12em] text-primary underline underline-offset-2">
              Voltar ao início
            </Link>
          </div>
        ) : (
          <div
            ref={wizardCardRef}
            className="flex flex-col overflow-visible rounded-none border-2 border-primary bg-white shadow-xl [&_button]:rounded-none [&_input]:rounded-none [&_select]:rounded-none [&_textarea]:rounded-none"
          >
            <header className="shrink-0 border-b border-outline-variant bg-white px-4 py-3 sm:px-6 sm:py-4 lg:px-8">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant">
                Passo {step + 1} de {stepLabels.length}
              </p>
              <div className="mt-2 flex gap-1.5 overflow-x-auto overflow-y-visible pb-1 -mx-1 px-1 no-scrollbar sm:mt-3 sm:flex-wrap sm:overflow-x-visible">
                {stepLabels.map((label, i) => (
                  <span
                    key={`lead-step-${i}`}
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-none border px-2 py-1.5 text-[10px] font-black uppercase tracking-wider transition-colors ${
                      i === step
                        ? 'border-primary bg-primary text-white'
                        : i < step
                          ? 'border-tertiary/50 bg-tertiary/10 text-primary'
                          : 'border-outline-variant bg-white text-on-surface-variant'
                    }`}
                  >
                    <span className="font-mono tabular-nums">{i + 1}</span>
                    {label}
                  </span>
                ))}
              </div>
              <h2 className="mt-3 text-lg font-black tracking-tight text-primary sm:mt-4 sm:text-2xl">{stepLabels[step]}</h2>
            </header>

            <div className="space-y-4 px-4 py-4 sm:space-y-5 sm:px-6 sm:py-5 lg:px-8 lg:py-6">
              {step === 0 ? (
                <div className="grid grid-cols-1 gap-x-4 gap-y-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-[10px] font-black uppercase text-on-surface-variant" htmlFor="cap-nome">
                      Nome completo *
                    </label>
                    <input
                      id="cap-nome"
                      className="w-full border border-outline-variant px-3 py-2 text-sm text-primary outline-none focus:border-primary focus:ring-0"
                      value={nome}
                      onChange={(e) => {
                        setNome(e.target.value);
                        if (contactErr.nome) setContactErr((p) => ({ ...p, nome: undefined }));
                      }}
                      autoComplete="name"
                    />
                    {contactErr.nome ? (
                      <p className="mt-1 text-xs text-red-700" role="alert">
                        {contactErr.nome}
                      </p>
                    ) : null}
                  </div>
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-[10px] font-black uppercase text-on-surface-variant" htmlFor="cap-email">
                      E-mail *
                    </label>
                    <input
                      id="cap-email"
                      type="email"
                      className="w-full border border-outline-variant px-3 py-2 text-sm text-primary outline-none focus:border-primary focus:ring-0"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (contactErr.email) setContactErr((p) => ({ ...p, email: undefined }));
                      }}
                      onBlur={() => {
                        const next = validateLeadContactStep({ nome, email, telefone, cpf }, collectCpf);
                        setContactErr((prev) => ({ ...prev, email: next.email }));
                      }}
                      autoComplete="email"
                    />
                    {contactErr.email ? (
                      <p className="mt-1 text-xs text-red-700" role="alert">
                        {contactErr.email}
                      </p>
                    ) : null}
                  </div>
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-[10px] font-black uppercase text-on-surface-variant" htmlFor="cap-tel">
                      Telefone *
                    </label>
                    <input
                      id="cap-tel"
                      type="tel"
                      className="w-full border border-outline-variant px-3 py-2 text-sm text-primary outline-none focus:border-primary focus:ring-0"
                      value={telefone}
                      onChange={(e) => {
                        setTelefone(e.target.value);
                        if (contactErr.telefone) setContactErr((p) => ({ ...p, telefone: undefined }));
                      }}
                      onBlur={() => {
                        const next = validateLeadContactStep({ nome, email, telefone, cpf }, collectCpf);
                        setContactErr((prev) => ({ ...prev, telefone: next.telefone }));
                      }}
                      autoComplete="tel"
                      placeholder="Com DDD ou indicativo (+...)"
                    />
                    {contactErr.telefone ? (
                      <p className="mt-1 text-xs text-red-700" role="alert">
                        {contactErr.telefone}
                      </p>
                    ) : null}
                  </div>
                  {collectCpf ? (
                    <div className="md:col-span-2">
                      <label className="mb-1 block text-[10px] font-black uppercase text-on-surface-variant" htmlFor="cap-cpf">
                        CPF *
                      </label>
                      <input
                        id="cap-cpf"
                        inputMode="numeric"
                        className="w-full border border-outline-variant px-3 py-2 font-mono text-sm text-primary outline-none focus:border-primary focus:ring-0"
                        value={cpf}
                        onChange={(e) => {
                          setCpf(onlyDigits(e.target.value).slice(0, 11));
                          if (contactErr.cpf) setContactErr((p) => ({ ...p, cpf: undefined }));
                        }}
                        placeholder="11 dígitos"
                        autoComplete="off"
                      />
                      {contactErr.cpf ? (
                        <p className="mt-1 text-xs text-red-700" role="alert">
                          {contactErr.cpf}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : (
                <TemplateFieldsPublicForm
                  fields={activeExtraSlice}
                  values={fieldValues}
                  onChange={(k, v) => {
                    setField(k, v);
                    if (extrasErr[k]) setExtrasErr((p) => ({ ...p, [k]: undefined }));
                  }}
                  idPrefix={`captura-s${step}`}
                  errors={extrasErrForSlice}
                  showGroupTitles={false}
                />
              )}
            </div>

            <footer className="flex shrink-0 flex-col gap-3 border-t border-outline-variant bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6 sm:py-4 lg:px-8">
              <div className="flex flex-wrap gap-2">
                {step > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setStep((s) => Math.max(0, s - 1));
                      setExtrasErr({});
                    }}
                    className="rounded-none border border-outline-variant bg-white px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.15em] text-on-surface-variant hover:bg-surface-container-low"
                  >
                    Voltar
                  </button>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handlePrimary()}
                  className="rounded-none border-2 border-primary bg-primary px-5 py-2.5 text-[10px] font-black uppercase tracking-[0.15em] text-white hover:opacity-95 disabled:opacity-60"
                >
                  {busy ? 'A enviar…' : step >= lastStepIndex ? 'Enviar' : 'Continuar'}
                </button>
              </div>
            </footer>
          </div>
        )}
      </div>
    </AuthSplitLayout>
  );
}
