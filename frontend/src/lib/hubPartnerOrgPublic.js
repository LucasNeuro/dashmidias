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
    case 'duplicate_pending_signup':
      return 'Já existe um pedido pendente com este CNPJ/CPF. Aguarde análise ou utilize o código ORG recebido.';
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

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} ref
 * @param {number} [limit]
 * @returns {Promise<{ ok: boolean, messages?: Array<{ id: string, direcao: string, corpo: string, criado_em: string, anexos: Array<Record<string, unknown>> }>, error?: string }>}
 */
export async function rpcPublicHomologacaoListMessages(supabase, ref, limit = 200) {
  const { data, error } = await supabase.rpc('hub_public_homologacao_list_messages', {
    p_ref: ref,
    p_limit: limit,
  });

  if (error) {
    return { ok: false, error: error.message || 'Não foi possível carregar o chat.' };
  }

  const payload = data && typeof data === 'object' ? data : null;
  if (!payload || payload.ok !== true) {
    if (payload?.error === 'ref_required') {
      return { ok: false, error: 'Referência em falta.' };
    }
    if (payload?.error === 'not_found') {
      return { ok: false, error: 'Pedido não encontrado.' };
    }
    return { ok: false, error: 'Não foi possível carregar o chat.' };
  }

  const raw = payload.messages;
  const messages = normalizeHomologacaoMessages(raw);
  return { ok: true, messages };
}

/** Normaliza chaves vindas do JSON (PostgREST / clientes podem variar) e `direcao`. */
function normalizeHomologacaoMessages(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x) => {
      if (!x || typeof x !== 'object') return null;
      const id = x.id ?? x.Id;
      const corpo = x.corpo ?? x.Corpo ?? x.body ?? '';
      const criado_em = x.criado_em ?? x.criadoEm ?? x.created_at;
      const direcaoRaw = x.direcao ?? x.Direcao ?? x.direction ?? x.role ?? '';
      const direcao = String(direcaoRaw).trim().toLowerCase();
      const anexos = normalizeHomologacaoAnexos(x.anexos ?? x.Anexos);
      if (!id && !String(corpo).trim() && anexos.length === 0) return null;
      return {
        id: id != null ? String(id) : '',
        direcao: direcao === 'hub' ? 'hub' : 'parceiro',
        corpo: String(corpo),
        criado_em,
        anexos,
      };
    })
    .filter(Boolean);
}

/** @param {unknown} raw */
function normalizeHomologacaoAnexos(raw) {
  if (raw == null) return [];
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
    .map((a) => {
      if (!a || typeof a !== 'object') return null;
      const id = a.id ?? a.Id;
      const nome = a.nome_original ?? a.nomeOriginal ?? a.name ?? a.nome ?? '';
      const mime = a.mime_type ?? a.mimeType ?? a.mime ?? '';
      const storage_path = a.storage_path ?? a.storagePath ?? a.path ?? '';
      const tamanho = a.tamanho_bytes ?? a.tamanhoBytes ?? a.size;
      if (!storage_path && !nome) return null;
      return {
        id: id != null ? String(id) : '',
        nome_original: String(nome || 'documento'),
        mime_type: String(mime || ''),
        storage_path: String(storage_path || ''),
        tamanho_bytes: typeof tamanho === 'number' ? tamanho : tamanho != null ? Number(tamanho) : null,
      };
    })
    .filter(Boolean);
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} ref
 * @param {string} corpo
 * @param {Array<Record<string, unknown>>} [anexos] — itens com path, nome_original, mime_type, tamanho_bytes
 */
export async function rpcPublicHomologacaoSendMessage(supabase, ref, corpo, anexos = []) {
  const list = Array.isArray(anexos) ? anexos : [];
  const { data, error } = await supabase.rpc('hub_public_homologacao_send_message', {
    p_ref: ref,
    p_corpo: corpo ?? '',
    p_anexos: list,
  });

  if (error) {
    return { ok: false, error: error.message || 'Não foi possível enviar.' };
  }

  const payload = data && typeof data === 'object' ? data : null;
  if (!payload || payload.ok !== true) {
    const code = payload?.error;
    if (code === 'chat_closed') {
      return { ok: false, error: 'Este pedido já foi concluído ou fechado. Não é possível enviar mais mensagens aqui.' };
    }
    if (code === 'message_invalid') {
      return { ok: false, error: 'Mensagem inválida (vazia ou demasiado longa).' };
    }
    if (code === 'path_invalid' || code === 'anexos_invalid') {
      return { ok: false, error: 'Anexo inválido ou caminho incorrecto. Tente novamente.' };
    }
    if (code === 'size_invalid') {
      return { ok: false, error: 'Tamanho de anexo inválido.' };
    }
    if (code === 'mime_not_allowed') {
      return { ok: false, error: 'Tipo de ficheiro não permitido.' };
    }
    if (code === 'not_found') {
      return { ok: false, error: 'Pedido não encontrado.' };
    }
    return { ok: false, error: 'Não foi possível enviar.' };
  }

  return { ok: true };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} ref
 * @returns {Promise<{ ok: boolean, documentos?: Array<Record<string, unknown>>, error?: string }>}
 */
export async function rpcPublicHomologacaoListDocuments(supabase, ref) {
  const { data, error } = await supabase.rpc('hub_public_homologacao_list_documents', {
    p_ref: ref,
  });

  if (error) {
    return { ok: false, error: error.message || 'Não foi possível listar documentos.' };
  }

  const payload = data && typeof data === 'object' ? data : null;
  if (!payload || payload.ok !== true) {
    if (payload?.error === 'ref_required') {
      return { ok: false, error: 'Referência em falta.' };
    }
    if (payload?.error === 'not_found') {
      return { ok: false, error: 'Pedido não encontrado.' };
    }
    return { ok: false, error: 'Não foi possível listar documentos.' };
  }

  const raw = payload.documentos;
  const documentos = Array.isArray(raw) ? raw : [];
  return { ok: true, documentos };
}
