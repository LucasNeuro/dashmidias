/**
 * RPCs públicas de homologação de parceiros (anon): submissão e estado do pedido.
 */

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{
 *   email: string,
 *   cnpj: string,
 *   dadosFormulario: Record<string, unknown>,
 *   cnpjaSnapshot?: unknown,
 *   consultaFonte?: string | null,
 *   templateId?: string | null,
 *   partnerKind?: string | null,
 * }} p
 * @returns {Promise<{ ok: boolean, signupId?: string, codigoRastreio?: string, error?: string }>}
 */
export async function rpcSubmitPartnerOrgSignup(supabase, p) {
  const { data, error } = await supabase.rpc('hub_submit_partner_org_signup', {
    p_email: p.email,
    p_cnpj: p.cnpj,
    p_dados_formulario: p.dadosFormulario,
    p_cnpja_snapshot: p.cnpjaSnapshot ?? null,
    p_consulta_fonte: p.consultaFonte ?? null,
    p_template_id: p.templateId ?? null,
    p_partner_kind: p.partnerKind ?? null,
  });

  if (error) {
    return { ok: false, error: error.message || 'Não foi possível registar o pedido.' };
  }

  const payload = data && typeof data === 'object' ? data : null;
  if (!payload || payload.ok !== true) {
    return {
      ok: false,
      error: mapHubSubmitError(payload?.error, payload?.detail),
    };
  }

  return {
    ok: true,
    signupId: payload.signup_id != null ? String(payload.signup_id) : undefined,
    codigoRastreio: payload.codigo_rastreio != null ? String(payload.codigo_rastreio) : undefined,
  };
}

function mapHubSubmitError(code, detail) {
  switch (code) {
    case 'email_invalid':
      return 'E-mail inválido.';
    case 'document_required':
      return 'Documento (CNPJ ou CPF) é obrigatório.';
    case 'dados_required':
      return 'Dados do formulário em falta.';
    case 'duplicate_codigo':
      return 'Conflito ao gerar código de rastreio. Tente novamente.';
    case 'sql_error':
      return detail ? `Erro ao guardar: ${detail}` : 'Erro ao guardar o pedido.';
    default:
      return 'Não foi possível registar o pedido.';
  }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} ref — codigo_rastreio (ORG-…) ou UUID do pedido
 * @returns {Promise<{ ok: boolean, row?: object, error?: string }>}
 */
export async function rpcPublicHomologacaoStatus(supabase, ref) {
  const { data, error } = await supabase.rpc('hub_public_homologacao_status', {
    p_ref: ref,
  });

  if (error) {
    return { ok: false, error: error.message || 'Não foi possível carregar o estado.' };
  }

  const payload = data && typeof data === 'object' ? data : null;
  if (!payload || payload.ok !== true) {
    if (payload?.error === 'ref_required') {
      return { ok: false, error: 'Indique o código ou identificador do pedido.' };
    }
    if (payload?.error === 'not_found') {
      return { ok: false, error: 'Pedido não encontrado. Confira o código.' };
    }
    return { ok: false, error: 'Não foi possível carregar o estado.' };
  }

  return { ok: true, row: payload };
}
