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

  const { data: rolesData, error: rolesErr } = await supabase.rpc('hub_admin_list_users_with_roles');
  if (rolesErr) throw rolesErr;
  const rolesMap = new Map((rolesData || []).map((r) => [String(r.user_id), Array.isArray(r.role_names) ? r.role_names : []]));
  const profilesWithHubRoles = profiles.map((p) => ({
    ...p,
    hub_role_names: rolesMap.get(String(p.id)) || [],
  }));

  if (!loadSolicitacoes) {
    return { profiles: profilesWithHubRoles, solicitacoes: [] };
  }

  const { data: solData, error: solErr } = await supabase
    .from('hub_solicitacoes_admin')
    .select('id, email, nome, telefone, cpf, user_id, mensagem, status, criado_em, resolvido_em, resolvido_por_user_id')
    .order('criado_em', { ascending: false })
    .limit(200);
  if (solErr) throw solErr;
  return { profiles: profilesWithHubRoles, solicitacoes: solData || [] };
}

const HUB_SOLIC_APROVADAS_LIMIT = 50;

/**
 * Pedidos administrativos já aprovados (ordenados por resolvido_em).
 * Enriquece com e-mail/nome de quem resolveu, quando existe em profiles.
 * hub_admin_access_audit não é escrito pela app hoje — histórico vem desta tabela.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {number} [limit]
 */
export async function fetchHubSolicitacoesAprovadasRecentes(supabase, limit = HUB_SOLIC_APROVADAS_LIMIT) {
  const cap = Math.min(200, Math.max(1, Number(limit) || HUB_SOLIC_APROVADAS_LIMIT));
  const { data, error } = await supabase
    .from('hub_solicitacoes_admin')
    .select('id, email, nome, telefone, cpf, mensagem, criado_em, resolvido_em, resolvido_por_user_id, user_id, status')
    .eq('status', 'aprovado')
    .not('resolvido_em', 'is', null)
    .order('resolvido_em', { ascending: false })
    .limit(cap);
  if (error) throw error;
  const rows = data || [];
  const resolverIds = [...new Set(rows.map((r) => r.resolvido_por_user_id).filter(Boolean))];
  /** @type {Map<string, { id: string, email?: string | null, full_name?: string | null }>} */
  const resolverMap = new Map();
  if (resolverIds.length) {
    const { data: profs, error: pErr } = await supabase.from('profiles').select('id, email, full_name').in('id', resolverIds);
    if (!pErr) for (const p of profs || []) resolverMap.set(String(p.id), p);
  }
  return rows.map((r) => {
    const res = r.resolvido_por_user_id ? resolverMap.get(String(r.resolvido_por_user_id)) : null;
    return {
      ...r,
      resolvido_por_email: res?.email ?? null,
      resolvido_por_nome: res?.full_name ?? null,
    };
  });
}

/**
 * Bundle de configuração de acessos HUB (cargos, permissões e vínculos).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
export async function fetchHubAccessBundle(supabase) {
  const [
    { data: roles, error: rolesErr },
    { data: perms, error: permsErr },
    { data: rolePerms, error: rpErr },
    { data: hubAdmins, error: haErr },
    { data: userRoles, error: urErr },
    { data: profiles, error: pErr },
    { data: orgMembers, error: omErr },
    { data: orgs, error: orgErr },
    { data: roleTemplates, error: ptErr },
  ] =
    await Promise.all([
      supabase.from('hub_admin_role').select('id, slug, nome, descricao, is_system, is_active, atualizado_em').order('nome', { ascending: true }),
      supabase.from('hub_admin_permission').select('id, codigo, modulo, acao, descricao, is_active').order('modulo', { ascending: true }).order('acao', { ascending: true }),
      supabase.from('hub_admin_role_permission').select('role_id, permission_id, allowed'),
      supabase.from('hub_admins').select('user_id, ativo'),
      supabase.from('hub_admin_user_role').select('user_id, role_id, is_active, atribuido_em, revogado_em'),
      supabase.from('profiles').select('id, email, full_name').order('email', { ascending: true }),
      supabase.from('organizacao_membros').select('id, organizacao_id, user_id, papel_id, papel_legacy, criado_em, ativo').order('criado_em', { ascending: false }).limit(5000),
      supabase.from('organizacoes').select('id, nome, status').limit(2000),
      supabase.from('papel_template').select('id, codigo, nome').limit(200),
    ]);

  if (rolesErr) throw rolesErr;
  if (permsErr) throw permsErr;
  if (rpErr) throw rpErr;
  if (haErr) throw haErr;
  if (urErr) throw urErr;
  if (pErr) throw pErr;
  if (omErr) throw omErr;
  if (orgErr) throw orgErr;
  if (ptErr) throw ptErr;

  return {
    roles: roles || [],
    permissions: perms || [],
    rolePermissions: rolePerms || [],
    hubAdmins: hubAdmins || [],
    userRoles: userRoles || [],
    profiles: profiles || [],
    orgMembers: orgMembers || [],
    organizations: orgs || [],
    roleTemplates: roleTemplates || [],
  };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ slug: string, nome: string, descricao?: string }} payload
 * @returns {Promise<{ id: string }>}
 */
