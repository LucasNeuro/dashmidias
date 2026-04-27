/**
 * Fluxos mestres de cadastro (hub_registration_master_flow + steps).
 */

/**
 * Mensagem legível para erros de gravação Supabase (RLS, duplicado, FK).
 * @param {unknown} err
 */
export function friendlyRegistrationFlowError(err) {
  const msg = String(/** @type {{ message?: string }} */ (err)?.message ?? err ?? '');
  const code = String(/** @type {{ code?: string }} */ (err)?.code ?? '');
  const low = msg.toLowerCase();
  if (code === '42501' || low.includes('permission denied') || low.includes('row-level security')) {
    return 'Sem permissão para esta operação. Confirme que a sua conta é administrador HUB neste projeto.';
  }
  if (code === '23505' || low.includes('duplicate key') || low.includes('unique constraint')) {
    return 'Já existe um registo com este identificador. Se for o slug do fluxo, use outro (só letras minúsculas, números e hífens).';
  }
  if (code === '23503' || low.includes('foreign key')) {
    return 'Não foi possível concluir porque há dados ligados. Atualize a página ou peça apoio à equipa.';
  }
  if (low.includes('violates check constraint') && low.includes('slug')) {
    return 'O identificador do fluxo (slug) só pode ter letras minúsculas, números e hífens, sem espaços.';
  }
  return msg.trim() || 'Operação não concluída. Tente outra vez.';
}

/** PostgREST / Postgres: colunas step_kind ou branch_config ainda não migradas. */
function isMissingBranchStepColumnsError(error) {
  if (!error) return false;
  const msg = String(error.message ?? error.details ?? '').toLowerCase();
  const code = String(error.code ?? '');
  if (code === '42703') return true;
  if (msg.includes('does not exist') && msg.includes('column')) return true;
  if (msg.includes('column') && (msg.includes('step_kind') || msg.includes('branch_config'))) return true;
  return false;
}

/**
 * Fluxo público ativo + etapas + metadados mínimos do template (evita embed RLS).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} flowSlug
 * @returns {Promise<null | {
 *   flow: { id: string, slug: string, name: string, description: string },
 *   steps: Array<{
 *     id: string,
 *     sort_order: number,
 *     template_id: string,
 *     entry_condition: unknown,
 *     step_kind?: string,
 *     branch_config?: unknown,
 *     template: null | { id: string, name: string, invite_slug: string | null, invite_link_enabled: boolean | null }
 *   }>
 * }>}
 */
export async function fetchPublicMasterFlowWithSteps(supabase, flowSlug) {
  const slug = String(flowSlug || '').trim();
  if (!slug) return null;

  const { data: flow, error: e1 } = await supabase
    .from('hub_registration_master_flow')
    .select('id, slug, name, description, is_active, invite_link_enabled')
    .eq('slug', slug)
    .eq('is_active', true)
    .eq('invite_link_enabled', true)
    .maybeSingle();

  if (e1) throw e1;
  if (!flow) return null;

  const selectStepsFull =
    'id, sort_order, template_id, entry_condition, step_kind, branch_config';
  const selectStepsLegacy = 'id, sort_order, template_id, entry_condition';

  let list = [];
  {
    const { data: steps, error: e2 } = await supabase
      .from('hub_registration_master_flow_step')
      .select(selectStepsFull)
      .eq('master_flow_id', flow.id)
      .order('sort_order', { ascending: true });

    if (e2 && isMissingBranchStepColumnsError(e2)) {
      const { data: steps2, error: e2b } = await supabase
        .from('hub_registration_master_flow_step')
        .select(selectStepsLegacy)
        .eq('master_flow_id', flow.id)
        .order('sort_order', { ascending: true });
      if (e2b) throw e2b;
      list = (steps2 || []).map((s) => ({ ...s, step_kind: 'template', branch_config: null }));
    } else if (e2) {
      throw e2;
    } else {
      list = steps || [];
    }
  }
  const templateIds = [...new Set(list.map((s) => s.template_id).filter(Boolean))];

  if (templateIds.length === 0) {
    return { flow, steps: list.map((s) => ({ ...s, template: null })) };
  }

  const { data: templates, error: e3 } = await supabase
    .from('registration_form_template')
    .select('id, name, invite_slug, invite_link_enabled')
    .in('id', templateIds);

  if (e3) throw e3;
  const byId = Object.fromEntries((templates || []).map((t) => [t.id, t]));

  const enriched = list.map((s) => ({
    ...s,
    template: byId[s.template_id] ?? null,
  }));

  return { flow, steps: enriched };
}

/**
 * Lista todos os fluxos (admin HUB) com contagem de etapas num único round-trip (embed PostgREST).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @returns {Promise<Array<Record<string, unknown> & { step_count: number }>>}
 */
export async function listMasterFlowsAdmin(supabase) {
  const { data, error } = await supabase
    .from('hub_registration_master_flow')
    .select(
      `id, name, slug, description, is_active, invite_link_enabled, created_at, updated_at,
       hub_registration_master_flow_step(count)`
    )
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((row) => {
    const nested = row.hub_registration_master_flow_step;
    let step_count = 0;
    if (Array.isArray(nested) && nested[0] != null) {
      const c = nested[0].count;
      step_count = typeof c === 'number' ? c : Number(c) || 0;
    } else if (nested && typeof nested === 'object' && !Array.isArray(nested) && nested.count != null) {
      const c = nested.count;
      step_count = typeof c === 'number' ? c : Number(c) || 0;
    }
    const { hub_registration_master_flow_step: _drop, ...rest } = row;
    return { ...rest, step_count };
  });
}

/**
 * Etapas de um fluxo (admin).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} masterFlowId
 */
export async function listMasterFlowStepsAdmin(supabase, masterFlowId) {
  const id = String(masterFlowId ?? '').trim();
  if (!id) return [];

  const selectFull =
    'id, master_flow_id, template_id, sort_order, entry_condition, step_kind, branch_config, created_at, updated_at';
  const selectLegacy =
    'id, master_flow_id, template_id, sort_order, entry_condition, created_at, updated_at';

  const { data, error } = await supabase
    .from('hub_registration_master_flow_step')
    .select(selectFull)
    .eq('master_flow_id', id)
    .order('sort_order', { ascending: true });

  if (error && isMissingBranchStepColumnsError(error)) {
    const { data: legacyRows, error: e2 } = await supabase
      .from('hub_registration_master_flow_step')
      .select(selectLegacy)
      .eq('master_flow_id', id)
      .order('sort_order', { ascending: true });
    if (e2) throw e2;
    return (legacyRows || []).map((row) => ({
      ...row,
      step_kind: 'template',
      branch_config: null,
    }));
  }
  if (error) throw error;
  return data || [];
}
