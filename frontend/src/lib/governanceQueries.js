/** Queries partilhadas da área de governança (Supabase + TanStack Query). */

const NO_MATCH_USER = '00000000-0000-0000-0000-000000000000';
const PAGE_SIZE_AUDIT = 12;

export function auditSinceIso(range) {
  if (range === 'all') return null;
  const now = new Date();
  if (range === 'today') {
    const s = new Date(now);
    s.setHours(0, 0, 0, 0);
    return s.toISOString();
  }
  if (range === 'week') {
    const s = new Date(now);
    s.setDate(s.getDate() - 7);
    return s.toISOString();
  }
  return null;
}

function escapeIlike(s) {
  return s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
export async function fetchGovernanceProfiles(supabase) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, role')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

/**
 * @param {{
 *   supabase: import('@supabase/supabase-js').SupabaseClient,
 *   profiles: Array<{ id: string, email?: string | null, full_name?: string | null, role?: string | null }>,
 *   range: string,
 *   pageIndex: number,
 *   debouncedSearch: string,
 * }} p
 */
export async function fetchAdminAuditBundle({ supabase, profiles, range, pageIndex, debouncedSearch }) {
  const since = auditSinceIso(range);
  const from = pageIndex * PAGE_SIZE_AUDIT;
  const to = from + PAGE_SIZE_AUDIT - 1;

  const { data: rpcData, error: rpcErr } = await supabase.rpc('audit_panel_stats', { p_since: since });
  const stats = !rpcErr && rpcData ? rpcData : null;

  let query = supabase
    .from('panel_access_logs')
    .select('id, user_id, path, accessed_at, user_agent', { count: 'exact' })
    .order('accessed_at', { ascending: false });

  if (since) query = query.gte('accessed_at', since);

  const q = debouncedSearch.trim();
  if (q) {
    if (q.includes('@')) {
      const ids = profiles.filter((p) => p.email?.toLowerCase().includes(q.toLowerCase())).map((p) => p.id);
      if (ids.length) query = query.in('user_id', ids);
      else query = query.eq('user_id', NO_MATCH_USER);
    } else {
      const esc = escapeIlike(q);
      query = query.or(`path.ilike.%${esc}%,user_agent.ilike.%${esc}%`);
    }
  }

  const { data, error, count } = await query.range(from, to);
  if (error) throw error;

  return {
    stats,
    logs: data || [],
    totalCount: count ?? 0,
  };
}

export const AUDIT_PAGE_SIZE = PAGE_SIZE_AUDIT;

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
export async function fetchPartnerOrgSignups(supabase) {
  const { data, error } = await supabase
    .from('hub_partner_org_signups')
    .select('*')
    .order('criado_em', { ascending: false })
    .limit(500);
  if (error) throw error;
  return data || [];
}

/**
 * Agrega pedidos de cadastro por `template_id` (link de convite).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @returns {Promise<Record<string, { total: number, pendente: number, aprovado: number, rejeitado: number, processado: number }>>}
 */
export async function fetchPartnerOrgSignupAggregatesByTemplate(supabase) {
  const { data, error } = await supabase
    .from('hub_partner_org_signups')
    .select('template_id, status')
    .limit(15000);
  if (error) throw error;

  /** @type {Record<string, { total: number, pendente: number, aprovado: number, rejeitado: number, processado: number }>} */
  const out = {};
  for (const row of data || []) {
    const tid = String(row.template_id || '').trim() || '__sem_template__';
    if (!out[tid]) {
      out[tid] = { total: 0, pendente: 0, aprovado: 0, rejeitado: 0, processado: 0 };
    }
    out[tid].total += 1;
    const st = String(row.status || 'pendente');
    if (st === 'pendente') out[tid].pendente += 1;
    else if (st === 'aprovado') out[tid].aprovado += 1;
    else if (st === 'rejeitado') out[tid].rejeitado += 1;
    else if (st === 'processado') out[tid].processado += 1;
    else out[tid].pendente += 1;
  }
  return out;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {boolean} loadSolicitacoes
 */
export async function fetchAdminUsersBundle(supabase, loadSolicitacoes) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, can_access_audit, updated_at')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  const profiles = data || [];

  if (!loadSolicitacoes) {
    return { profiles, solicitacoes: [] };
  }

  const { data: solData, error: solErr } = await supabase
    .from('hub_solicitacoes_admin')
    .select('id, email, nome, telefone, cpf, user_id, mensagem, status, criado_em, resolvido_em')
    .order('criado_em', { ascending: false })
    .limit(200);
  if (solErr) throw solErr;
  return { profiles, solicitacoes: solData || [] };
}
