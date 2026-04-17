/**
 * Normalização de CNPJ (14 dígitos) para validação Zod e integrações.
 * Consulta comercial de dados cadastrais: use `cnpja.js` (fetchCnpjaOffice).
 */

export function onlyDigits(s) {
  return String(s ?? '').replace(/\D/g, '');
}

/** @returns {string|null} 14 dígitos ou null */
export function normalizeCnpj14(input) {
  const d = onlyDigits(input);
  if (d.length !== 14) return null;
  return d;
}
