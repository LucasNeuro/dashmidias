import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { TemplateFieldsPublicForm } from '../components/TemplateFieldsPublicForm';
import { AuthSplitLayout } from '../components/AuthSplitLayout';
import { useUiFeedback } from '../context/UiFeedbackContext';
import { fetchActiveLeadSegments } from '../lib/leadSegmentsApi';
import { FALLBACK_LEAD_SEGMENTS } from '../lib/leadSegmentsFallback';
import { leadSegmentsPublicQueryKey, masterFlowPublicQueryKey, registrationTemplateDetailQueryKey } from '../lib/queryKeys';
import { defaultMasterFlowSlug, REGISTRATION_FLOW_BY_SLUG_PATH } from '../lib/registrationPublicLinks';
import { filterPartnerStepsWithResolvedTemplate, isBranchStep } from '../lib/registrationFlowRules';
import { fetchPublicMasterFlowWithSteps } from '../lib/registrationMasterFlowApi';
import { getRegistrationTemplateById } from '../lib/registrationFormTemplatesApi';
import { getSupabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { rpcSubmitPublicLead } from '../lib/submitPublicLead';

const LEAD_INTAKE_SESSION = 'ob10_lead_intake_v1';

function onlyDigits(s) {
  return String(s ?? '').replace(/\D/g, '');
}

/** @returns {null | { docDigits?: string, flow?: string }} */
function readLeadIntakeSession() {
  try {
    const raw = sessionStorage.getItem(LEAD_INTAKE_SESSION);
    if (!raw) return null;
    const j = JSON.parse(raw);
    return j && typeof j === 'object' ? j : null;
  } catch {
    return null;
  }
}

/** @param {string} templateId @param {string} fieldKey */
function storageKeyForField(templateId, fieldKey) {
  return `${String(templateId)}::${String(fieldKey)}`;
}

/**
 * @param {unknown} template
 * @param {Record<string, string>} allValues
 * @param {string} templateId
 */
function templateRequiredOk(template, allValues, templateId) {
  const fields = Array.isArray(template?.fields) ? template.fields : [];
  const tid = String(templateId);
  for (const f of fields) {
    if (!f?.required) continue;
    const k = String(f.key ?? '').trim();
    if (!k) continue;
    const sk = storageKeyForField(tid, k);
    if (!String(allValues[sk] ?? '').trim()) return false;
  }
  return true;
}

export function PublicLeadSignupPage() {
  const { toast } = useUiFeedback();
  const [searchParams] = useSearchParams();
  const segmentSlug = (searchParams.get('segment') || '').trim().toLowerCase();
  const masterFlowSlug = (searchParams.get('flow') || '').trim() || defaultMasterFlowSlug();

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [cpf, setCpf] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const [wizardStepIndex, setWizardStepIndex] = useState(0);
  const [templateFieldValues, setTemplateFieldValues] = useState(/** @type {Record<string, string>} */ ({}));

  const intakeSession = useMemo(() => readLeadIntakeSession(), []);

  useEffect(() => {
    const digits = onlyDigits(intakeSession?.docDigits ?? '');
    if (digits.length === 11) setCpf(digits);
  }, [intakeSession]);

  const segmentsQuery = useQuery({
    queryKey: leadSegmentsPublicQueryKey(),
    queryFn: async () => {
      const sb = getSupabase();
      if (!isSupabaseConfigured() || !sb) return FALLBACK_LEAD_SEGMENTS;
      try {
        return await fetchActiveLeadSegments(sb);
      } catch {
        return FALLBACK_LEAD_SEGMENTS;
      }
    },
    staleTime: 60_000,
  });

  const segments = useMemo(() => segmentsQuery.data ?? FALLBACK_LEAD_SEGMENTS, [segmentsQuery.data]);
  const segmentMeta = useMemo(
    () => segments.find((s) => s.slug === segmentSlug) ?? null,
    [segments, segmentSlug]
  );

  const invalidSegment = Boolean(segmentSlug) && !segmentMeta && !segmentsQuery.isPending;

  const masterFlowQuery = useQuery({
    queryKey: masterFlowPublicQueryKey(masterFlowSlug),
    queryFn: async () => {
      const sb = getSupabase();
      if (!isSupabaseConfigured() || !sb) return null;
      try {
        return await fetchPublicMasterFlowWithSteps(sb, masterFlowSlug);
      } catch {
        return null;
      }
    },
    enabled: isSupabaseConfigured() && Boolean(segmentSlug) && !invalidSegment,
    staleTime: 120_000,
    retry: 1,
  });

  const leadSteps = useMemo(() => {
    const bundle = masterFlowQuery.data;
    const steps = bundle?.steps ?? [];
    if (!steps.length) return [];
    const sorted = [...steps].sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0));
    const templateOnly = sorted.filter((s) => !isBranchStep(s));
    return filterPartnerStepsWithResolvedTemplate(templateOnly, {
      docType: 'cpf',
      audience: 'lead',
      segmentSlug,
    });
  }, [masterFlowQuery.data, segmentSlug]);

  const useWizard = leadSteps.length > 0;
  const contactStepIndex = leadSteps.length;
  const onContactStep = useWizard && wizardStepIndex >= contactStepIndex;
  const currentFlowStep = !useWizard || onContactStep ? null : leadSteps[wizardStepIndex];
  const currentTemplateId = currentFlowStep?.template_id ? String(currentFlowStep.template_id) : '';

  const templateDetailQuery = useQuery({
    queryKey: registrationTemplateDetailQueryKey(currentTemplateId),
    queryFn: async () => {
      const sb = getSupabase();
      if (!sb || !currentTemplateId) return null;
      return getRegistrationTemplateById(sb, currentTemplateId);
    },
    enabled: Boolean(useWizard && !onContactStep && currentTemplateId),
    staleTime: 60_000,
  });

  useEffect(() => {
    setWizardStepIndex(0);
    setTemplateFieldValues({});
  }, [segmentSlug, masterFlowSlug]);

  const setTemplateValue = useCallback((templateId, fieldKey, value) => {
    const sk = storageKeyForField(templateId, fieldKey);
    setTemplateFieldValues((prev) => ({ ...prev, [sk]: value }));
  }, []);

  const cadastroBasePath =
    masterFlowSlug && masterFlowSlug !== defaultMasterFlowSlug()
      ? `${REGISTRATION_FLOW_BY_SLUG_PATH}/${encodeURIComponent(masterFlowSlug)}`
      : '/cadastro';

  async function onSubmit(e) {
    e.preventDefault();
    if (!segmentSlug || invalidSegment) {
      toast('Selecione um tipo de pedido válido a partir da página inicial.', { variant: 'warning' });
      return;
    }
    const sb = getSupabase();
    if (!isSupabaseConfigured() || !sb) {
      toast('Servidor não configurado. Os dados não foram guardados.', { variant: 'warning', duration: 6000 });
      return;
    }
    setBusy(true);
    try {
      const cpfDigits = onlyDigits(cpf);
      const r = await rpcSubmitPublicLead(sb, {
        segmentSlug,
        nome: nome.trim(),
        email: email.trim(),
        telefone: telefone.trim() || null,
        cpf: cpfDigits.length ? cpfDigits : null,
        dadosFormulario: {
          ...templateFieldValues,
          mensagem: mensagem.trim(),
        },
        templateId: leadSteps.length ? String(leadSteps[leadSteps.length - 1].template_id) : null,
        flowSlug: masterFlowSlug,
      });
      if (!r.ok) {
        toast(r.error || 'Não foi possível enviar.', { variant: 'warning', duration: 6500 });
        return;
      }
      setDone(true);
      toast('Pedido enviado. Entraremos em contacto em breve.', { variant: 'success', duration: 5000 });
    } finally {
      setBusy(false);
    }
  }

  function goNextWizard() {
    if (!useWizard || onContactStep) return;
    const tpl = templateDetailQuery.data;
    const tid = currentTemplateId;
    if (!tpl || !tid) {
      toast('Carregando perguntas…', { variant: 'info' });
      return;
    }
    if (!templateRequiredOk(tpl, templateFieldValues, tid)) {
      toast('Preencha os campos obrigatórios desta etapa.', { variant: 'warning' });
      return;
    }
    if (wizardStepIndex < leadSteps.length - 1) {
      setWizardStepIndex((i) => i + 1);
    } else {
      setWizardStepIndex(contactStepIndex);
    }
  }

  function goBackWizard() {
    if (!useWizard) return;
    if (wizardStepIndex > 0) {
      setWizardStepIndex((i) => i - 1);
    }
  }

  if (!segmentSlug) {
    return (
      <AuthSplitLayout heroTitle="Lead" heroSubtitle="Escolha primeiro o tipo de pedido.">
        <div className="mx-auto max-w-md px-4 py-8 text-center text-sm text-on-surface-variant">
          <Link to={cadastroBasePath} className="font-medium text-primary underline underline-offset-2">
            Voltar ao início do cadastro
          </Link>
        </div>
      </AuthSplitLayout>
    );
  }

  if (invalidSegment) {
    return (
      <AuthSplitLayout heroTitle="Segmento inválido" heroSubtitle="Esta ligação não é válida ou expirou.">
        <div className="mx-auto max-w-md px-4 py-8 text-center text-sm text-on-surface-variant">
          <Link to={cadastroBasePath} className="font-medium text-primary underline underline-offset-2">
            Voltar ao início do cadastro
          </Link>
        </div>
      </AuthSplitLayout>
    );
  }

  const wizardLoading =
    useWizard &&
    !onContactStep &&
    Boolean(currentTemplateId) &&
    (templateDetailQuery.isPending || !templateDetailQuery.data);

  const tplNow = templateDetailQuery.data;
  const stepLabel =
    useWizard && !onContactStep
      ? `${tplNow?.name || 'Etapa'} (${wizardStepIndex + 1} de ${leadSteps.length})`
      : null;

  return (
    <AuthSplitLayout
      heroTitle="Pedido de contacto"
      heroSubtitle={
        segmentMeta
          ? `${segmentMeta.label}. ${useWizard ? 'Responda às perguntas e confirme os seus dados.' : 'Preencha os dados para que a equipe Obra10+ possa entrar em contato.'}`
          : 'Preencha os dados para que a equipe possa entrar em contato.'
      }
    >
      <div className="mx-auto w-full max-w-lg px-4 py-6 sm:px-6">
        {done ? (
          <div className="rounded-none border-2 border-primary bg-surface-container-low p-5 text-center shadow-md">
            <p className="text-sm font-bold text-primary">Obrigado pelo seu pedido.</p>
            <p className="mt-2 text-sm text-on-surface-variant">Vamos analisar e entrar em contacto pelo e-mail ou telefone indicados.</p>
            <Link
              to={cadastroBasePath}
              className="mt-4 inline-block text-xs font-black uppercase tracking-[0.12em] text-primary underline underline-offset-2"
            >
              Novo pedido
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4 rounded-none border border-outline-variant bg-white p-4 shadow-md sm:p-5">
            {useWizard && stepLabel ? (
              <p className="text-center text-xs font-semibold text-primary">{stepLabel}</p>
            ) : null}

            {useWizard && !onContactStep ? (
              templateDetailQuery.isError ? (
                <p className="text-center text-sm text-red-700">
                  Não foi possível carregar esta etapa. Verifique se o convite do template está ativo e tente outra vez.
                </p>
              ) : wizardLoading ? (
                <p className="text-center text-sm text-on-surface-variant">Carregando perguntas…</p>
              ) : tplNow ? (
                <TemplateFieldsPublicForm
                  fields={tplNow.fields}
                  values={Object.fromEntries(
                    (tplNow.fields || []).map((f) => {
                      const k = String(f.key ?? '');
                      return [k, templateFieldValues[storageKeyForField(currentTemplateId, k)] ?? ''];
                    })
                  )}
                  onChange={(key, v) => setTemplateValue(currentTemplateId, key, v)}
                  idPrefix={`w-${wizardStepIndex}`}
                />
              ) : null
            ) : null}

            {useWizard && !onContactStep ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
                <button
                  type="button"
                  onClick={goBackWizard}
                  disabled={wizardStepIndex === 0}
                  className="rounded-sm border-2 border-outline-variant px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.12em] text-primary hover:bg-surface-container-low disabled:opacity-40"
                >
                  Voltar etapa
                </button>
                <button
                  type="button"
                  onClick={goNextWizard}
                  disabled={templateDetailQuery.isError}
                  className="rounded-sm border-2 border-primary bg-primary px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.12em] text-white hover:opacity-95 disabled:opacity-50"
                >
                  Continuar
                </button>
              </div>
            ) : null}

            {(!useWizard || onContactStep) && (
              <>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.12em] text-primary" htmlFor="lead-nome">
                    Nome completo
                  </label>
                  <input
                    id="lead-nome"
                    className="mt-1 w-full border-b-2 border-outline-variant bg-transparent py-2 text-sm text-on-surface outline-none focus:border-primary"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    required
                    autoComplete="name"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.12em] text-primary" htmlFor="lead-email">
                    E-mail
                  </label>
                  <input
                    id="lead-email"
                    type="email"
                    className="mt-1 w-full border-b-2 border-outline-variant bg-transparent py-2 text-sm text-on-surface outline-none focus:border-primary"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.12em] text-primary" htmlFor="lead-tel">
                    Telefone
                  </label>
                  <input
                    id="lead-tel"
                    className="mt-1 w-full border-b-2 border-outline-variant bg-transparent py-2 text-sm text-on-surface outline-none focus:border-primary"
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                    autoComplete="tel"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.12em] text-primary" htmlFor="lead-cpf">
                    CPF
                  </label>
                  <input
                    id="lead-cpf"
                    className="mt-1 w-full border-b-2 border-outline-variant bg-transparent py-2 text-sm text-on-surface outline-none focus:border-primary"
                    value={cpf}
                    onChange={(e) => setCpf(e.target.value)}
                    inputMode="numeric"
                    autoComplete="off"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.12em] text-primary" htmlFor="lead-msg">
                    Mensagem / detalhe do pedido
                  </label>
                  <textarea
                    id="lead-msg"
                    rows={4}
                    className="mt-1 w-full resize-y rounded-sm border-2 border-outline-variant bg-white p-2 text-sm text-on-surface outline-none focus:border-primary"
                    value={mensagem}
                    onChange={(e) => setMensagem(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:gap-3">
                  <Link
                    to={cadastroBasePath}
                    className="inline-flex justify-center rounded-sm border-2 border-outline-variant px-4 py-2.5 text-center text-[10px] font-black uppercase tracking-[0.12em] text-primary hover:bg-surface-container-low"
                  >
                    Voltar
                  </Link>
                  {useWizard ? (
                    <button
                      type="button"
                      onClick={() => setWizardStepIndex(Math.max(0, contactStepIndex - 1))}
                      className="inline-flex justify-center rounded-sm border-2 border-outline-variant px-4 py-2.5 text-center text-[10px] font-black uppercase tracking-[0.12em] text-primary hover:bg-surface-container-low"
                    >
                      Voltar às perguntas
                    </button>
                  ) : null}
                  <button
                    type="submit"
                    disabled={busy}
                    className="rounded-sm border-2 border-primary bg-primary px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.12em] text-white hover:opacity-95 disabled:opacity-60"
                  >
                    {busy ? 'A enviar…' : 'Enviar pedido'}
                  </button>
                </div>
              </>
            )}
          </form>
        )}
      </div>
    </AuthSplitLayout>
  );
}
