import { normalizePartnerKindSlug, PRESTADORES_SERVICO_KIND } from './hubPartnerKinds';
import { normalizeSignupOptions } from '../schemas/partnerOrgSignup';
import {
  normalizeDisabledBuiltinGroups,
  normalizeTemplate,
  newFieldId,
} from './registrationFormTemplates';

/**
 * Schema em produção: `registration_form_template` com `fields jsonb` e opcional `invite_slug` (convite público).
 * @see database/registration_form_template_rls_production.sql
 */
const SELECT_TEMPLATE_COLUMNS = [
  'id',
  'organization_id',
  'name',
  'description',
  'partner_kind',
  'template_purpose',
  'invite_link_enabled',
  'invite_slug',
  'fields',
  'standard_fields_disabled',
  'signup_settings',
  'created_at',
  'updated_at',
  'created_by_user_id',
];

const SELECT_TEMPLATE = SELECT_TEMPLATE_COLUMNS.join(', ');

const SELECT_TEMPLATE_WITHOUT_INVITE_SLUG = SELECT_TEMPLATE_COLUMNS.filter((c) => c !== 'invite_slug').join(', ');

const SELECT_TEMPLATE_WITHOUT_SIGNUP = SELECT_TEMPLATE_COLUMNS.filter((c) => c !== 'signup_settings').join(', ');

const SELECT_TEMPLATE_MINIMAL = SELECT_TEMPLATE_COLUMNS.filter(
  (c) => c !== 'signup_settings' && c !== 'invite_slug'
).join(', ');

/** @param {string} s */
function isUuidParam(s) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(s || '').trim());
}

/**
 * PostgREST quando a coluna ainda não foi migrada — evita quebrar listagens públicas/admin.
 * @param {unknown} err
 * @param {string} [columnName]
 */
function isMissingDbColumnError(err, columnName = 'signup_settings') {
  const m = String(/** @type {{ message?: string }} */ (err)?.message || err || '');
  const low = m.toLowerCase();
  const col = columnName.toLowerCase();
  if (!low.includes(col)) return false;
  if (low.includes('does not exist') && low.includes('column')) return true;
  if (low.includes('could not find') && low.includes('column')) return true;
  if (low.includes('schema cache') && low.includes(col)) return true;
  return false;
}

/**
 * @param {unknown} raw
 * @returns {string[]}
 */
