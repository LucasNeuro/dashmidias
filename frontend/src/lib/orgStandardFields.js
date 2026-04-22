/**
 * Campos fixos de cadastro de organização (empresa / parceiro).
 * Não entram no editor de template — o template só define campos extras.
 * Endereço: CEP + preenchimento automático + número/complemento manual.
 *
 * Catálogo configurável: tabelas hub_standard_field_section + hub_standard_field
 * (ver hubStandardCatalogApi.js). Quando há campos na BD, substituem ORG_BUILTIN_PARTNER_EXTRA_FIELDS.
 */

import { FALLBACK_SIGNUP_WIZARD_STEPS, hubStandardCatalogHasData } from './hubStandardCatalogApi';

/**
 * Mapeia o slug da secção (hub_standard_field_section.wizard_step) para o bucket do wizard actual.
 * @param {string | undefined | null} sectionWizardSlug
 * @param {Array<{ slug?: string, partition_bucket?: string }> | undefined} wizardSteps
 */
export function resolveBuiltinFieldWizardStep(sectionWizardSlug, wizardSteps) {
  const list =
    Array.isArray(wizardSteps) && wizardSteps.length ? wizardSteps : [...FALLBACK_SIGNUP_WIZARD_STEPS];
  const slug = String(sectionWizardSlug ?? 'commercial').trim().toLowerCase();
  if (slug === 'logistica') return 'logistics';
  const row = list.find((w) => String(w.slug ?? '').toLowerCase() === slug);
  if (row?.partition_bucket === 'logistics') return 'logistics';
  return 'commercial';
}

export const ORG_STANDARD_KEYS = /** @type {const} */ ([
  'nome_empresa',
  'cnpj',
  'cpf',
  'email',
  'telefone',
  'cep',
  'logradouro',
  'numero',
  'complemento',
  'bairro',
  'cidade',
  'uf',
  'codigo_ibge',
]);

/**
 * Campos em `extras` presentes em todo cadastro de parceiro (antes dos extras do template).
 * Chaves reservadas — não podem ser repetidas no editor de template.
 * `group`: agrupa na UI de admin (ativar/desativar por template).
 */
