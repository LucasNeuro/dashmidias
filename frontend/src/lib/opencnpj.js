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

/**
 * CPF brasileiro: 11 dígitos com dígitos verificadores.
 * @returns {string|null} só dígitos ou null se inválido
 */
/** Máscara visual 000.000.000-00 (estado interno pode ser só dígitos ou texto livre). */
export function formatCpfMask(input) {
  const d = onlyDigits(input).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function normalizeCpf11(input) {
  const d = onlyDigits(input);
  if (d.length !== 11) return null;
  if (/^(\d)\1{10}$/.test(d)) return null;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(d[i], 10) * (10 - i);
  let rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  if (rest !== parseInt(d[9], 10)) return null;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(d[i], 10) * (11 - i);
  rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  if (rest !== parseInt(d[10], 10)) return null;
  return d;
}
