import { normalizeTemplate } from './registrationFormTemplates';

const SELECT_TEMPLATE_WITH_FIELDS = `
  id,
  organization_id,
  slug,
  name,
  description,
  partner_kind,
  invite_link_enabled,
  created_at,
  updated_at,
  created_by_user_id,
  registration_form_template_field (
    id,
    sort_order,
    field_key,
    label,
    field_type,
    required,
    options,
    lookup_cnpj
  )
`;

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
 * @param {Record<string, unknown>} row
 * @returns {import('./registrationFormTemplates').RegistrationFormTemplate}
 */
export function mapRowToClientTemplate(row) {
  const rawFields = row.registration_form_template_field ?? row.fields;
  const fieldRows = Array.isArray(rawFields) ? rawFields : [];
  const sorted = [...fieldRows].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const fields = sorted.map((f) => ({
    id: f.id,
    key: f.field_key,
    label: f.label,
    type: f.field_type,
    required: f.required === true,
    options: parseOptions(f.options),
    lookupCnpj: f.lookup_cnpj === true,
  }));
  return normalizeTemplate({
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    partnerKind: row.partner_kind,
    inviteLinkEnabled: row.invite_link_enabled !== false,
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
  const base = {
    id: t.id,
    organization_id: null,
    name: t.name?.trim() || 'Sem nome',
    description: t.description?.trim() ?? '',
    partner_kind: t.partnerKind,
    invite_link_enabled: t.inviteLinkEnabled !== false,
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
 * @param {import('./registrationFormTemplates').RegistrationFormTemplate} t
 * @returns {Record<string, unknown>[]}
 */
function templateFieldsToRows(t) {
  return (t.fields || []).map((f, i) => ({
    template_id: t.id,
    sort_order: i,
    field_key: f.key,
    label: f.label,
    field_type: f.type,
    required: f.required === true,
    options: Array.isArray(f.options) ? f.options : [],
    lookup_cnpj: f.lookupCnpj === true ? true : null,
  }));
}

/**
 * Lista modelos de plataforma (organization_id nulo) — requer sessão e admin HUB.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @returns {Promise<import('./registrationFormTemplates').RegistrationFormTemplate[]>}
 */
export async function listHubRegistrationTemplates(supabase) {
  const { data, error } = await supabase
    .from('registration_form_template')
    .select(SELECT_TEMPLATE_WITH_FIELDS)
    .is('organization_id', null)
    .order('updated_at', { ascending: false });
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
  const { data, error } = await supabase
    .from('registration_form_template')
    .select(SELECT_TEMPLATE_WITH_FIELDS)
    .eq('id', id)
    .maybeSingle();
  if (error) {
    if (String(error?.code) === 'PGRST116' || error?.message?.includes('0 rows')) return null;
    throw error;
  }
  if (!data) return null;
  return mapRowToClientTemplate(data);
}

/**
 * Cria ou atualiza template e substitui campos extra.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {import('./registrationFormTemplates').RegistrationFormTemplate} template
 * @param {string} userId
 * @param {boolean} isNew
 */
export async function upsertRegistrationTemplate(supabase, template, userId, isNew) {
  const t = normalizeTemplate({ ...template });
  const parent = templateToParentRow(t, userId, { isNew });

  const { error: e1 } = await supabase.from('registration_form_template').upsert(parent, { onConflict: 'id' });
  if (e1) throw e1;

  const { error: e2 } = await supabase
    .from('registration_form_template_field')
    .delete()
    .eq('template_id', t.id);
  if (e2) throw e2;

  const fieldRows = templateFieldsToRows(t);
  if (fieldRows.length) {
    const { error: e3 } = await supabase.from('registration_form_template_field').insert(fieldRows);
    if (e3) throw e3;
  }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} id
 */
export async function deleteRegistrationTemplate(supabase, id) {
  const { error } = await supabase.from('registration_form_template').delete().eq('id', id);
  if (error) throw error;
}