export const ORG_BUILTIN_PARTNER_EXTRA_FIELDS = [
  {
    id: 'builtin-categoria_produto_servico',
    key: 'categoria_produto_servico',
    group: 'produto_servico',
    label: 'Categoria de produto/serviço',
    type: 'textarea',
    required: false,
    placeholder: 'Tags de classificação — ex.: matéria-prima, EPI, manutenção predial',
    rows: 4,
  },
  {
    id: 'builtin-capacidade_produtiva_mensal',
    key: 'capacidade_produtiva_mensal',
    group: 'produto_servico',
    label: 'Capacidade produtiva mensal',
    type: 'text',
    required: false,
    placeholder: 'Unidades, toneladas ou horas que entrega por mês',
  },
  {
    id: 'builtin-moq_pedido_minimo',
    key: 'moq_pedido_minimo',
    group: 'produto_servico',
    label: 'Quantidade mínima de pedido (MOQ)',
    type: 'text',
    required: false,
    placeholder: 'Menor lote que aceitam vender',
  },
  {
    id: 'builtin-portfolio_catalogo',
    key: 'portfolio_catalogo',
    group: 'produto_servico',
    label: 'Portfólio / catálogo',
    type: 'url',
    required: false,
    placeholder: 'Link (drive, site ou PDF) com a lista de produtos',
  },
  {
    id: 'builtin-ramo_atuacao_principal',
    key: 'ramo_atuacao_principal',
    group: 'atuacao_servicos',
    label: 'Ramo de atuação principal',
    type: 'text',
    required: false,
    placeholder: 'Ex.: marmorista, gesseiro, designer de interiores, pedreiro de acabamento',
  },
  {
    id: 'builtin-servicos_realizados',
    key: 'servicos_realizados',
    group: 'atuacao_servicos',
    label: 'Serviços realizados',
    type: 'textarea',
    required: false,
    placeholder:
      'Sub-especialidades — ex.: instalação de cubas esculpidas, assentamento de grandes formatos, pintura técnica',
    rows: 4,
  },
  {
    id: 'builtin-registro_profissional',
    key: 'registro_profissional',
    group: 'atuacao_servicos',
    label: 'Registro profissional',
    type: 'text',
    required: false,
    placeholder: 'Ex.: CAU (arquitetos), CREA (engenheiros ou técnicos)',
  },
  {
    id: 'builtin-portfolio_obras_midia',
    key: 'portfolio_obras_midia',
    group: 'atuacao_servicos',
    label: 'Portfólio / fotos de obras',
    type: 'url',
    required: false,
    placeholder: 'Instagram, site, pasta em nuvem (Drive, etc.)',
  },
  {
    id: 'builtin-equipamentos_proprios',
    key: 'equipamentos_proprios',
    group: 'atuacao_servicos',
    label: 'Equipamentos próprios',
    type: 'textarea',
    required: false,
    placeholder: 'Ex.: andaimes, laser, máquinas de corte — o que dispõem para execução',
    rows: 3,
  },
  {
    id: 'builtin-modalidade_frete_padrao',
    key: 'modalidade_frete_padrao',
    group: 'logistica',
    label: 'Modalidade de frete padrão',
    type: 'select',
    required: false,
    options: ['CIF (fornecedor paga o frete)', 'FOB (comprador paga o frete)'],
    placeholder: '',
  },
  {
    id: 'builtin-transportadoras_homologadas',
    key: 'transportadoras_homologadas',
    group: 'logistica',
    label: 'Transportadoras homologadas',
    type: 'textarea',
    required: false,
    placeholder: 'Transportadoras que costuma utilizar',
    rows: 3,
  },
  {
    id: 'builtin-horario_recebimento_doca',
    key: 'horario_recebimento_doca',
    group: 'logistica',
    label: 'Horário de recebimento (doca)',
    type: 'text',
    required: false,
    placeholder: 'Ex.: 08:00 às 17:00',
  },
  {
    id: 'builtin-horario_expedicao_coleta',
    key: 'horario_expedicao_coleta',
    group: 'logistica',
    label: 'Horário de expedição / coleta',
    type: 'text',
    required: false,
    placeholder: 'Quando a mercadoria está pronta para sair',
  },
  {
    id: 'builtin-horario_cutoff',
    key: 'horario_cutoff',
    group: 'logistica',
    label: 'Horário de cut-off (hora limite)',
    type: 'text',
    required: false,
    placeholder: 'Até que horas o pedido conta no prazo do dia',
  },
  {
    id: 'builtin-janelas_agendamento',
    key: 'janelas_agendamento',
    group: 'logistica',
    label: 'Janelas de agendamento',
    type: 'textarea',
    required: false,
    placeholder: 'Marcação prévia ou ordem de chegada',
    rows: 3,
  },
  {
    id: 'builtin-intervalos_pausa',
    key: 'intervalos_pausa',
    group: 'logistica',
    label: 'Intervalos de pausa',
    type: 'textarea',
    required: false,
    placeholder: 'Almoço, troca de turno, etc.',
    rows: 3,
  },
  {
    id: 'builtin-restricoes_veiculo',
    key: 'restricoes_veiculo',
    group: 'logistica',
    label: 'Restrições de veículo',
    type: 'textarea',
    required: false,
    placeholder: 'Ex.: só VUC, bitrem não entra, altura máxima 4 m',
    rows: 3,
  },
  {
    id: 'builtin-tempo_medio_carga_descarga',
    key: 'tempo_medio_carga_descarga',
    group: 'logistica',
    label: 'Tempo médio de carga/descarga',
    type: 'text',
    required: false,
    placeholder: 'Tempo médio do veículo parado na doca',
  },
];

/** @type {readonly string[]} */
export const ORG_BUILTIN_PARTNER_EXTRA_KEYS = ORG_BUILTIN_PARTNER_EXTRA_FIELDS.map((f) => f.key);

/** @param {typeof ORG_BUILTIN_PARTNER_EXTRA_FIELDS[number]} f */
function withWizardStep(f) {
  return {
    ...f,
    wizardStep: f.group === 'logistica' ? 'logistics' : 'commercial',
  };
}

/** Grupos em código (fallback quando a BD está vazia ou indisponível). */
function legacyBuiltinGroups() {
  const order = [
    ['produto_servico', 'Produto / serviço'],
    ['atuacao_servicos', 'Atuação e serviços (obra / decoração)'],
    ['logistica', 'Logística e doca'],
  ];
  return order.map(([id, label]) => ({
    id,
    label,
    fields: ORG_BUILTIN_PARTNER_EXTRA_FIELDS.filter((f) => f.group === id).map(withWizardStep),
  }));
}

/**
 * Secções e campos padrão para o editor de template (separador Padrão).
 * @param {{ sections: Array<Record<string, unknown>>, fields: Array<Record<string, unknown>> } | null} [catalog]
 */
