import { rpcSubmitPartnerOrgSignup } from './hubPartnerOrgPublic';
import { getSupabase, isSupabaseConfigured } from './supabaseClient';
import { normalizeCnpj14, normalizeCpf11 } from './opencnpj';

/** PostgREST quando a função ainda não existe na base ou a cache não foi recarregada. */
function isHubSubmitRpcUnavailableMessage(msg) {
  const m = String(msg || '').toLowerCase();
  return (
    (m.includes('could not find the function') && m.includes('hub_submit_partner_org_signup')) ||
    (m.includes('hub_submit_partner_org_signup') && m.includes('schema cache')) ||
    m.includes('function public.hub_submit_partner_org_signup') && m.includes('does not exist')
  );
}

async function insertPartnerOrgSignupDirect(sb, { email, doc, raw, meta }) {
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
    const msg = error.message || '';
    if (/one_pending_per_doc/i.test(msg) || (/duplicate key/i.test(msg) && /\bcnpj\b/i.test(msg))) {
      return {
        ok: false,
        error:
          'Já existe um pedido pendente com este CNPJ/CPF. Aguarde análise ou utilize o código ORG recebido.',
      };
    }
    return { ok: false, error: msg || 'Não foi possível guardar o cadastro.' };
  }
  return { ok: true, legacyInsert: true };
}

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
 * @returns {Promise<{ ok: boolean, skipped?: boolean, error?: string, signupId?: string, codigoRastreio?: string, legacyInsert?: boolean }>}
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

  const payload = {
    email,
    cnpj: doc,
    dadosFormulario: raw,
    cnpjaSnapshot: meta?.cnpjSnapshot ?? null,
    consultaFonte: meta?.consultaFonte ?? null,
    templateId: meta?.templateId ?? null,
    partnerKind: meta?.partnerKind ?? null,
  };

  const rpcResult = await rpcSubmitPartnerOrgSignup(sb, payload);
  if (rpcResult.ok) {
    return rpcResult;
  }
  if (isHubSubmitRpcUnavailableMessage(rpcResult.error)) {
    return insertPartnerOrgSignupDirect(sb, { email, doc, raw, meta });
  }
  return rpcResult;
}
