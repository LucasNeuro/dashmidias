/**
 * Catálogo de tipos de parceiro / organização no HUB.
 * Hoje: fonte única no frontend (como “tabela auxiliar” em código).
 * Depois: espelhar em Supabase (`hub_partner_kind` ou `organizations.partner_kind_id`).
 */

/** @typedef {{ value: string, label: string, description?: string }} HubPartnerKind */

/** @type {HubPartnerKind[]} */
export const HUB_PARTNER_KINDS = [
  { value: 'arquitetos', label: 'Arquitetos', description: 'Escritórios e profissionais de arquitetura' },
  { value: 'engenharias', label: 'Engenharias', description: 'Empresas e profissionais de engenharia' },
  {
    value: 'prestadores_servico',
    label: 'Prestadores de serviço',
    description: 'Serviços gerais vinculados à obra',
  },
  { value: 'parceiros_produtos', label: 'Parceiros de produtos', description: 'Marcas, distribuidores e fornecedores' },
  { value: 'imobiliarios', label: 'Imobiliários', description: 'Incorporadoras, imobiliárias e correlatos' },
];

export const DEFAULT_HUB_PARTNER_KIND = 'prestadores_servico';

/** Mapeia slugs antigos (templates já salvos no localStorage) para o catálogo atual. */
const LEGACY_PARTNER_KIND_MAP = /** @type {Record<string, string>} */ ({
  midia: 'parceiros_produtos',
  agencia: 'prestadores_servico',
  fornecedor: 'parceiros_produtos',
  parceiro_geral: 'prestadores_servico',
});

const ALLOWED = new Set(HUB_PARTNER_KINDS.map((k) => k.value));

/**
 * @param {unknown} raw
 * @returns {string}
 */
export function normalizePartnerKindSlug(raw) {
  const s = String(raw ?? '').trim();
  if (ALLOWED.has(s)) return s;
  const mapped = LEGACY_PARTNER_KIND_MAP[s];
  if (mapped && ALLOWED.has(mapped)) return mapped;
  return DEFAULT_HUB_PARTNER_KIND;
}

/**
 * @param {string} value
 * @returns {HubPartnerKind | undefined}
 */
export function getHubPartnerKind(value) {
  return HUB_PARTNER_KINDS.find((k) => k.value === value);
}

/** Para selects e listagens: `{ value, label }[]` */
export function hubPartnerKindSelectOptions() {
  return HUB_PARTNER_KINDS.map(({ value, label }) => ({ value, label }));
}
