/**
 * Campos fixos de cadastro de organização (empresa / parceiro).
 * Não entram no editor de template — o template só define campos extras.
 * Endereço: CEP + preenchimento automático + número/complemento manual.
 */

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

/** Grupos para o editor admin (ordem fixa). */
export function getOrgBuiltinPartnerFieldGroups() {
  const order = [
    ['produto_servico', 'Produto / serviço'],
    ['logistica', 'Logística e doca'],
  ];
  return order.map(([id, label]) => ({
    id,
    label,
    fields: ORG_BUILTIN_PARTNER_EXTRA_FIELDS.filter((f) => f.group === id),
  }));
}

/**
 * @param {Array<{ id?: string, key: string, label?: string, type?: string, required?: boolean, options?: string[] }>} templateFields
 * @param {{ standardFieldsDisabled?: string[], disabledBuiltinGroups?: string[] }} [opts]
 */
export function mergePartnerOrgExtraFields(templateFields = [], opts = {}) {
  const disabled = new Set((opts.standardFieldsDisabled || []).map((k) => String(k).toLowerCase()));
  const disabledGroups = new Set((opts.disabledBuiltinGroups || []).map((g) => String(g).toLowerCase()));
  const builtins = ORG_BUILTIN_PARTNER_EXTRA_FIELDS.filter(
    (f) =>
      !disabled.has(String(f.key).toLowerCase()) &&
      !disabledGroups.has(String(f.group || '').toLowerCase())
  );
  const reserved = new Set(ORG_BUILTIN_PARTNER_EXTRA_KEYS.map((k) => k.toLowerCase()));
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
    if (f.group === 'logistica') logistics.push(f);
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

export function isReservedOrgFieldKey(key) {
  const k = String(key || '')
    .trim()
    .toLowerCase();
  if (ORG_STANDARD_KEYS.includes(k)) return true;
  return ORG_BUILTIN_PARTNER_EXTRA_KEYS.some((x) => x.toLowerCase() === k);
}
