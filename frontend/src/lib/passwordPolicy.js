/** Regras alinhadas a boas práticas (cadastro). Login não valida este padrão. */

const SPECIAL_RE = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/;

export function getPasswordChecks(password) {
  const p = password ?? '';
  return [
    { id: 'len', label: 'Mínimo de 8 caracteres', pass: p.length >= 8 },
    { id: 'lower', label: 'Pelo menos uma letra minúscula (a–z)', pass: /[a-z]/.test(p) },
    { id: 'upper', label: 'Pelo menos uma letra maiúscula (A–Z)', pass: /[A-Z]/.test(p) },
    { id: 'digit', label: 'Pelo menos um número (0–9)', pass: /[0-9]/.test(p) },
    { id: 'special', label: 'Pelo menos um símbolo (! @ # $ % …)', pass: SPECIAL_RE.test(p) },
  ];
}

export function isStrongPassword(password) {
  return getPasswordChecks(password).every((c) => c.pass);
}

export function strongPasswordMessage() {
  return 'A senha deve ter no mínimo 8 caracteres, incluindo maiúscula, minúscula, número e símbolo.';
}
