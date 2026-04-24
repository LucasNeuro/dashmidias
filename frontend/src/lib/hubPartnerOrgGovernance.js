/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
export async function fetchModulosCatalogoGovernanca(supabase) {
  const { data, error } = await supabase
    .from('modulos_catalogo')
    .select('id, nome, descricao')
    .order('nome', { ascending: true });
  if (error) throw error;
  return data || [];
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ signupId: string, moduloSlugs: string[], tipoOrganizacao?: string | null }} p
 */
export async function rpcApprovePartnerOrgSignup(supabase, p) {
  const { data, error } = await supabase.rpc('hub_approve_partner_org_signup', {
    p_signup_id: p.signupId,
    p_modulo_slugs: p.moduloSlugs.length ? p.moduloSlugs : [],
    p_tipo_organizacao: p.tipoOrganizacao ?? null,
  });
  if (error) return { ok: false, error: error.message, raw: null };
  return { ok: true, raw: data };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} token
 */
export async function rpcPreviewOrgInvite(supabase, token) {
  const { data, error } = await supabase.rpc('hub_preview_org_invite', { p_token: token });
  if (error) return { ok: false, error: error.message, raw: null };
  return { ok: true, raw: data };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} token
 */
export async function rpcClaimOrgInvite(supabase, token) {
  const { data, error } = await supabase.rpc('hub_claim_org_invite', { p_token: token });
  if (error) return { ok: false, error: error.message, raw: null };
  return { ok: true, raw: data };
}
