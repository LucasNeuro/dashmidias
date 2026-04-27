import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { PublicRegistrationShell } from '../components/PublicRegistrationShell';
import { useUiFeedback } from '../context/UiFeedbackContext';
import { fetchActiveLeadSegments } from '../lib/leadSegmentsApi';
import { FALLBACK_LEAD_SEGMENTS } from '../lib/leadSegmentsFallback';
import { classifyDocument, documentDigitsOnly } from '../lib/registrationFlowRules';
import { fetchPublicInviteTemplateByPartnerKind } from '../lib/registrationFormTemplatesApi';
import { HUB_PARTNER_KINDS } from '../lib/hubPartnerKinds';
import { leadSegmentsPublicQueryKey } from '../lib/queryKeys';
import { getSupabase, isSupabaseConfigured } from '../lib/supabaseClient';

/** @type {string | undefined} */
const defaultPartnerTpl =
  typeof import.meta !== 'undefined' ? import.meta.env?.VITE_DEFAULT_PARTNER_SIGNUP_TPL : undefined;

const PARTNER_FLOW_STORAGE = 'ob10_partner_intake_v1';

export function RegistrationEntryPage() {
  const { toast } = useUiFeedback();
  const navigate = useNavigate();
  /** doc = CPF/CNPJ; lead = segmentos; partner_ramo = CNPJ + escolha de ramo */
  const [phase, setPhase] = useState(/** @type {'doc' | 'lead' | 'partner_ramo'} */ ('doc'));
  const [pendingCnpjDigits, setPendingCnpjDigits] = useState('');
  const [docRaw, setDocRaw] = useState('');
  const [busy, setBusy] = useState(false);

  const ramoPickerOptions = useMemo(
    () =>
      HUB_PARTNER_KINDS.map((k) => ({
        slug: k.value,
        label: k.label,
        description: k.description || '',
      })),
    []
  );

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

  const segments = useMemo(() => segmentsQuery.data ?? FALLBACK_LEAD_SEGMENTS, [segmentsQuery.data]);

  async function continueWithCnpj(/** @type {string} */ digits, /** @type {string} */ partnerKindSlug = '') {
    setBusy(true);
    try {
      let kind = String(partnerKindSlug || '').trim();

      if (!kind) {
        const cat = HUB_PARTNER_KINDS;
        if (cat.length === 1) {
          kind = cat[0].value;
        } else {
          setPendingCnpjDigits(digits);
          setPhase('partner_ramo');
          setBusy(false);
          return;
        }
      }

      const sb = getSupabase();
      if (isSupabaseConfigured() && sb) {
        try {
          const row = await fetchPublicInviteTemplateByPartnerKind(sb, kind);
          if (row?.id) {
            const tpl = String(row.invite_slug ?? '').trim() || String(row.id);
            try {
              sessionStorage.setItem(
                PARTNER_FLOW_STORAGE,
                JSON.stringify({
                  docDigits: digits,
                  steps: [
                    {
                      stepId: null,
                      templateId: row.id,
                      tplParam: tpl,
                      sortOrder: 0,
                    },
                  ],
                  currentIndex: 0,
                })
              );
            } catch {
              /* ignore */
            }
            navigate(
              `/cadastro/organizacao?tpl=${encodeURIComponent(tpl)}&step=0&from=intake`,
              { replace: false }
            );
            return;
          }
        } catch {
          /* fallthrough */
        }
      }

      const fallbackTpl = typeof defaultPartnerTpl === 'string' ? defaultPartnerTpl.trim() : '';
      if (fallbackTpl) {
        navigate(`/cadastro/organizacao?tpl=${encodeURIComponent(fallbackTpl)}&step=0&from=intake`, {
          replace: false,
        });
        return;
      }

      toast(
        kind
          ? `Não há modelo de cadastro público com convite aberto para o ramo «${kind}». Crie um modelo com esse tipo de parceiro e convite público ativo em Cadastro homologação.`
          : 'Não há modelo de parceiro configurado. Crie modelos por ramo com convite público em Cadastro homologação.',
        { variant: 'warning', duration: 14000 }
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
        sessionStorage.setItem('ob10_lead_intake_v1', JSON.stringify({ docDigits: digits, at: Date.now() }));
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
    setPhase('doc');
  }

  function goBackFromLead() {
    setPhase('doc');
  }

  return (
    <PublicRegistrationShell>
      <div className="flex w-full flex-col gap-4">
        {phase === 'partner_ramo' && ramoPickerOptions.length > 0 ? (
          <div className="space-y-4 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-md sm:p-7">
            <h1 className="text-lg font-black tracking-tight text-primary sm:text-xl">Tipo de parceiro</h1>
            <p className="text-sm text-slate-600">
              Escolha o ramo para abrir o formulário de homologação certo (cada tipo usa o modelo configurado em Cadastro
              homologação).
            </p>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {ramoPickerOptions.map((opt) => (
                <li key={opt.slug}>
                  <button
                    type="button"
                    disabled={busy}
                    className="flex h-full min-h-[4.5rem] w-full flex-col items-start gap-1 rounded-xl border-2 border-slate-200 bg-white px-4 py-3.5 text-left transition-colors hover:border-primary hover:bg-slate-50 disabled:opacity-60"
                    onClick={() => void continueWithCnpj(pendingCnpjDigits, opt.slug)}
                  >
                    <span className="text-sm font-bold text-primary">{opt.label}</span>
                    {opt.description ? (
                      <span className="text-xs font-normal leading-snug text-slate-600">{opt.description}</span>
                    ) : null}
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
          <div className="space-y-4 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-md sm:p-7">
            <h1 className="flex items-center gap-2 text-xl font-black tracking-tight text-primary sm:text-2xl">
              <span className="material-symbols-outlined text-[28px] text-sky-700" aria-hidden>
                badge
              </span>
              Cadastro
            </h1>
            <p className="text-sm leading-relaxed text-slate-600">
              Informe o CPF (11 dígitos) ou o CNPJ (14 dígitos). Pode colar com pontuação — limpamos automaticamente.
            </p>
            <label className="block text-[10px] font-black uppercase tracking-[0.12em] text-primary" htmlFor="doc-intake">
              CPF ou CNPJ
            </label>
            <input
              id="doc-intake"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-3 text-base text-slate-900 outline-none ring-primary/20 transition-shadow focus:border-primary focus:bg-white focus:ring-2"
              inputMode="numeric"
              autoComplete="off"
              placeholder="Somente números ou cole o documento"
              value={docRaw}
              onChange={(e) => setDocRaw(e.target.value)}
            />
            <button
              type="button"
              disabled={busy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-primary bg-primary px-4 py-3.5 text-[11px] font-black uppercase tracking-[0.12em] text-white shadow-sm hover:opacity-95 disabled:opacity-60"
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
                      to={`/cadastro/lead?segment=${encodeURIComponent(s.slug)}`}
                      className="flex items-start gap-3 rounded-xl border-2 border-slate-200 bg-white px-4 py-3.5 text-sm font-bold text-primary transition-colors hover:border-primary hover:bg-slate-50"
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