export async function createHubRole(supabase, payload) {
  const { data, error } = await supabase
    .from('hub_admin_role')
    .insert({
      slug: payload.slug,
      nome: payload.nome,
      descricao: payload.descricao || null,
      is_system: false,
      is_active: true,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data;
}

/**
 * Atualiza metadados do cargo (não altera slug).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ id: string, nome: string, descricao?: string | null }} payload
 */
export async function updateHubRole(supabase, payload) {
  const { error } = await supabase
    .from('hub_admin_role')
    .update({ nome: payload.nome, descricao: payload.descricao ?? null })
    .eq('id', payload.id);
  if (error) throw error;
}

/**
 * Substitui permissões do cargo (whitelist).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} roleId
 * @param {string[]} permissionIds
 */
export async function setHubRolePermissions(supabase, roleId, permissionIds) {
  const { error: delErr } = await supabase.from('hub_admin_role_permission').delete().eq('role_id', roleId);
  if (delErr) throw delErr;
  if (!permissionIds.length) return;
  const rows = permissionIds.map((pid) => ({ role_id: roleId, permission_id: pid, allowed: true }));
  const { error: insErr } = await supabase.from('hub_admin_role_permission').insert(rows);
  if (insErr) throw insErr;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ userId: string, roleId: string, actorUserId?: string | null }} p
 */
export async function assignHubRoleToUser(supabase, p) {
  const { error } = await supabase.from('hub_admin_user_role').upsert(
    {
      user_id: p.userId,
      role_id: p.roleId,
      is_active: true,
      revogado_em: null,
      atribuido_em: new Date().toISOString(),
      atribuido_por_user_id: p.actorUserId || null,
    },
    { onConflict: 'user_id,role_id' }
  );
  if (error) throw error;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ userId: string, roleId: string }} p
 */
export async function revokeHubRoleFromUser(supabase, p) {
  const { error } = await supabase
    .from('hub_admin_user_role')
    .update({ is_active: false, revogado_em: new Date().toISOString() })
    .eq('user_id', p.userId)
    .eq('role_id', p.roleId);
  if (error) throw error;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ userId: string, actorUserId?: string | null, roleId?: string | null }} p
 */
export async function createHubAdminUser(supabase, p) {
  const { error: upErr } = await supabase.from('hub_admins').upsert(
    {
      user_id: p.userId,
      ativo: true,
      atualizado_em: new Date().toISOString(),
      criado_por_user_id: p.actorUserId || null,
    },
    { onConflict: 'user_id' }
  );
  if (upErr) throw upErr;

  if (p.roleId) {
    await assignHubRoleToUser(supabase, { userId: p.userId, roleId: p.roleId, actorUserId: p.actorUserId || null });
  }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ userId: string, ativo: boolean }} p
 */
export async function setHubAdminActive(supabase, p) {
  const { error } = await supabase
    .from('hub_admins')
    .update({ ativo: p.ativo, atualizado_em: new Date().toISOString() })
    .eq('user_id', p.userId);
  if (error) throw error;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ memberId: string, ativo: boolean }} p
 */
export async function setOrganizationMemberActive(supabase, p) {
  const { error } = await supabase
    .from('organizacao_membros')
    .update({ ativo: p.ativo })
    .eq('id', p.memberId);
  if (error) throw error;
}
