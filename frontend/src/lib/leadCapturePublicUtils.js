import { getEmailValidationMessage, getPhoneValidationMessage } from './publicContactValidation';

/** @param {unknown} s */
function onlyDigits(s) {
  return String(s ?? '').replace(/\D/g, '');
}

export const LEAD_EXTRA_FIELDS_PER_STEP = 6;

/**
 * Agrupa campos extras activos do modelo em blocos para o assistente.
 * @param {Array<Record<string, unknown>> | undefined} fields
 * @returns {Array<Array<Record<string, unknown>>>}
 */
export function chunkLeadExtraFields(fields, maxPerChunk = LEAD_EXTRA_FIELDS_PER_STEP) {
  const active = (Array.isArray(fields) ? fields : []).filter((f) => f && f.inactive !== true);
  if (active.length === 0) return [];
  const chunks = [];
  for (let i = 0; i < active.length; i += maxPerChunk) {
    chunks.push(active.slice(i, i + maxPerChunk));
  }
  return chunks;
}

/**
 * Rótulos tipo homologação: Contacto + perguntas por bloco.
 * @param {number} extraChunkCount
 */
export function buildLeadCaptureStepLabels(extraChunkCount) {
  if (extraChunkCount <= 0) return ['Contacto'];
  if (extraChunkCount === 1) return ['Contacto', 'Perguntas'];
  return ['Contacto', ...Array.from({ length: extraChunkCount }, (_, i) => `Perguntas (${i + 1}/${extraChunkCount})`)];
}

/**
 * Retém compatibilidade: formato + domínio permitido (sem só temporários em `getEmailValidationMessage`).
 */
export function isValidEmailLoose(value) {
  const v = String(value ?? '').trim();
  if (!v) return false;
  return getEmailValidationMessage(v) === null;
}

/**
 * Valida o passo «Contacto» (nome, e-mail, telefone obrigatório, CPF se exigido).
 * @returns {Record<string, string>} chaves: nome | email | telefone | cpf
 */
export function validateLeadContactStep({ nome, email, telefone, cpf }, collectCpf) {
  /** @type {Record<string, string>} */
  const err = {};
  const n = String(nome ?? '').trim();
  if (n.length < 2) err.nome = 'Indique o nome completo (mínimo 2 caracteres).';

  const emailErr = getEmailValidationMessage(email);
  if (emailErr) err.email = emailErr;

  const phoneErr = getPhoneValidationMessage(telefone, { optional: false });
  if (phoneErr) err.telefone = phoneErr;

  const cpfD = onlyDigits(cpf);
  if (collectCpf && cpfD.length !== 11) err.cpf = 'CPF deve ter 11 dígitos.';
  return err;
}

/**
 * Valida o bloco de perguntas extra: obrigatórios preenchidos; e-mail/telefone com formato e domínio/número reais quando preenchidos.
 * @param {Array<Record<string, unknown>>} slice
 * @param {Record<string, string>} values
 * @returns {Record<string, string>} chave = field key
 */
export function validateLeadExtrasSlice(slice, values) {
  /** @type {Record<string, string>} */
  const err = {};
  for (const f of slice || []) {
    if (f?.inactive === true) continue;
    const k = String(f.key ?? '').trim();
    if (!k) continue;
    const type = String(f.type ?? 'text').toLowerCase();
    const required = Boolean(f.required);
    const raw = values[k];

    if (type === 'multiselect') {
      if (!required) continue;
      try {
        const j = JSON.parse(String(raw ?? '[]'));
        if (!Array.isArray(j) || j.length === 0) err[k] = 'Selecione pelo menos uma opção.';
      } catch {
        err[k] = 'Selecione pelo menos uma opção.';
      }
      continue;
    }
    if (type === 'checkbox') {
      if (!required) continue;
      if (raw !== 'true' && raw !== '1') err[k] = 'Este campo é obrigatório.';
      continue;
    }
    if (type === 'file') {
      if (!required) continue;
      if (!String(raw ?? '').trim()) err[k] = 'Envie o documento obrigatório.';
      continue;
    }

    const str = String(raw ?? '').trim();
    if (type === 'email') {
      if (!str) {
        if (required) err[k] = 'Preencha este campo.';
        continue;
      }
      const m = getEmailValidationMessage(str);
      if (m) err[k] = m;
      continue;
    }
    if (type === 'tel') {
      if (!str) {
        if (required) err[k] = 'Preencha este campo.';
        continue;
      }
      const m = getPhoneValidationMessage(str, { optional: false });
      if (m) err[k] = m;
      continue;
    }

    if (required && !str) err[k] = 'Preencha este campo.';
  }
  return err;
}
