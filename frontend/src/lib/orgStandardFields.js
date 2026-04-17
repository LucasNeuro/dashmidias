/**
 * Campos fixos de cadastro de organização (empresa / parceiro).
 * Não entram no editor de template — o template só define campos extras.
 * Endereço: CEP + preenchimento automático + número/complemento manual.
 */

export const ORG_STANDARD_KEYS = /** @type {const} */ ([
  'nome_empresa',
  'cnpj',
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

/** @type {Record<string, { label: string; hint?: string }>} */
export const ORG_STANDARD_META = {
  nome_empresa: { label: 'Nome da empresa', hint: 'Razão social ou nome fantasia' },
  cnpj: { label: 'CNPJ' },
  email: { label: 'E-mail comercial' },
  telefone: { label: 'Telefone / WhatsApp' },
  cep: { label: 'CEP', hint: '8 dígitos' },
  logradouro: { label: 'Logradouro' },
  numero: { label: 'Número' },
  complemento: { label: 'Complemento', hint: 'Opcional' },
  bairro: { label: 'Bairro' },
  cidade: { label: 'Cidade' },
  uf: { label: 'UF' },
  codigo_ibge: { label: 'Código do município' },
};

export function isReservedOrgFieldKey(key) {
  const k = String(key || '')
    .trim()
    .toLowerCase();
  return ORG_STANDARD_KEYS.includes(k);
}
