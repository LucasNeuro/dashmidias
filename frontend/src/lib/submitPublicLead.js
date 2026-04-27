/**
 * RPC pública hub_submit_public_lead.
 */

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{
 *   segmentSlug: string,
 *   nome: string,
 *   email: string,
 *   telefone?: string | null,
 *   cpf?: string | null,
 *   dadosFormulario?: Record<string, unknown>,
 *   templateId?: string | null,
 *   flowSlug?: string | null,
 * }} p
 * @returns {Promise<{ ok: boolean, leadId?: string, error?: string }>}
 */
export async function rpcSubmitPublicLead(supabase, p) {
  const { data, error } = await supabase.rpc('hub_submit_public_lead', {
    p_segment_slug: p.segmentSlug,
    p_nome: p.nome,
    p_email: p.email,
    p_telefone: p.telefone ?? null,
    p_cpf: p.cpf ?? null,
    p_dados_formulario: p.dadosFormulario ?? {},
    p_template_id: p.templateId ?? null,
    p_flow_slug: p.flowSlug ?? null,
  });

  if (error) {
    return { ok: false, error: error.message || 'Não foi possível enviar o pedido.' };
  }

  const payload = data && typeof data === 'object' ? data : null;
  if (!payload || payload.ok !== true) {
    return {
      ok: false,
      error: mapLeadSubmitError(payload?.error),
    };
  }

  return {
    ok: true,
    leadId: payload.lead_id != null ? String(payload.lead_id) : undefined,
  };
}

/** @param {unknown} code */
function mapLeadSubmitError(code) {
  switch (code) {
    case 'segment_required':
      return 'Selecione o tipo de pedido.';
    case 'invalid_segment':
      return 'Segmento inválido ou inativo.';
    case 'nome_invalid':
      return 'Indique o nome completo.';
    case 'email_invalid':
      return 'E-mail inválido.';
    case 'cpf_invalid':
      return 'CPF inválido (11 dígitos).';
    case 'dados_required':
      return 'Dados do formulário em falta.';
    default:
      return 'Não foi possível enviar o pedido.';
  }
}
