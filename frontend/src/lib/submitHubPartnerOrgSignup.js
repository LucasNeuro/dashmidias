import { getSupabase, isSupabaseConfigured } from './supabaseClient';
import { normalizeCnpj14, normalizeCpf11 } from './opencnpj';

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
  const raw = { ...dados };
  delete raw.senha;
  delete raw.confirmar_senha;

  const cnpjDigits = normalizeCnpj14(String(raw.cnpj ?? ''));
  const cpfDigits = normalizeCpf11(String(raw.cpf ?? ''));
  /** Identificador guardado em `cnpj` (coluna legada): 14 dígitos CNPJ ou 11 CPF. */
  const doc = cnpjDigits || cpfDigits;
  const email = String(raw.email ?? '').trim();

  if (!doc || !email) {
    return { ok: false, error: 'E-mail e CNPJ ou CPF são necessários para registar o pedido.' };
  }

  const row = {
    email,
    cnpj: doc,
    dados_formulario: raw,
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
