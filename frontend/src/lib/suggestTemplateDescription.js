/**
 * Corpo JSON devolvido pela função (sucesso ou erro de negócio).
 * @param {unknown} v
 * @returns {{ ok?: boolean, mensagem?: string, description?: string } | null}
 */
function asInvokePayload(v) {
  if (!v || typeof v !== 'object') return null;
  return /** @type {{ ok?: boolean, mensagem?: string, description?: string }} */ (v);
}

/**
 * @param {unknown} err — tipicamente FunctionsHttpError: context = Response
 */
async function messageFromFunctionsHttpError(err) {
  const name = /** @type {{ name?: string }} */ (err)?.name;
  const ctx = /** @type {{ context?: unknown }} */ (err)?.context;
  if (name !== 'FunctionsHttpError' || !ctx || typeof /** @type {Response} */ (ctx).json !== 'function') {
    return '';
  }
  try {
    const j = await /** @type {Response} */ (ctx).json();
    const m = asInvokePayload(j)?.mensagem;
    return typeof m === 'string' && m.trim() ? m.trim() : '';
  } catch {
    return '';
  }
}

/**
 * Mensagem legível quando o supabase-js só expõe o erro genérico de HTTP.
 * @param {unknown} err
 */
function fallbackInvokeMessage(err) {
  const m = String(/** @type {{ message?: string }} */ (err)?.message || err || '').trim();
  if (!m) {
    return 'Não foi possível contactar o serviço de sugestão. Confirme que a função está publicada no Supabase.';
  }
  if (/non-2xx/i.test(m) || /edge function/i.test(m)) {
    return [
      'A sugestão por IA falhou (resposta HTTP de erro).',
      'Confirme no Supabase: secret MISTRAL_API_KEY nas Edge Functions, função suggest-template-description publicada,',
      'e que a sua conta tem permissão de admin HUB.',
    ].join(' ');
  }
  return m;
}

/**
 * Chama a Edge Function `suggest-template-description` (Mistral no servidor).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{
 *   templateName: string,
 *   partnerKind: string,
 *   partnerKindLabel: string,
 *   partnerKindDescription: string,
 *   cnpjRequired: boolean,
 *   collectCpf: boolean,
 *   inviteLinkEnabled: boolean,
 * }} input
 * @returns {Promise<string>} Texto até 200 caracteres
 */
export async function suggestTemplateDescriptionWithMistral(supabase, input) {
  const { data, error } = await supabase.functions.invoke('suggest-template-description', {
    body: input,
  });

  if (!error) {
    const payload = asInvokePayload(data);
    if (payload?.ok === true) {
      const text = String(payload.description ?? '').trim();
      if (!text) throw new Error('Descrição vazia.');
      return text.slice(0, 200);
    }
    if (typeof payload?.mensagem === 'string' && payload.mensagem.trim()) {
      throw new Error(payload.mensagem.trim());
    }
    throw new Error('Resposta inválida do servidor.');
  }

  const fromBody = await messageFromFunctionsHttpError(error);
  if (fromBody) {
    throw new Error(fromBody);
  }

  throw new Error(fallbackInvokeMessage(error));
}
