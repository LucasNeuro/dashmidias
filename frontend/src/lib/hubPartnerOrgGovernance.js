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

/**
 * Resposta da equipe HUB no chat de homologação (sessão admin).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} signupId — UUID do pedido em hub_partner_org_signups
 * @param {string} corpo
 * @param {Array<Record<string, unknown>>} [anexos]
 */
/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} signupId
 * @param {'pendente'|'aguardando_retorno'|'em_analise'|'aprovado'} etapa
 */
export async function rpcHubAdminSetSignupWorkflowEtapa(supabase, signupId, etapa) {
  const { data, error } = await supabase.rpc('hub_admin_set_signup_workflow_etapa', {
    p_signup_id: signupId,
    p_etapa: etapa,
  });
  if (error) return { ok: false, error: error.message };
  const raw = data && typeof data === 'object' ? data : {};
  if (raw.ok === false) {
    return {
      ok: false,
      error: [raw.error, raw.detail].filter(Boolean).join(': ') || 'Falha ao atualizar etapa',
    };
  }
  return { ok: true, raw: data };
}

export async function rpcHubHomologacaoReply(supabase, signupId, corpo, anexos = []) {
  const list = Array.isArray(anexos) ? anexos : [];
  const { data, error } = await supabase.rpc('hub_homologacao_hub_reply', {
    p_signup_id: signupId,
    p_corpo: corpo ?? '',
    p_anexos: list,
  });
  if (error) return { ok: false, error: error.message, raw: null };
  const raw = data && typeof data === 'object' ? data : {};
  if (raw.ok === false) {
    return {
      ok: false,
      error: [raw.error, raw.detail].filter(Boolean).join(': ') || 'Falha ao enviar',
      raw,
    };
  }
  return { ok: true, raw: data };
}