export function getOrgBuiltinPartnerFieldGroups(catalog = null) {
  if (!hubStandardCatalogHasData(catalog)) {
    return legacyBuiltinGroups();
  }
  const sections = [...catalog.sections]
    .filter((s) => s.is_active !== false)
    .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0));
  const fields = [...catalog.fields]
    .filter((f) => f.is_active !== false)
    .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0));
  return sections.map((s) => ({
    id: String(s.slug),
    label: String(s.title ?? s.slug),
    fields: fields
      .filter((f) => f.section_id === s.id)
      .map((f) => ({
        id: `std-${f.id}`,
        key: String(f.field_key),
        group: String(s.slug),
        wizardStep: resolveBuiltinFieldWizardStep(s.wizard_step, catalog?.wizardSteps),
        label: String(f.label ?? ''),
        type: String(f.field_type ?? 'text'),
        required: f.required === true,
        options: Array.isArray(f.options) ? f.options.map((x) => String(x)) : [],
        placeholder: f.placeholder != null ? String(f.placeholder) : '',
        rows: f.rows != null ? Number(f.rows) : undefined,
      })),
  }));
}

/** Lista plana de chaves reservadas (extras do template não podem repetir). */
export function listReservedBuiltinPartnerKeys(catalog = null) {
  if (hubStandardCatalogHasData(catalog)) {
    return catalog.fields.map((f) => String(f.field_key).toLowerCase());
  }
  return ORG_BUILTIN_PARTNER_EXTRA_KEYS.map((k) => k.toLowerCase());
}

/**
 * @param {Array<{ id?: string, key: string, label?: string, type?: string, required?: boolean, options?: string[], group?: string, wizardStep?: string }>} templateFields
 * @param {{ standardFieldsDisabled?: string[], disabledBuiltinGroups?: string[] }} [opts]
 * @param {{ sections: unknown[], fields: unknown[] } | null} [catalog]
 */
export function mergePartnerOrgExtraFields(templateFields = [], opts = {}, catalog = null) {
  const disabled = new Set((opts.standardFieldsDisabled || []).map((k) => String(k).toLowerCase()));
  const disabledGroups = new Set((opts.disabledBuiltinGroups || []).map((g) => String(g).toLowerCase()));
  const builtinsSource = hubStandardCatalogHasData(catalog)
    ? getOrgBuiltinPartnerFieldGroups(catalog).flatMap((g) => g.fields)
    : ORG_BUILTIN_PARTNER_EXTRA_FIELDS.map(withWizardStep);
  const builtins = builtinsSource.filter(
    (f) =>
      !disabled.has(String(f.key).toLowerCase()) &&
      !disabledGroups.has(String(f.group || '').toLowerCase())
  );
  const reserved = new Set(listReservedBuiltinPartnerKeys(catalog));
  const rest = (templateFields || []).filter((f) => f?.key && !reserved.has(String(f.key).toLowerCase()));
  return [...builtins, ...rest];
}

/**
 * Separa campos padrão em duas etapas no wizard: comercial (produto + extras do template) e logística.
 * @param {Array<{ key: string, group?: string }>} mergedFields — resultado de mergePartnerOrgExtraFields
 */
export function partitionPartnerOrgExtraFields(mergedFields = []) {
  /** @type {typeof mergedFields} */
  const commercial = [];
  /** @type {typeof mergedFields} */
  const logistics = [];
  for (const f of mergedFields) {
    const ws = /** @type {{ wizardStep?: string, group?: string }} */ (f).wizardStep;
    const isLog =
      ws === 'logistics' || String(/** @type {{ group?: string }} */ (f).group || '').toLowerCase() === 'logistica';
    if (isLog) logistics.push(f);
    else commercial.push(f);
  }
  return { commercial, logistics };
}

/** @type {Record<string, { label: string; hint?: string }>} */
export const ORG_STANDARD_META = {
  nome_empresa: { label: 'Nome da empresa', hint: 'Razão social ou nome fantasia' },
  cnpj: { label: 'CNPJ' },
  cpf: { label: 'CPF', hint: 'Para prestadores sem CNPJ (ex.: empreiteiro, MEI)' },
  email: { label: 'E-mail comercial' },
  telefone: { label: 'Telefone / WhatsApp' },
  cep: { label: 'CEP', hint: '8 dígitos' },
  logradouro: { label: 'Logradouro' },
  numero: { label: 'Número' },
  complemento: { label: 'Complemento' },
  bairro: { label: 'Bairro' },
  cidade: { label: 'Cidade' },
  uf: { label: 'UF' },
  codigo_ibge: { label: 'Código do município' },
};

/**
 * @param {string} key
 * @param {{ sections?: unknown[], fields?: unknown[] } | null} [catalog]
 */
export function isReservedOrgFieldKey(key, catalog = null) {
  const k = String(key || '')
    .trim()
    .toLowerCase();
  if (ORG_STANDARD_KEYS.includes(k)) return true;
  return listReservedBuiltinPartnerKeys(catalog).some((x) => x === k);
}
