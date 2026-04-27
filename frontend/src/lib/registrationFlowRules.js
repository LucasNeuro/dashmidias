/**
 * Utilitários da entrada pública de cadastro (documento).
 */

/** @param {string} raw */
export function documentDigitsOnly(raw) {
  return String(raw ?? '').replace(/\D/g, '');
}

/** @param {string} digits */
export function classifyDocument(digits) {
  if (digits.length === 11) return 'cpf';
  if (digits.length === 14) return 'cnpj';
  return null;
}
