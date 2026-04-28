/**
 * Invoca a Edge Function `lead-form-assistant` (Mistral).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {Array<{ role: 'user' | 'assistant', content: string }>} messages
 */
export async function invokeLeadFormAssistant(supabase, messages) {
  const { data, error } = await supabase.functions.invoke('lead-form-assistant', {
    body: { messages },
  });

  if (error) {
    throw new Error(error.message || 'Não foi possível contactar o assistente.');
  }

  if (!data || typeof data !== 'object') {
    throw new Error('Resposta inválida do servidor.');
  }

  const d = /** @type {{ ok?: boolean, mensagem?: string, message?: string, status?: string, fields?: unknown[] }} */ (data);

  if (!d.ok) {
    throw new Error(d.mensagem || 'Pedido rejeitado pelo servidor.');
  }

  return {
    message: String(d.message ?? ''),
    status: d.status === 'ready' ? 'ready' : 'asking',
    fields: Array.isArray(d.fields) ? d.fields : [],
  };
}
