import { getSupabase, isSupabaseConfigured } from './supabaseClient';
import { normalizeCnpj14 } from './opencnpj';

/**
 * @param {{
 *   dados: Record<string, unknown>,
 *   meta: {
 *     templateId?: string | null,
 *     partnerKind?: string | null,
 *     consultaFonte?: 'cnpja' | 'brasilapi' | null,
 *     cnpjSnapshot?: unknown,
 *   },
 * }} bundle
 * @returns {Promise<{ ok: boolean, skipped?: boolean, error?: string }>}
 */
export async function submitHubPartnerOrgSignup(bundle) {
  if (!isSupabaseConfigured()) {
    return { ok: true, skipped: true };
  }
  const sb = getSupabase();
  if (!sb) return { ok: true, skipped: true };

  const { dados, meta } = bundle;
  const cnpjDigits = normalizeCnpj14(String(dados.cnpj ?? ''));
  const email = String(dados.email ?? '').trim();

  if (!cnpjDigits || !email) {
    return { ok: false, error: 'Dados inválidos para envio.' };
  }

  const row = {
    email,
    cnpj: cnpjDigits,
    dados_formulario: dados,
    cnpja_snapshot: meta?.cnpjSnapshot ?? null,
    consulta_fonte: meta?.consultaFonte ?? null,
    template_id: meta?.templateId ?? null,
    partner_kind: meta?.partnerKind ?? null,
    status: 'pendente',
  };

  const { error } = await sb.from('hub_partner_org_signups').insert(row);
  if (error) {
    return { ok: false, error: error.message || 'Não foi possível guardar o cadastro.' };
  }
  return { ok: true };
}
