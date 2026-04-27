import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PublicRegistrationShell } from '../components/PublicRegistrationShell';
import { useUiFeedback } from '../context/UiFeedbackContext';
import { fetchActiveLeadSegments } from '../lib/leadSegmentsApi';
import { FALLBACK_LEAD_SEGMENTS } from '../lib/leadSegmentsFallback';
import {
  classifyDocument,
  cnpjPartnerKindChoices,
  documentDigitsOnly,
  filterPartnerStepsWithResolvedTemplate,
  getBranchStepsPrefix,
  isBranchStep,
  parseBranchConfig,
  templateToTplParam,
} from '../lib/registrationFlowRules';
import { fetchPublicMasterFlowWithSteps } from '../lib/registrationMasterFlowApi';
import { leadSegmentsPublicQueryKey, masterFlowPublicQueryKey } from '../lib/queryKeys';
import { getSupabase, isSupabaseConfigured } from '../lib/supabaseClient';

/** @type {string | undefined} */
const defaultPartnerTpl =
  typeof import.meta !== 'undefined' ? import.meta.env?.VITE_DEFAULT_PARTNER_SIGNUP_TPL : undefined;

const PARTNER_FLOW_STORAGE = 'ob10_partner_intake_v1';

function envFallbackMasterFlowSlug() {
  return typeof import.meta !== 'undefined' && import.meta.env?.VITE_REGISTRATION_MASTER_FLOW_SLUG
    ? String(import.meta.env.VITE_REGISTRATION_MASTER_FLOW_SLUG).trim()
    : 'ob10-intake';
}

