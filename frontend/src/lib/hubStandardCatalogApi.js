/**
 * Catálogo global de campos padrão (Supabase: hub_standard_field_section + hub_standard_field).
 * Etapas do wizard: hub_signup_wizard_step.
 * @see database/hub_standard_catalog.sql
 * @see database/hub_signup_wizard_step.sql
 */

/** @type {readonly { slug: string, label: string, partition_bucket: string, sort_order: number, is_active: boolean }[]} */
export const FALLBACK_SIGNUP_WIZARD_STEPS = Object.freeze([
  { slug: 'commercial', label: 'Comercial / informações gerais', partition_bucket: 'commercial', sort_order: 0, is_active: true },
  { slug: 'logistics', label: 'Logística e doca', partition_bucket: 'logistics', sort_order: 1, is_active: true },
]);

/**
 * @param {unknown} err
 */
export function isHubStandardCatalogUnavailable(err) {
  const m = String(/** @type {{ message?: string, code?: string }} */ (err)?.message || err || '').toLowerCase();
  const c = String(/** @type {{ code?: string }} */ (err)?.code || '');
  if (c === '42P01') return true;
  if (m.includes('does not exist') && m.includes('relation')) return true;
  if (m.includes('schema cache')) return true;
  return false;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
async function loadSignupWizardStepsOrFallback(supabase) {
  const { data, error } = await supabase
    .from('hub_signup_wizard_step')
    .select('id, slug, label, partition_bucket, sort_order, is_active')
    .order('sort_order', { ascending: true });
  if (error) {
    if (isHubStandardCatalogUnavailable(error)) return [...FALLBACK_SIGNUP_WIZARD_STEPS];
    throw error;
  }
  if (!data?.length) return [...FALLBACK_SIGNUP_WIZARD_STEPS];
  return data;
}

/**
 * Leitura para convite público ou admin (RLS aplica visibilidade).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
export async function fetchHubStandardCatalog(supabase) {
  const { data: sections, error: e1 } = await supabase
    .from('hub_standard_field_section')
    .select('id, slug, title, sort_order, wizard_step, is_active')
    .order('sort_order', { ascending: true });
  if (e1) {
    if (isHubStandardCatalogUnavailable(e1)) return null;
    throw e1;
  }
  const { data: fields, error: e2 } = await supabase
    .from('hub_standard_field')
    .select(
      'id, section_id, field_key, label, field_type, required, options, placeholder, rows, sort_order, is_active, extra'
    )
    .order('sort_order', { ascending: true });
  if (e2) {
    if (isHubStandardCatalogUnavailable(e2)) return null;
    throw e2;
  }
  let wizardSteps;
  try {
    wizardSteps = await loadSignupWizardStepsOrFallback(supabase);
  } catch (e3) {
    if (isHubStandardCatalogUnavailable(e3)) wizardSteps = [...FALLBACK_SIGNUP_WIZARD_STEPS];
    else throw e3;
  }
  return {
    sections: sections ?? [],
    fields: fields ?? [],
    wizardSteps: wizardSteps ?? [...FALLBACK_SIGNUP_WIZARD_STEPS],
  };
}

/**
 * Lista completa para /adm (inclui inativos) — requer sessão admin.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
export async function fetchHubStandardCatalogAdmin(supabase) {
  const { data: sections, error: e1 } = await supabase
    .from('hub_standard_field_section')
    .select('*')
    .order('sort_order', { ascending: true });
  if (e1) throw e1;
  const { data: fields, error: e2 } = await supabase
    .from('hub_standard_field')
    .select('*')
    .order('sort_order', { ascending: true });
  if (e2) throw e2;
  let wizardSteps;
  try {
    wizardSteps = await loadSignupWizardStepsOrFallback(supabase);
  } catch (e3) {
    if (isHubStandardCatalogUnavailable(e3)) wizardSteps = [...FALLBACK_SIGNUP_WIZARD_STEPS];
    else throw e3;
  }
  return {
    sections: sections ?? [],
    fields: fields ?? [],
    wizardSteps: wizardSteps ?? [...FALLBACK_SIGNUP_WIZARD_STEPS],
  };
}

/**
 * @param {{ sections: unknown[], fields: unknown[] } | null | undefined} catalog
 */
export function hubStandardCatalogHasData(catalog) {
  return Boolean(catalog && Array.isArray(catalog.fields) && catalog.fields.length > 0);
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {Record<string, unknown>} row
 */
export async function insertHubStandardSection(supabase, row) {
  const { data, error } = await supabase.from('hub_standard_field_section').insert(row).select('id').single();
  if (error) throw error;
  return data;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} id
 * @param {Record<string, unknown>} patch
 */
export async function updateHubStandardSection(supabase, id, patch) {
  const { error } = await supabase.from('hub_standard_field_section').update(patch).eq('id', id);
  if (error) throw error;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} id
 */
export async function deleteHubStandardSection(supabase, id) {
  const { error } = await supabase.from('hub_standard_field_section').delete().eq('id', id);
  if (error) throw error;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {Record<string, unknown>} row
 */
export async function insertHubStandardField(supabase, row) {
  const { data, error } = await supabase.from('hub_standard_field').insert(row).select('id').single();
  if (error) throw error;
  return data;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} id
 * @param {Record<string, unknown>} patch
 */
export async function updateHubStandardField(supabase, id, patch) {
  const { error } = await supabase.from('hub_standard_field').update(patch).eq('id', id);
  if (error) throw error;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} id
 */
export async function deleteHubStandardField(supabase, id) {
  const { error } = await supabase.from('hub_standard_field').delete().eq('id', id);
  if (error) throw error;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} sectionId
 */
export async function countFieldsInSection(supabase, sectionId) {
  const { count, error } = await supabase
    .from('hub_standard_field')
    .select('*', { count: 'exact', head: true })
    .eq('section_id', sectionId);
  if (error) throw error;
  return count ?? 0;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} wizardSlug
 */
export async function countSectionsUsingWizardSlug(supabase, wizardSlug) {
  const { count, error } = await supabase
    .from('hub_standard_field_section')
    .select('*', { count: 'exact', head: true })
    .eq('wizard_step', wizardSlug);
  if (error) throw error;
  return count ?? 0;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {Record<string, unknown>} row
 */
export async function insertSignupWizardStep(supabase, row) {
  const { data, error } = await supabase.from('hub_signup_wizard_step').insert(row).select('id').single();
  if (error) throw error;
  return data;
}

/**
 * Cria ou atualiza a etapa do wizard com o mesmo slug da seção (cadastro público).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {Record<string, unknown>} row — slug, label, partition_bucket, sort_order, is_active
 */
export async function upsertSignupWizardStep(supabase, row) {
  const { error } = await supabase.from('hub_signup_wizard_step').upsert(row, { onConflict: 'slug' });
  if (error) throw error;
}

/**
 * Remove metadados de wizard para um slug de seção (após apagar a seção).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} slug
 */
export async function deleteSignupWizardStepBySlug(supabase, slug) {
  const { error } = await supabase.from('hub_signup_wizard_step').delete().eq('slug', slug);
  if (error) throw error;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} id
 * @param {Record<string, unknown>} patch
 */
export async function updateSignupWizardStep(supabase, id, patch) {
  const { error } = await supabase.from('hub_signup_wizard_step').update(patch).eq('id', id);
  if (error) throw error;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} id
 */
export async function deleteSignupWizardStep(supabase, id) {
  const { error } = await supabase.from('hub_signup_wizard_step').delete().eq('id', id);
  if (error) throw error;
}
