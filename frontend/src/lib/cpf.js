/** CPF brasileiro: apenas dígitos e validação dos verificadores. */

export function normalizeCpfDigits(value) {
  return String(value ?? '').replace(/\D/g, '').slice(0, 11);
}

export function isCpfValid(digits) {
  const d = typeof digits === 'string' ? digits : normalizeCpfDigits(digits);
  if (d.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(d)) return false;
  let s = 0;
  for (let i = 0; i < 9; i++) s += parseInt(d[i], 10) * (10 - i);
  let r = (s * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  if (r !== parseInt(d[9], 10)) return false;
  s = 0;
  for (let i = 0; i < 10; i++) s += parseInt(d[i], 10) * (11 - i);
  r = (s * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  return r === parseInt(d[10], 10);
}
