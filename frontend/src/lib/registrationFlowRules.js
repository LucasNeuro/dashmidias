/**
 * Regras do wizard de cadastro (entry_condition em hub_registration_master_flow_step).
 * @typedef {{ docType?: 'cpf' | 'cnpj', audience?: 'lead' | 'partner', partnerKind?: string, segmentSlug?: string }} FlowRuleContext
 */

/** Configuração padrão ao criar uma «pergunta inicial» no fluxo. */
export const DEFAULT_BRANCH_CONFIG = {
  prompt: 'O que você procura?',
  subtitle: 'Escolha a opção que melhor descreve seu interesse.',
  options: [
    { id: 'comprar', label: 'Comprar', description: 'Produtos ou serviços para obra', outcome: 'lead_segments' },
    { id: 'vender', label: 'Vender / fornecer', description: 'Oferta à rede Obra10+', outcome: 'lead_segments' },
    {
      id: 'parceria',
      label: 'Parceria / homologação',
      description: 'Cadastro de empresa parceira (CPF/CNPJ em seguida)',
      outcome: 'partner_document',
    },
  ],
};

/** Metadados para o editor visual (valores = outcome guardados no JSON). */
export const BRANCH_OUTCOME_OPTIONS = [
  {
    value: 'lead_segments',
    label: 'Segmentos de lead',
    hint: 'Mostra a lista de segmentos; o visitante escolhe como cliente final.',
  },
  {
    value: 'partner_document',
    label: 'Parceiro (CPF/CNPJ)',
    hint: 'Segue para documento e cadastro/homologação de parceiro.',
  },
  {
    value: 'lead_direct',
    label: 'Lead direto (segmento fixo)',
    hint: 'Envia para o cadastro de lead já com um segmento definido (slug).',
  },
  {
    value: 'advance_branch',
    label: 'Próxima pergunta do wizard',
    hint: 'Só use se existir outra «pergunta inicial» a seguir neste fluxo.',
  },
];

/**
 * @param {string} rawJson
 * @returns {Record<string, unknown>}
 */
function cloneDefaultBranch() {
  return /** @type {Record<string, unknown>} */ (JSON.parse(JSON.stringify(DEFAULT_BRANCH_CONFIG)));
}

export function parseBranchConfigDraftJson(rawJson) {
  const t = String(rawJson ?? '').trim();
  if (!t) return cloneDefaultBranch();
  try {
    const o = JSON.parse(t);
    if (o && typeof o === 'object' && !Array.isArray(o)) return /** @type {Record<string, unknown>} */ (o);
  } catch {
    /* fallthrough */
  }
  return cloneDefaultBranch();
}

/**
 * Monta objeto branch_config pronto para gravar (inclui só segment_slug relevante).
 * @param {{ prompt: string, subtitle: string, options: Array<Record<string, unknown>> }} draft
 */
export function serializeBranchConfigDraft(draft) {
  const prompt = String(draft.prompt ?? '').trim();
  const subtitle = String(draft.subtitle ?? '').trim();
  const opts = Array.isArray(draft.options) ? draft.options : [];
  const options = opts.map((item, i) => {
    if (!item || typeof item !== 'object') return null;
    const x = /** @type {Record<string, unknown>} */ (item);
    const outcome = String(x.outcome ?? 'lead_segments').trim();
    const id = String(x.id ?? `opt-${i}`).trim() || `opt-${i}`;
    const label = String(x.label ?? 'Opção').trim() || 'Opção';
    const description = x.description != null ? String(x.description).trim() : '';
    const segment_slug = String(x.segment_slug ?? '').trim();
    const base = { id, label, description, outcome };
    if (outcome === 'lead_direct' && segment_slug) return { ...base, segment_slug };
    return base;
  }).filter(Boolean);
  return { prompt, subtitle, options };
}

/** @param {unknown} raw */
export function documentDigitsOnly(raw) {
  return String(raw ?? '').replace(/\D/g, '');
}

/** @param {string} digits */
export function classifyDocument(digits) {
  if (digits.length === 11) return 'cpf';
  if (digits.length === 14) return 'cnpj';
  return null;
}

/**
 * @param {unknown} entryCondition — jsonb da etapa
 * @param {FlowRuleContext} context
 */
export function stepMatchesCondition(entryCondition, context) {
  const c =
    entryCondition && typeof entryCondition === 'object' && !Array.isArray(entryCondition)
      ? /** @type {Record<string, unknown>} */ (entryCondition)
      : {};
  if (Object.keys(c).length === 0) return true;
  if (c.doc_type != null && String(c.doc_type) !== context.docType) return false;
  if (c.audience != null && String(c.audience) !== context.audience) return false;
  if (c.partner_kind != null && String(c.partner_kind) !== (context.partnerKind ?? '')) return false;
  if (c.lead_segment != null) {
    const want = String(c.lead_segment).trim().toLowerCase();
    const got = String(context.segmentSlug ?? '').trim().toLowerCase();
    if (want !== got) return false;
  }
  return true;
}