export function RegistrationEntryPage() {
  const { flowSlug: flowSlugParam } = useParams();
  const masterFlowSlug = useMemo(() => {
    const raw = String(flowSlugParam ?? '').trim();
    if (raw) {
      try {
        return decodeURIComponent(raw);
      } catch {
        return raw;
      }
    }
    return envFallbackMasterFlowSlug();
  }, [flowSlugParam]);

  const { toast } = useUiFeedback();
  const navigate = useNavigate();
  /** choose = perguntas do fluxo; doc = CPF/CNPJ; lead = segmentos; partner_ramo = CNPJ + escolha de ramo */
  const [phase, setPhase] = useState(/** @type {'choose' | 'doc' | 'lead' | 'partner_ramo'} */ ('doc'));
  const [pendingCnpjDigits, setPendingCnpjDigits] = useState('');
  const [branchIdx, setBranchIdx] = useState(0);
  const [docRaw, setDocRaw] = useState('');
  const [busy, setBusy] = useState(false);
  /** Aplica escolha inicial (pergunta vs documento) uma vez por slug, sem bloquear após retry/refetch. */
  const intakeInitForSlugRef = useRef(/** @type {string | null} */ (null));

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
    enabled: isSupabaseConfigured() && phase === 'lead',
    staleTime: 120_000,
  });

  useEffect(() => {
    intakeInitForSlugRef.current = null;
    setBranchIdx(0);
    setDocRaw('');
    setPendingCnpjDigits('');
    setPhase('doc');
  }, [masterFlowSlug]);

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
    enabled: isSupabaseConfigured(),
    staleTime: 120_000,
    retry: 1,
  });

  const sortedFlowSteps = useMemo(() => {
    const steps = masterFlowQuery.data?.steps ?? [];
    return [...steps].sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0));
  }, [masterFlowQuery.data?.steps]);

  const branchQueue = useMemo(() => {
    const prefix = getBranchStepsPrefix(sortedFlowSteps);
    return prefix
      .map((step) => {
        const config = parseBranchConfig(step.branch_config);
        return config ? { step, config } : null;
      })
      .filter(Boolean);
  }, [sortedFlowSteps]);

  const flowFetched = !isSupabaseConfigured() || masterFlowQuery.isFetched;
  /** Só o primeiro carregamento (sem dados em cache): faixa discreta, sem bloquear a página. */
  const flowInitialLoading = isSupabaseConfigured() && masterFlowQuery.isPending;

  useEffect(() => {
    if (!flowFetched) return;
    if (intakeInitForSlugRef.current === masterFlowSlug) return;
    intakeInitForSlugRef.current = masterFlowSlug;
    if (branchQueue.length > 0) {
      setPhase('choose');
      setBranchIdx(0);
    } else {
      setPhase('doc');
    }
  }, [flowFetched, masterFlowSlug, branchQueue.length]);

  const safeBranchIdx =
    branchQueue.length === 0 ? 0 : Math.min(Math.max(0, branchIdx), branchQueue.length - 1);

  useEffect(() => {
    if (phase !== 'choose' || branchQueue.length === 0) return;
    if (safeBranchIdx !== branchIdx) setBranchIdx(safeBranchIdx);
  }, [phase, branchQueue.length, branchIdx, safeBranchIdx]);

  const segments = useMemo(() => segmentsQuery.data ?? FALLBACK_LEAD_SEGMENTS, [segmentsQuery.data]);

  const currentBranch = branchQueue[safeBranchIdx] ?? null;

  function handleBranchOption(option) {
    const { outcome, segment_slug: segmentSlug } = option;
    if (outcome === 'advance_branch') {
      if (safeBranchIdx < branchQueue.length - 1) {
        setBranchIdx((i) => i + 1);
        return;
      }
      setPhase('doc');
      return;
    }
    if (outcome === 'lead_segments') {
      setPhase('lead');
      return;
    }
    if (outcome === 'partner_document') {
      setPhase('doc');
      return;
    }
    if (outcome === 'lead_direct') {
      if (segmentSlug) {
        navigate(
          `/cadastro/lead?segment=${encodeURIComponent(segmentSlug)}&flow=${encodeURIComponent(masterFlowSlug)}`
        );
      } else {
        setPhase('lead');
      }
    }
  }

  const cnpjKindOptions = useMemo(() => cnpjPartnerKindChoices(sortedFlowSteps), [sortedFlowSteps]);

  function resolveCnpjPartnerSteps(/** @type {string} */ partnerKindSlug) {
    const templateOnly = sortedFlowSteps.filter((s) => !isBranchStep(s));
    const ctx =
      partnerKindSlug.trim().length > 0
        ? { docType: /** @type {'cnpj'} */ ('cnpj'), audience: /** @type {'partner'} */ ('partner'), partnerKind: partnerKindSlug.trim() }
        : { docType: /** @type {'cnpj'} */ ('cnpj'), audience: /** @type {'partner'} */ ('partner') };
    return filterPartnerStepsWithResolvedTemplate(templateOnly, ctx);
  }

  async function continueWithCnpj(/** @type {string} */ digits, /** @type {string} */ partnerKindSlug = '') {
    setBusy(true);
    try {
      let steps = resolveCnpjPartnerSteps(partnerKindSlug);
      if (steps.length === 0 && !partnerKindSlug.trim()) {
        const choices = cnpjKindOptions;
        if (choices.length === 1) {
          steps = resolveCnpjPartnerSteps(choices[0].slug);
        } else if (choices.length > 1) {
          setPendingCnpjDigits(digits);
          setPhase('partner_ramo');
          setBusy(false);
          return;
        }
      }

      const first = steps[0];
      const tpl =
        first != null ? templateToTplParam(first.template) : typeof defaultPartnerTpl === 'string' ? defaultPartnerTpl.trim() : '';

      if (!tpl) {
        toast(
          'Não há etapa de parceiro com formulário válido para este CNPJ e ramo. Em Cadastro — fluxos, associe um template com condição CNPJ e parceiro (e ramo, se usar ramos).',
          { variant: 'warning', duration: 11000 }
        );
        return;
      }

      try {
        sessionStorage.setItem(
          PARTNER_FLOW_STORAGE,
          JSON.stringify({
            flowSlug: masterFlowSlug,
            docDigits: digits,
            steps: steps.map((s) => ({
              stepId: s.id,
              templateId: s.template_id,
              tplParam: templateToTplParam(s.template),
              sortOrder: s.sort_order,
            })),
            currentIndex: 0,
          })
        );
      } catch {
        /* ignore */
      }

      navigate(
        `/cadastro/organizacao?tpl=${encodeURIComponent(tpl)}&flow=${encodeURIComponent(masterFlowSlug)}&step=0&from=intake`,
        { replace: false }
      );
    } finally {
      setBusy(false);
    }
  }

  async function continueWithDocument() {
    const digits = documentDigitsOnly(docRaw);
    const kind = classifyDocument(digits);
    if (!kind) {
      toast('Indique um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.', { variant: 'warning', duration: 5000 });
      return;
    }

    if (kind === 'cpf') {
      try {
        sessionStorage.setItem(
          'ob10_lead_intake_v1',
          JSON.stringify({ docDigits: digits, at: Date.now(), flow: masterFlowSlug })
        );
      } catch {
        /* ignore */
      }
      setPhase('lead');
      return;
    }

    await continueWithCnpj(digits, '');
  }

  function goBackFromDoc() {
    if (phase === 'partner_ramo') {
      setPhase('doc');
      setPendingCnpjDigits('');
      return;
    }
    if (branchQueue.length > 0) {
      setPhase('choose');
      setBranchIdx(Math.max(0, safeBranchIdx));
      return;
    }
    setPhase('doc');
  }

  function goBackFromLead() {
    if (branchQueue.length > 0) {
      setPhase('choose');
      setBranchIdx(Math.max(0, branchQueue.length - 1));
      return;
    }
    setPhase('doc');
  }

  return (
    <PublicRegistrationShell>
      {flowInitialLoading ? (
        <p className="mb-2 text-center text-[11px] font-medium text-on-surface-variant" role="status">
          <span className="inline-flex items-center gap-1.5">
            <span className="material-symbols-outlined animate-pulse text-base text-sky-700">progress_activity</span>
            Atualizando fluxo…
          </span>
        </p>
      ) : null}
      <div className="flex w-full flex-col gap-4">
        {phase === 'choose' && branchQueue.length > 0 && !currentBranch ? (
          <p className="text-center text-sm text-on-surface-variant">Carregando pergunta…</p>
        ) : null}

        {phase === 'choose' && currentBranch ? (
          <div className="space-y-3 rounded-none border border-outline-variant bg-white p-4 shadow-md sm:p-5">
            <h1 className="text-lg font-black tracking-tight text-primary sm:text-xl">{currentBranch.config.prompt}</h1>
            {currentBranch.config.subtitle ? (
              <p className="text-sm text-on-surface-variant">{currentBranch.config.subtitle}</p>
            ) : null}
            <ul className="flex flex-col gap-2">
              {currentBranch.config.options.map((opt) => (
                <li key={opt.id}>
                  <button
                    type="button"
                    className="flex w-full items-start gap-3 rounded-sm border-2 border-outline-variant bg-white px-4 py-3 text-left text-sm font-bold text-primary hover:border-primary hover:bg-surface-container-low"
                    onClick={() => handleBranchOption(opt)}
                  >
                    <span className="material-symbols-outlined mt-0.5 shrink-0 text-[22px] text-tertiary" aria-hidden>
                      arrow_circle_right
                    </span>
                    <span className="min-w-0 flex-1">
                      {opt.label}
                      {opt.description ? (
                        <span className="mt-1 block text-xs font-normal text-on-surface-variant">{opt.description}</span>
                      ) : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {phase === 'partner_ramo' && cnpjKindOptions.length > 0 ? (
          <div className="space-y-3 rounded-none border border-outline-variant bg-white p-4 shadow-md sm:p-5">
            <h1 className="text-lg font-black tracking-tight text-primary sm:text-xl">Ramo de atuação</h1>
            <p className="text-sm text-on-surface-variant">
              Escolha o tipo de parceiro para abrir o formulário certo.
            </p>
            <ul className="flex flex-col gap-2">
              {cnpjKindOptions.map((opt) => (
                <li key={opt.slug}>
                  <button
                    type="button"
                    disabled={busy}
                    className="flex w-full items-start gap-3 rounded-sm border-2 border-outline-variant bg-white px-4 py-3 text-left text-sm font-bold text-primary hover:border-primary hover:bg-surface-container-low disabled:opacity-60"
                    onClick={() => void continueWithCnpj(pendingCnpjDigits, opt.slug)}
                  >
                    <span className="material-symbols-outlined mt-0.5 shrink-0 text-[22px] text-tertiary" aria-hidden>
                      business_center
                    </span>
                    <span className="min-w-0 flex-1">{opt.label}</span>
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="inline-flex w-full items-center justify-center gap-1 text-center text-xs font-medium text-on-surface-variant underline"
              onClick={goBackFromDoc}
            >
              <span className="material-symbols-outlined text-[16px]" aria-hidden>
                arrow_back
              </span>
              Voltar
            </button>
          </div>
        ) : null}

        {phase === 'doc' ? (
          <div className="space-y-3 rounded-none border border-outline-variant bg-white p-4 shadow-md sm:p-5">
            <h1 className="flex items-center gap-2 text-lg font-black tracking-tight text-primary sm:text-xl">
              <span className="material-symbols-outlined text-2xl text-primary" aria-hidden>
                badge
              </span>
              Cadastro
            </h1>
            <p className="text-sm text-on-surface-variant">Informe o CPF ou o CNPJ (apenas números).</p>
            <label className="block text-[10px] font-black uppercase tracking-[0.12em] text-primary" htmlFor="doc-intake">
              CPF ou CNPJ
            </label>
            <input
              id="doc-intake"
              className="w-full border-b-2 border-outline-variant bg-transparent py-2 text-sm text-on-surface outline-none focus:border-primary"
              inputMode="numeric"
              autoComplete="off"
              placeholder="Somente números"
              value={docRaw}
              onChange={(e) => setDocRaw(e.target.value)}
            />
            <button
              type="button"
              disabled={busy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-sm border-2 border-primary bg-primary px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.12em] text-white hover:opacity-95 disabled:opacity-60"
              onClick={() => void continueWithDocument()}
            >
              {busy ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-[18px]" aria-hidden>
                    progress_activity
                  </span>
                  Encaminhando…
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]" aria-hidden>
                    arrow_forward
                  </span>
                  Continuar
                </>
              )}
            </button>
            {branchQueue.length > 0 ? (
              <button
                type="button"
                className="inline-flex w-full items-center justify-center gap-1 text-center text-xs font-medium text-on-surface-variant underline"
                onClick={goBackFromDoc}
              >
                <span className="material-symbols-outlined text-[16px]" aria-hidden>
                  arrow_back
                </span>
                Voltar
              </button>
            ) : null}
          </div>
        ) : null}

        {phase === 'lead' ? (
          <div className="space-y-3">
            <p className="flex items-center justify-center gap-2 text-center text-sm font-semibold text-primary">
              <span className="material-symbols-outlined text-[20px]" aria-hidden>
                list_alt
              </span>
              Escolha uma opção
            </p>
            {segmentsQuery.isPending ? (
              <p className="text-center text-sm text-on-surface-variant">Carregando opções…</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {segments.map((s) => (
                  <li key={s.slug}>
                    <Link
                      to={`/cadastro/lead?segment=${encodeURIComponent(s.slug)}&flow=${encodeURIComponent(masterFlowSlug)}`}
                      className="flex items-start gap-3 rounded-sm border-2 border-outline-variant bg-white px-4 py-3 text-sm font-bold text-primary hover:border-primary hover:bg-surface-container-low"
                    >
                      <span className="material-symbols-outlined mt-0.5 shrink-0 text-[22px] text-tertiary" aria-hidden>
                        chevron_right
                      </span>
                      <span className="min-w-0 flex-1">
                        {s.label}
                        {s.description ? (
                          <span className="mt-1 block text-xs font-normal text-on-surface-variant">{s.description}</span>
                        ) : null}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs font-medium text-on-surface-variant underline"
              onClick={goBackFromLead}
            >
              <span className="material-symbols-outlined text-[16px]" aria-hidden>
                arrow_back
              </span>
              Voltar
            </button>
          </div>
        ) : null}
      </div>
    </PublicRegistrationShell>
  );
}
