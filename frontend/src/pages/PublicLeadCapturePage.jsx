import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { useCallback, useMemo, useState } from 'react';
import { AuthSplitLayout } from '../components/AuthSplitLayout';
import { TemplateFieldsPublicForm } from '../components/TemplateFieldsPublicForm';
import { useUiFeedback } from '../context/UiFeedbackContext';
import { normalizeSignupOptions } from '../schemas/partnerOrgSignup';
import { registrationTemplateDetailQueryKey } from '../lib/queryKeys';
import { PRIMARY_REGISTRATION_INTAKE_PATH } from '../lib/registrationPublicLinks';
import { getRegistrationTemplateById } from '../lib/registrationFormTemplatesApi';
import { getSupabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { rpcSubmitPublicLead } from '../lib/submitPublicLead';

function onlyDigits(s) {
  return String(s ?? '').replace(/\D/g, '');
}

/**
 * Formulário público genérico de captura (modelos `template_purpose = lead_capture`).
 * Grava em hub_public_leads via hub_submit_public_lead.
 */
export function PublicLeadCapturePage() {
  const { toast } = useUiFeedback();
  const [searchParams] = useSearchParams();
  const tplParam = (searchParams.get('tpl') || '').trim();

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [cpf, setCpf] = useState('');
  const [fieldValues, setFieldValues] = useState(/** @type {Record<string, string>} */ ({}));
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

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

  const extraFields = useMemo(() => (Array.isArray(template?.fields) ? template.fields : []), [template?.fields]);

  const setField = useCallback((key, value) => {
    setFieldValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  function extrasRequiredOk() {
    for (const f of extraFields) {
      if (f?.inactive === true || !f?.required) continue;
      const k = String(f.key ?? '').trim();
      if (!k) continue;
      if (!String(fieldValues[k] ?? '').trim()) return false;
    }
    return true;
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (!segmentSlug) {
      toast('Modelo indisponível ou segmento não configurado.', { variant: 'warning' });
      return;
    }
    if (nome.trim().length < 2) {
      toast('Indique o nome completo.', { variant: 'warning' });
      return;
    }
    if (!email.includes('@')) {
      toast('E-mail inválido.', { variant: 'warning' });
      return;
    }
    const su = normalizeSignupOptions(template?.signupSettings);
    const cpfDigits = onlyDigits(cpf);
    if (su.collectCpf && cpfDigits.length !== 11) {
      toast('CPF deve ter 11 dígitos.', { variant: 'warning' });
      return;
    }
    if (!extrasRequiredOk()) {
      toast('Preencha as perguntas obrigatórias.', { variant: 'warning' });
      return;
    }

    const sb = getSupabase();
    if (!sb) {
      toast('Servidor não configurado.', { variant: 'warning' });
      return;
    }

    setBusy(true);
    try {
      const r = await rpcSubmitPublicLead(sb, {
        segmentSlug,
        nome: nome.trim(),
        email: email.trim(),
        telefone: telefone.trim() || null,
        cpf: su.collectCpf ? cpfDigits : cpfDigits.length === 11 ? cpfDigits : null,
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
  }

  if (!tplParam) {
    return (
      <AuthSplitLayout heroTitle="Captura" heroSubtitle="Use o link completo com o código do modelo.">
        <div className="mx-auto max-w-md px-4 py-8 text-center text-sm text-on-surface-variant">
          <Link to={PRIMARY_REGISTRATION_INTAKE_PATH} className="font-medium text-primary underline underline-offset-2">
            Voltar ao início
          </Link>
        </div>
      </AuthSplitLayout>
    );
  }

  if (templateQuery.isPending) {
    return (
      <AuthSplitLayout heroTitle="A carregar…" heroSubtitle="Um momento.">
        <p className="px-4 py-8 text-center text-sm text-on-surface-variant">A carregar formulário…</p>
      </AuthSplitLayout>
    );
  }

  if (!template || !validPurpose) {
    return (
      <AuthSplitLayout heroTitle="Modelo inválido" heroSubtitle="Este link não corresponde a um formulário de captura ativo.">
        <div className="mx-auto max-w-md px-4 py-8 text-center text-sm text-on-surface-variant">
          <Link to={PRIMARY_REGISTRATION_INTAKE_PATH} className="font-medium text-primary underline underline-offset-2">
            Voltar ao início
          </Link>
        </div>
      </AuthSplitLayout>
    );
  }

  if (!inviteOk) {
    return (
      <AuthSplitLayout heroTitle="Convite pausado" heroSubtitle="Este formulário não aceita novos envios.">
        <div className="mx-auto max-w-md px-4 py-8 text-center text-sm text-on-surface-variant">
          <Link to={PRIMARY_REGISTRATION_INTAKE_PATH} className="font-medium text-primary underline underline-offset-2">
            Voltar ao início
          </Link>
        </div>
      </AuthSplitLayout>
    );
  }

  if (!segmentSlug) {
    return (
      <AuthSplitLayout heroTitle="Configuração incompleta" heroSubtitle="Falta o segmento CRM neste modelo.">
        <div className="mx-auto max-w-md px-4 py-8 text-center text-sm text-on-surface-variant">
          <Link to={PRIMARY_REGISTRATION_INTAKE_PATH} className="font-medium text-primary underline underline-offset-2">
            Voltar ao início
          </Link>
        </div>
      </AuthSplitLayout>
    );
  }

  return (
    <AuthSplitLayout
      heroTitle={template.name?.trim() || 'Contacto'}
      heroSubtitle={template.description?.trim() || 'Preencha os dados abaixo. As respostas entram no CRM da Obra10+.'}
    >
      <div className="mx-auto w-full max-w-lg px-4 py-6 sm:px-6">
        {done ? (
          <div className="rounded-none border-2 border-primary bg-surface-container-low p-5 text-center shadow-md">
            <p className="text-sm font-bold text-primary">Obrigado.</p>
            <p className="mt-2 text-sm text-on-surface-variant">Registámos o seu pedido com a informação que enviou.</p>
            <Link
              to={PRIMARY_REGISTRATION_INTAKE_PATH}
              className="mt-4 inline-block text-xs font-black uppercase tracking-[0.12em] text-primary underline underline-offset-2"
            >
              Voltar ao início
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4 rounded-none border border-outline-variant bg-white p-4 shadow-md sm:p-5">
            {extraFields.length > 0 ? (
              <TemplateFieldsPublicForm
                fields={extraFields}
                values={fieldValues}
                onChange={setField}
                idPrefix="captura"
              />
            ) : null}

            <div>
              <label className="block text-[10px] font-black uppercase tracking-[0.12em] text-primary" htmlFor="cap-nome">
                Nome completo *
              </label>
              <input
                id="cap-nome"
                className="mt-1 w-full border-b-2 border-outline-variant bg-transparent py-2 text-sm text-on-surface outline-none focus:border-primary"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
                autoComplete="name"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-[0.12em] text-primary" htmlFor="cap-email">
                E-mail *
              </label>
              <input
                id="cap-email"
                type="email"
                className="mt-1 w-full border-b-2 border-outline-variant bg-transparent py-2 text-sm text-on-surface outline-none focus:border-primary"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-[0.12em] text-primary" htmlFor="cap-tel">
                Telefone
              </label>
              <input
                id="cap-tel"
                className="mt-1 w-full border-b-2 border-outline-variant bg-transparent py-2 text-sm text-on-surface outline-none focus:border-primary"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                autoComplete="tel"
              />
            </div>
            {normalizeSignupOptions(template.signupSettings).collectCpf ? (
              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.12em] text-primary" htmlFor="cap-cpf">
                  CPF *
                </label>
                <input
                  id="cap-cpf"
                  className="mt-1 w-full border-b-2 border-outline-variant bg-transparent py-2 text-sm text-on-surface outline-none focus:border-primary"
                  value={cpf}
                  onChange={(e) => setCpf(e.target.value)}
                  inputMode="numeric"
                  autoComplete="off"
                  required
                />
              </div>
            ) : null}

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:gap-3">
              <Link
                to={PRIMARY_REGISTRATION_INTAKE_PATH}
                className="inline-flex justify-center rounded-sm border-2 border-outline-variant px-4 py-2.5 text-center text-[10px] font-black uppercase tracking-[0.12em] text-primary hover:bg-surface-container-low"
              >
                Voltar
              </Link>
              <button
                type="submit"
                disabled={busy}
                className="rounded-sm border-2 border-primary bg-primary px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.12em] text-white hover:opacity-95 disabled:opacity-60"
              >
                {busy ? 'A enviar…' : 'Enviar'}
              </button>
            </div>
          </form>
        )}
      </div>
    </AuthSplitLayout>
  );
}
