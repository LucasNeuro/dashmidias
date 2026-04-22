import { isReservedOrgFieldKey } from './orgStandardFields';
import { DEFAULT_HUB_PARTNER_KIND, hubPartnerKindSelectOptions, normalizePartnerKindSlug } from './hubPartnerKinds';

const LS_KEY = 'hub_registration_form_templates_v1';

/** Chave localStorage por utilizador (admin); convites públicos leem `loadTemplatesMerged`. */
export function templatesStorageKey(userId) {
  if (!userId) return LS_KEY;
  return `${LS_KEY}__${userId}`;
}

function safeParse(json, fallback) {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

export function newId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function newFieldId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return `fld_${crypto.randomUUID().slice(0, 8)}`;
  return `fld_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * @typedef {{
 *   id: string,
 *   key: string,
 *   label: string,
 *   type: string,
 *   required: boolean,
 *   options?: string[],
 *   lookupCnpj?: boolean,
 * }} TemplateField
 */
/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   description: string,
 *   partnerKind: string,
 *   inviteLinkEnabled?: boolean,
 *   fields: TemplateField[],
 *   createdAt: string,
 *   updatedAt: string,
 * }} RegistrationFormTemplate
 */

/** Catálogo do hub — ver `hubPartnerKinds.js` (e SQL espelhado em `database/hub_partner_kinds.sql`). */
export const PARTNER_KIND_OPTIONS = hubPartnerKindSelectOptions();

export { DEFAULT_HUB_PARTNER_KIND, normalizePartnerKindSlug } from './hubPartnerKinds';

/** Campos padrão (CNPJ, e-mail, telefone, endereço, nome) ficam fixos no cadastro; o template só define extras. */
export const FIELD_TYPES = [
  { value: 'text', label: 'Texto curto' },
  { value: 'textarea', label: 'Texto longo' },
  { value: 'number', label: 'Número' },
  { value: 'email', label: 'E-mail (extra)' },
  { value: 'tel', label: 'Telefone (extra)' },
  { value: 'url', label: 'URL / site' },
  { value: 'date', label: 'Data' },
  { value: 'select', label: 'Lista suspensa (dropdown)' },
  { value: 'radio', label: 'Múltipla escolha (uma opção)' },
  { value: 'multiselect', label: 'Múltipla escolha (várias opções)' },
  { value: 'checkbox', label: 'Sim / Não (único)' },
];

/** Tipos que usam lista de opções definida no template. */
export const FIELD_TYPES_WITH_OPTIONS = /** @type {const} */ (['select', 'radio', 'multiselect']);

/** Evita colisão com chaves reservadas do cadastro base. */
export function ensureExtraFieldKey(key) {
  let k = String(key || '').trim() || 'campo_extra';
  if (k === 'extras') k = 'extras_campo';
  return isReservedOrgFieldKey(k) ? `${k}_extra` : k;
}

/**
 * Gera `key` a partir do rótulo, garantindo unicidade no array (campo_2, campo_3…).
 * Não exige edição manual — o utilizador só define o rótulo.
 * @param {TemplateField[]} fields
 */
export function assignStableKeysFromLabels(fields) {
  const used = new Set();
  return fields.map((f) => {
    let base = ensureExtraFieldKey(slugKeyFromLabel(f.label));
    let k = base;
    let n = 2;
    while (used.has(k)) {
      k = ensureExtraFieldKey(`${base}_${n}`);
      n += 1;
    }
    used.add(k);
    return { ...f, key: k };
  });
}

/** Remove campos legados; filtra chaves que pertencem ao bloco fixo de empresa. */
export function normalizeTemplate(t) {
  if (!t || typeof t !== 'object') return t;
  const rest = { ...t };
  delete rest.targetOrgSlug;
  rest.partnerKind = normalizePartnerKindSlug(rest.partnerKind);
  rest.inviteLinkEnabled = rest.inviteLinkEnabled === false ? false : true;
  if (Array.isArray(rest.fields)) {
    const cleaned = rest.fields
      .filter((f) => f)
      .map((f) => (f.type === 'cnpj' ? { ...f, type: 'text', lookupCnpj: undefined } : f));
    rest.fields = assignStableKeysFromLabels(cleaned).map((f) => {
      if (!f || !Array.isArray(f.options)) return f;
      return { ...f, options: f.options.map((o) => String(o).trim()).filter(Boolean) };
    });
  }
  return rest;
}

export function slugKeyFromLabel(label) {
  return String(label || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64) || 'campo';
}

/**
 * Lista de templates do utilizador atual (admin).
 * @param {string | null | undefined} userId id Supabase auth.users
 */
export function loadTemplates(userId) {
  if (typeof window === 'undefined') return [];
  try {
    const key = templatesStorageKey(userId);
    let raw = window.localStorage.getItem(key);
    if (!raw && userId && key !== LS_KEY) {
      const legacy = window.localStorage.getItem(LS_KEY);
      if (legacy) {
        try {
          window.localStorage.setItem(key, legacy);
        } catch {
          /* ignore */
        }
        raw = legacy;
      }
    }
    const list = safeParse(raw, []);
    return list.map((t) => normalizeTemplate(t));
  } catch {
    return [];
  }
}

export function saveTemplates(/** @type {RegistrationFormTemplate[]} */ list, userId) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(templatesStorageKey(userId), JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

/** Agrega todas as chaves `hub_registration_form_templates_v1*` (convite público encontra o template). */
export function loadTemplatesMerged() {
  if (typeof window === 'undefined') return [];
  try {
    const byId = new Map();
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k || (k !== LS_KEY && !k.startsWith(`${LS_KEY}__`))) continue;
      const raw = window.localStorage.getItem(k);
      const list = safeParse(raw, []);
      for (const t of list) {
        const n = normalizeTemplate(t);
        if (n?.id) byId.set(n.id, n);
      }
    }
    return [...byId.values()];
  } catch {
    return [];
  }
}

export function createEmptyTemplate() {
  const now = new Date().toISOString();
  return {
    id: newId(),
    name: '',
    description: '',
    partnerKind: DEFAULT_HUB_PARTNER_KIND,
    inviteLinkEnabled: true,
    fields: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function inviteUrlForTemplate(templateId) {
  if (typeof window === 'undefined') return '';
  const u = new URL(window.location.origin + '/cadastro/organizacao');
  u.searchParams.set('tpl', templateId);
  return u.toString();
}

export function getTemplateById(id) {
  if (!id) return null;
  return loadTemplatesMerged().find((t) => t.id === id) ?? null;
}
