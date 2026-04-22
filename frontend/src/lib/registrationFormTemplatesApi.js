import { normalizePartnerKindSlug, PRESTADORES_SERVICO_KIND } from './hubPartnerKinds';
import { normalizeSignupOptions } from '../schemas/partnerOrgSignup';
import {
  normalizeDisabledBuiltinGroups,
  normalizeTemplate,
  newFieldId,
} from './registrationFormTemplates';

/**
 * Schema em produção: `registration_form_template` com coluna `fields jsonb` (sem tabela filha, sem `slug`).
 * @see database/registration_form_template_rls_production.sql
 */
const SELECT_TEMPLATE_COLUMNS = [
  'id',
  'organization_id',
  'name',
  'description',
  'partner_kind',
  'invite_link_enabled',
  'fields',
  'standard_fields_disabled',
  'signup_settings',
  'created_at',
  'updated_at',
  'created_by_user_id',
];

const SELECT_TEMPLATE = SELECT_TEMPLATE_COLUMNS.join(', ');

const SELECT_TEMPLATE_WITHOUT_SIGNUP = SELECT_TEMPLATE_COLUMNS.filter((c) => c !== 'signup_settings').join(', ');

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
    return row;
  });
}

/**
 * @param {Record<string, unknown>} row
 * @returns {import('./registrationFormTemplates').RegistrationFormTemplate}
 */
export function mapRowToClientTemplate(row) {
  const fields = parseFieldsFromJsonb(row.fields);
  const kind = normalizePartnerKindSlug(row.partner_kind);
  const signupFallback =
    row.signup_settings == null && kind === PRESTADORES_SERVICO_KIND
      ? { cnpjRequired: false, collectCpf: true }
      : row.signup_settings;
  return normalizeTemplate({
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    partnerKind: row.partner_kind,
    inviteLinkEnabled: row.invite_link_enabled !== false,
    standardFieldsDisabled: parseStandardFieldsDisabled(row.standard_fields_disabled),
    signupSettings: signupFallback,
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
  const base = {
    id: t.id,
    organization_id: null,
    name: t.name?.trim() || 'Sem nome',
    description: t.description?.trim() ?? '',
    partner_kind: t.partnerKind,
    invite_link_enabled: t.inviteLinkEnabled !== false,
    fields: fieldsJson,
    standard_fields_disabled: Array.isArray(t.standardFieldsDisabled) ? t.standardFieldsDisabled : [],
    signup_settings: {
      cnpjRequired: su.cnpjRequired,
      collectCpf: su.collectCpf,
      disabledBuiltinGroups: dbg,
    },
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
export async function listHubRegistrationTemplates(supabase) {
  let { data, error } = await supabase
    .from('registration_form_template')
    .select(SELECT_TEMPLATE)
    .is('organization_id', null)
    .order('updated_at', { ascending: false });
  if (error && isMissingDbColumnError(error)) {
    ({ data, error } = await supabase
      .from('registration_form_template')
      .select(SELECT_TEMPLATE_WITHOUT_SIGNUP)
      .is('organization_id', null)
      .order('updated_at', { ascending: false }));
  }
  if (error) throw error;
  return (data || []).map((row) => mapRowToClientTemplate(row));
}

/**
 * Convite público ou utilizador: carrega template por id (RLS: convite ativo, ou autenticado e admin, etc.).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} id
 * @returns {Promise<import('./registrationFormTemplates').RegistrationFormTemplate | null>}
 */
export async function getRegistrationTemplateById(supabase, id) {
  if (!id) return null;
  let { data, error } = await supabase
    .from('registration_form_template')
    .select(SELECT_TEMPLATE)
    .eq('id', id)
    .maybeSingle();
  if (error && isMissingDbColumnError(error)) {
    ({ data, error } = await supabase
      .from('registration_form_template')
      .select(SELECT_TEMPLATE_WITHOUT_SIGNUP)
      .eq('id', id)
      .maybeSingle());
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
  const parent = templateToParentRow(t, userId, { isNew });
  const { error } = await supabase.from('registration_form_template').upsert(parent, { onConflict: 'id' });
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