/**
 * @param {Array<{ sort_order?: number, entry_condition?: unknown }>} steps
 * @param {FlowRuleContext} context
 */
export function filterAndSortPartnerSteps(steps, context) {
  return [...steps]
    .filter((s) => stepMatchesCondition(s.entry_condition, context))
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
}

/** @param {{ invite_slug?: string | null, id?: string }} template */
export function templateToTplParam(template) {
  if (!template) return '';
  const slug = String(template.invite_slug ?? '').trim();
  if (slug) return slug;
  return String(template.id ?? '').trim();
}

/** @param {unknown} step */
export function isBranchStep(step) {
  return String(step?.step_kind ?? 'template') === 'branch';
}

/**
 * Etapas de ramificação consecutivas no início do fluxo (ordenadas).
 * @param {Array<Record<string, unknown>>} sortedSteps
 */
export function getBranchStepsPrefix(sortedSteps) {
  const out = [];
  for (const s of sortedSteps) {
    if (isBranchStep(s)) out.push(s);
    else break;
  }
  return out;
}

/**
 * @param {unknown} raw — branch_config (jsonb)
 * @returns {null | { prompt: string, subtitle: string, options: Array<{ id: string, label: string, description: string, outcome: string, segment_slug: string }> }}
 */
export function parseBranchConfig(raw) {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = /** @type {Record<string, unknown>} */ (raw);
  const prompt = String(o.prompt ?? '').trim();
  const subtitle = String(o.subtitle ?? '').trim();
  const optsRaw = Array.isArray(o.options) ? o.options : [];
  const allowed = new Set(['lead_segments', 'partner_document', 'lead_direct', 'advance_branch']);
  const options = optsRaw
    .map((item, i) => {
      if (item == null || typeof item !== 'object' || Array.isArray(item)) return null;
      const x = /** @type {Record<string, unknown>} */ (item);
      const outcome = String(x.outcome ?? '').trim();
      if (!allowed.has(outcome)) return null;
      return {
        id: String(x.id ?? `opt-${i}`),
        label: String(x.label ?? 'Opção').trim() || 'Opção',
        description: x.description != null ? String(x.description).trim() : '',
        outcome,
        segment_slug: x.segment_slug != null ? String(x.segment_slug).trim() : '',
      };
    })
    .filter(Boolean);
  if (!prompt || options.length === 0) return null;
  return { prompt, subtitle, options: /** @type {NonNullable<ReturnType<typeof parseBranchConfig>>['options']} */ (options) };
}

/**
 * Etapas de formulário (não ramificação) com template resolvido e invite utilizável.
 * @param {Array<Record<string, unknown>>} steps
 * @param {FlowRuleContext} context
 */
export function filterPartnerStepsWithResolvedTemplate(steps, context) {
  const withTpl = steps.filter((s) => {
    if (isBranchStep(s)) return false;
    const t = s.template;
    if (!s.template_id || !t || typeof t !== 'object') return false;
    const slug = String(t.invite_slug ?? '').trim();
    const id = String(t.id ?? '').trim();
    return Boolean(slug || id);
  });
  return filterAndSortPartnerSteps(withTpl, context);
}

/**
 * Rótulo curto para exibir o slug de ramo (ex.: arquitetos → Arquitetos).
 * @param {string} slug
 */
export function humanizePartnerKindSlug(slug) {
  const s = String(slug ?? '').trim();
  if (!s) return 'Parceiro';
  return s
    .split(/[-_]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Ramos (`partner_kind` em entry_condition) disponíveis para CNPJ + parceiro,
 * quando as etapas exigem ramo antes de escolher o template.
 * @param {Array<Record<string, unknown>>} sortedFlowSteps — etapas já ordenadas
 * @returns {Array<{ slug: string, label: string }>}
 */
export function cnpjPartnerKindChoices(sortedFlowSteps) {
  const seen = new Set();
  /** @type {Array<{ slug: string, label: string }>} */
  const out = [];
  for (const s of sortedFlowSteps) {
    if (isBranchStep(s)) continue;
    const c =
      s.entry_condition && typeof s.entry_condition === 'object' && !Array.isArray(s.entry_condition)
        ? /** @type {Record<string, unknown>} */ (s.entry_condition)
        : {};
    if (c.doc_type != null && String(c.doc_type) !== 'cnpj') continue;
    if (c.audience != null && String(c.audience) !== 'partner') continue;
    const pk = c.partner_kind != null ? String(c.partner_kind).trim() : '';
    if (!pk || seen.has(pk)) continue;
    seen.add(pk);
    out.push({ slug: pk, label: humanizePartnerKindSlug(pk) });
  }
  return out;
}