function parseStandardFieldsDisabled(raw) {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw.map((k) => String(k).trim()).filter(Boolean);
  if (typeof raw === 'string') {
    try {
      const j = JSON.parse(raw);
      return Array.isArray(j) ? j.map((k) => String(k).trim()).filter(Boolean) : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * @param {unknown} raw
 * @returns {string[]}
 */
function parseOptions(raw) {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw.map((o) => String(o));
  if (typeof raw === 'string') {
    try {
      const j = JSON.parse(raw);
      return Array.isArray(j) ? j.map((o) => String(o)) : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * @param {unknown} raw — jsonb ou JSON já parseado
 * @returns {import('./registrationFormTemplates').TemplateField[]}
 */
function parseFieldsFromJsonb(raw) {
  let arr = raw;
  if (typeof raw === 'string') {
    try {
      arr = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(arr)) return [];
  return arr
    .map((f, i) => {
      if (!f || typeof f !== 'object') return null;
      const key = f.key ?? f.field_key;
      const label = f.label != null ? String(f.label) : '';
      if (!String(key || '').trim() && !label.trim()) return null;
      const type = f.type ?? f.field_type ?? 'text';
      return {
        id: f.id != null && String(f.id) ? String(f.id) : newFieldId(),
        key: String(key || '').trim() || `campo_${i}`,
        label,
        type: String(type),
        required: f.required === true,
        options: parseOptions(f.options),
        lookupCnpj: f.lookupCnpj === true || f.lookup_cnpj === true,
        inactive: f.inactive === true,
      };
    })
    .filter(Boolean);
}

/**
 * @param {import('./registrationFormTemplates').RegistrationFormTemplate} t
 */
function templateFieldsToJsonb(t) {
  return (t.fields || []).map((f) => {
    const row = {
      id: f.id,
      key: f.key,
      label: f.label,
      type: f.type,
      required: f.required === true,
      options: Array.isArray(f.options) ? f.options.map((o) => String(o)) : [],
    };
    if (f.lookupCnpj === true) row.lookupCnpj = true;
    if (f.inactive === true) row.inactive = true;
    return row;
  });
}

/**
 * @param {unknown} raw
 * @returns {Record<string, unknown> | null}
 */
function parseSignupSettingsObject(raw) {
  if (raw == null) return null;
  let o = raw;
  if (typeof raw === 'string') {
    try {
      o = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (typeof o !== 'object' || o === null || Array.isArray(o)) return null;
  return /** @type {Record<string, unknown>} */ (o);
}

/**
 * Garante `disabledBuiltinGroups` no blob para `normalizeTemplate` (PostgREST / cópias antigas em snake_case).
 * @param {Record<string, unknown>} su
 */
function normalizeSignupSettingsKeys(su) {
  const o = { ...su };
  const snake = o.disabled_builtin_groups;
  const camel = o.disabledBuiltinGroups;
  if (Array.isArray(snake) && camel == null) o.disabledBuiltinGroups = snake;
  delete o.disabled_builtin_groups;
  return o;
}

/**
 * @param {Record<string, unknown>} row
 * @returns {import('./registrationFormTemplates').RegistrationFormTemplate}
 */
export function mapRowToClientTemplate(row) {
  const fields = parseFieldsFromJsonb(row.fields);
  const kind = normalizePartnerKindSlug(row.partner_kind);
  const suParsed = parseSignupSettingsObject(row.signup_settings);
  let signupSettings = suParsed != null ? normalizeSignupSettingsKeys(suParsed) : null;
  if (signupSettings == null && kind === PRESTADORES_SERVICO_KIND) {
    signupSettings = { cnpjRequired: false, collectCpf: true };
  }
  if (signupSettings == null) {
    signupSettings = { cnpjRequired: true, collectCpf: false };
  }
  const templatePurpose =
    row.template_purpose === 'lead_capture' ? 'lead_capture' : 'partner_homologacao';
  return normalizeTemplate({
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    partnerKind: row.partner_kind,
    templatePurpose,
    inviteLinkEnabled: row.invite_link_enabled !== false,
    inviteSlug: row.invite_slug != null && String(row.invite_slug).trim() ? String(row.invite_slug).trim() : '',
    standardFieldsDisabled: parseStandardFieldsDisabled(row.standard_fields_disabled),
    signupSettings,
    fields,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

/**
 * @param {import('./registrationFormTemplates').RegistrationFormTemplate} t
 * @param {string} userId
 * @param {{ isNew: boolean }} o
 * @returns {Record<string, unknown>}
 */
function templateToParentRow(t, userId, o) {
  const now = new Date().toISOString();
  const fieldsJson = templateFieldsToJsonb(t);
  const su = normalizeSignupOptions(t.signupSettings);
  const dbg = normalizeDisabledBuiltinGroups(t.disabledBuiltinGroups, t.partnerKind);
  const purpose = t.templatePurpose === 'lead_capture' ? 'lead_capture' : 'partner_homologacao';
  /** @type {Record<string, unknown>} */
  const signupBlob = {
    cnpjRequired: su.cnpjRequired,
    collectCpf: su.collectCpf,
    disabledBuiltinGroups: dbg,
  };
  if (purpose === 'lead_capture' || su.leadSegmentSlug) {
    signupBlob.leadSegmentSlug = su.leadSegmentSlug || '';
  }
  const base = {
    id: t.id,
    organization_id: null,
    name: t.name?.trim() || 'Sem nome',
    description: t.description?.trim() ?? '',
    partner_kind: t.partnerKind,
    template_purpose: purpose,
    invite_link_enabled: t.inviteLinkEnabled !== false,
    invite_slug:
      typeof t.inviteSlug === 'string' && t.inviteSlug.trim()
        ? t.inviteSlug.trim().toLowerCase()
        : null,
    fields: fieldsJson,
    standard_fields_disabled: Array.isArray(t.standardFieldsDisabled) ? t.standardFieldsDisabled : [],
    signup_settings: signupBlob,
    updated_at: now,
  };
  if (o.isNew) {
    return {
      ...base,
      created_at: t.createdAt || now,
      created_by_user_id: userId,
    };
  }
  return base;
}

/**
 * Lista modelos de plataforma (organization_id nulo) — requer sessão e admin HUB.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @returns {Promise<import('./registrationFormTemplates').RegistrationFormTemplate[]>}
 */
/**
 * Convite público ativo para um `partner_kind` (modelo HUB). Usado no pré-cadastro quando o fluxo não tem etapas de formulário.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} partnerKindRaw
 */
export async function fetchPublicInviteTemplateByPartnerKind(supabase, partnerKindRaw) {
  const kind = normalizePartnerKindSlug(partnerKindRaw);
  if (!kind) return null;
  let q = supabase
    .from('registration_form_template')
    .select('id, invite_slug, invite_link_enabled, partner_kind')
    .eq('invite_link_enabled', true)
    .is('organization_id', null)
    .eq('partner_kind', kind)
    .neq('template_purpose', 'lead_capture')
    .order('updated_at', { ascending: false })
    .limit(1);
  let { data, error } = await q;
  if (error && isMissingDbColumnError(error, 'template_purpose')) {
    ({ data, error } = await supabase
      .from('registration_form_template')
      .select('id, invite_slug, invite_link_enabled, partner_kind')
      .eq('invite_link_enabled', true)
      .is('organization_id', null)
      .eq('partner_kind', kind)
      .order('updated_at', { ascending: false })
      .limit(1));
  }
  if (error) throw error;
  const row = Array.isArray(data) && data[0] ? data[0] : null;
  return row;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ purpose?: 'partner_homologacao' | 'lead_capture' }} [opts]
 */
export async function listHubRegistrationTemplates(supabase, opts = {}) {
  const purpose = opts.purpose;

  async function runList(/** @type {string} */ sel) {
    let q = supabase.from('registration_form_template').select(sel).is('organization_id', null);
    if (purpose === 'lead_capture') {
      q = q.eq('template_purpose', 'lead_capture');
    } else if (purpose === 'partner_homologacao') {
      q = q.or('template_purpose.eq.partner_homologacao,template_purpose.is.null');
    }
    return q.order('updated_at', { ascending: false });
  }

  let sel = SELECT_TEMPLATE;
  let { data, error } = await runList(sel);
  if (error && isMissingDbColumnError(error, 'invite_slug')) {
    sel = SELECT_TEMPLATE_WITHOUT_INVITE_SLUG;
    ({ data, error } = await runList(sel));
  }
  if (error && isMissingDbColumnError(error, 'signup_settings')) {
    sel = sel === SELECT_TEMPLATE ? SELECT_TEMPLATE_WITHOUT_SIGNUP : SELECT_TEMPLATE_MINIMAL;
    ({ data, error } = await runList(sel));
  }
  if (error && isMissingDbColumnError(error, 'template_purpose')) {
    const selNoPurpose = sel
      .split(', ')
      .filter((c) => c.trim() !== 'template_purpose')
      .join(', ');
    ({ data, error } = await supabase
      .from('registration_form_template')
      .select(selNoPurpose)
      .is('organization_id', null)
      .order('updated_at', { ascending: false }));
    if (!error && purpose === 'lead_capture') {
      data = [];
    }
  }
  if (error) throw error;
  return (data || []).map((row) => mapRowToClientTemplate(row));
}

/**
 * Convite público ou usuário: carrega template por id (RLS: convite ativo, ou autenticado e admin, etc.).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} id
 * @returns {Promise<import('./registrationFormTemplates').RegistrationFormTemplate | null>}
 */
export async function getRegistrationTemplateById(supabase, idOrSlug) {
  if (!idOrSlug) return null;
  const raw = String(idOrSlug).trim();
  if (!raw) return null;
  const byId = isUuidParam(raw);

  async function runMaybeSingle(/** @type {string} */ selectList) {
    let q = supabase.from('registration_form_template').select(selectList);
    q = byId ? q.eq('id', raw) : q.eq('invite_slug', raw.toLowerCase());
    return q.maybeSingle();
  }

  let sel = SELECT_TEMPLATE;
  let { data, error } = await runMaybeSingle(sel);
  if (error && isMissingDbColumnError(error, 'invite_slug')) {
    if (!byId) return null;
    sel = SELECT_TEMPLATE_WITHOUT_INVITE_SLUG;
    ({ data, error } = await runMaybeSingle(sel));
  }
  if (error && isMissingDbColumnError(error, 'signup_settings')) {
    sel = sel === SELECT_TEMPLATE ? SELECT_TEMPLATE_WITHOUT_SIGNUP : SELECT_TEMPLATE_MINIMAL;
    ({ data, error } = await runMaybeSingle(sel));
  }
  if (error) {
    if (String(error?.code) === 'PGRST116' || error?.message?.includes('0 rows')) return null;
    throw error;
  }
  if (!data) return null;
  return mapRowToClientTemplate(data);
}

/**
 * Cria ou atualiza template (campos extra em `fields` jsonb).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {import('./registrationFormTemplates').RegistrationFormTemplate} template
 * @param {string} userId
 * @param {boolean} isNew
 */
export async function upsertRegistrationTemplate(supabase, template, userId, isNew) {
  const t = normalizeTemplate({ ...template });
  let parent = templateToParentRow(t, userId, { isNew });
  let { error } = await supabase.from('registration_form_template').upsert(parent, { onConflict: 'id' });
  if (error && isMissingDbColumnError(error, 'invite_slug')) {
    const { invite_slug: _drop, ...rest } = parent;
    parent = rest;
    ({ error } = await supabase.from('registration_form_template').upsert(parent, { onConflict: 'id' }));
  }
  if (error && isMissingDbColumnError(error, 'template_purpose')) {
    const { template_purpose: _tp, ...rest } = parent;
    parent = rest;
    ({ error } = await supabase.from('registration_form_template').upsert(parent, { onConflict: 'id' }));
  }
  if (error) throw error;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} id
 */
export async function deleteRegistrationTemplate(supabase, id) {
  const { error } = await supabase.from('registration_form_template').delete().eq('id', id);
  if (error) throw error;
}
