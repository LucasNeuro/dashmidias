import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createColumnHelper } from '@tanstack/react-table';
import { AppSideover } from '../components/AppSideover';
import { EntityDataTable } from '../components/EntityDataTable';
import { FormSideoverFooter } from '../components/FormSideoverFooter';
import { HubButton } from '../components/HubButton';
import { useAuth } from '../context/AuthContext';
import { useUiFeedback } from '../context/UiFeedbackContext';
import {
  assignHubRoleToUser,
  createHubAdminUser,
  createHubRole,
  fetchHubAccessBundle,
  revokeHubRoleFromUser,
  setHubAdminActive,
  setHubRolePermissions,
  setOrganizationMemberActive,
  updateHubRole,
} from '../lib/governanceQueries';
import { HubRolePermissionChecklist } from '../components/governance/HubRolePermissionChecklist';
import { GOV_SECTION_STORAGE, useGovSectionExpanded } from '../lib/govSectionExpand';

function slugifyRoleName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 62);
}

export function AdminConfigurationsPage() {
  const { supabase, session } = useAuth();
  const { toast, alert } = useUiFeedback();
  const queryClient = useQueryClient();

  const [busyKey, setBusyKey] = useState('');
  const [createRolePanelOpen, setCreateRolePanelOpen] = useState(false);
  const [createHubAdminPanelOpen, setCreateHubAdminPanelOpen] = useState(false);
  const [rolePanel, setRolePanel] = useState({ open: false, roleId: '' });
  const [hubUserPanel, setHubUserPanel] = useState({ open: false, userId: '' });
  const [orgUserPanel, setOrgUserPanel] = useState({ open: false, memberId: '' });

  const [roleName, setRoleName] = useState('');
  const [roleDescription, setRoleDescription] = useState('');
  const [selectedPermIds, setSelectedPermIds] = useState([]);
  const [editRoleNome, setEditRoleNome] = useState('');
  const [editRoleDescricao, setEditRoleDescricao] = useState('');

  const [newHubAdminUserId, setNewHubAdminUserId] = useState('');
  const [newHubAdminRoleId, setNewHubAdminRoleId] = useState('');

  const [cargosSectionOpen, toggleCargosSection] = useGovSectionExpanded(GOV_SECTION_STORAGE.cargos);
  const [hubAdminsSectionOpen, toggleHubAdminsSection] = useGovSectionExpanded(GOV_SECTION_STORAGE.hubAdmins);
  const [orgMembersSectionOpen, toggleOrgMembersSection] = useGovSectionExpanded(GOV_SECTION_STORAGE.orgMembers);

  const q = useQuery({
    queryKey: ['governance', 'hub-access-config'],
    queryFn: async () => fetchHubAccessBundle(supabase),
    enabled: Boolean(supabase),
  });

  const roles = q.data?.roles ?? [];
  const permissions = q.data?.permissions ?? [];
  const rolePermissions = q.data?.rolePermissions ?? [];
  const hubAdmins = q.data?.hubAdmins ?? [];
  const userRoles = q.data?.userRoles ?? [];
  const profiles = q.data?.profiles ?? [];
  const orgMembers = q.data?.orgMembers ?? [];
  const organizations = q.data?.organizations ?? [];
  const roleTemplates = q.data?.roleTemplates ?? [];

  const roleById = useMemo(() => new Map(roles.map((r) => [String(r.id), r])), [roles]);
  const profileById = useMemo(() => new Map(profiles.map((p) => [String(p.id), p])), [profiles]);
  const orgById = useMemo(() => new Map(organizations.map((o) => [String(o.id), o])), [organizations]);
  const roleTemplateById = useMemo(() => new Map(roleTemplates.map((r) => [String(r.id), r])), [roleTemplates]);

  const rolePermMap = useMemo(() => {
    const map = new Map();
    for (const rp of rolePermissions) {
      if (!rp?.allowed) continue;
      const rid = String(rp.role_id || '');
      const cur = map.get(rid) || new Set();
      cur.add(String(rp.permission_id || ''));
      map.set(rid, cur);
    }
    return map;
  }, [rolePermissions]);

  const activeHubAdmins = useMemo(() => hubAdmins.filter((h) => h?.ativo !== false), [hubAdmins]);

  const hubAdminRows = useMemo(() => {
    return activeHubAdmins.map((h) => {
      const userId = String(h.user_id || '');
      const p = profileById.get(userId);
      const activeRoles = userRoles
        .filter((ur) => String(ur.user_id || '') === userId && ur.is_active === true)
        .map((ur) => roleById.get(String(ur.role_id || '')))
        .filter(Boolean);
      return {
        user_id: userId,
        email: p?.email || '—',
        nome: p?.full_name || '—',
        ativo: Boolean(h.ativo),
        roles: activeRoles,
      };
    });
  }, [activeHubAdmins, profileById, userRoles, roleById]);

  const roleRows = useMemo(() => {
    return roles.map((r) => ({
      ...r,
      perm_count: (rolePermMap.get(String(r.id)) || new Set()).size,
      user_count: userRoles.filter((ur) => String(ur.role_id || '') === String(r.id) && ur.is_active === true).length,
    }));
  }, [roles, rolePermMap, userRoles]);

  const orgMemberRows = useMemo(() => {
    return orgMembers.map((m) => {
      const pid = String(m.user_id || '');
      const oid = String(m.organizacao_id || '');
      const rid = String(m.papel_id || '');
      const p = profileById.get(pid);
      const o = orgById.get(oid);
      const rt = roleTemplateById.get(rid);
      return {
        id: String(m.id || ''),
        user_id: pid,
        organizacao_id: oid,
        email: p?.email || '—',
        nome: p?.full_name || '—',
        organizacao: o?.nome || '—',
        papel: rt?.nome || m.papel_legacy || rt?.codigo || '—',
        status_org: o?.status || '—',
        ativo: m.ativo !== false,
        criado_em: m.criado_em || null,
      };
    });
  }, [orgMembers, profileById, orgById, roleTemplateById]);

  const permByModule = useMemo(() => {
    const out = {};
    for (const p of permissions) {
      if (p?.is_active === false) continue;
      const mod = String(p.modulo || 'geral');
      if (!out[mod]) out[mod] = [];
      out[mod].push(p);
    }
    return Object.entries(out).sort((a, b) => a[0].localeCompare(b[0]));
  }, [permissions]);

  const activeRole = roles.find((r) => String(r.id) === rolePanel.roleId) || null;

  const usuariosPorCargoAtivo = useMemo(() => {
    if (!activeRole) return [];
    const rid = String(activeRole.id);
    return userRoles
      .filter((ur) => String(ur.role_id) === rid && ur.is_active === true)
      .map((ur) => {
        const pid = String(ur.user_id);
        const p = profileById.get(pid);
        return { user_id: pid, email: p?.email ?? '—', nome: p?.full_name ?? '—' };
      })
      .sort((a, b) => String(a.email).localeCompare(String(b.email)));
  }, [activeRole, userRoles, profileById]);

  const activeHubUser = hubAdminRows.find((r) => String(r.user_id) === hubUserPanel.userId) || null;
  const activeOrgUser = orgMemberRows.find((r) => String(r.id) === orgUserPanel.memberId) || null;

  const profilesNotHubAdmin = useMemo(() => {
    const hubIds = new Set(hubAdmins.map((h) => String(h.user_id || '')));
    return profiles.filter((p) => !hubIds.has(String(p.id)));
  }, [profiles, hubAdmins]);

  async function refresh() {
    await queryClient.refetchQueries({ queryKey: ['governance', 'hub-access-config'] });
  }

  function toggleSelectedPerm(pid, checked) {
    setSelectedPermIds((prev) => (checked ? Array.from(new Set([...prev, pid])) : prev.filter((x) => x !== pid)));
  }

  const lastHydratedRoleId = useRef('');
  useEffect(() => {
    if (!rolePanel.open || !rolePanel.roleId) {
      lastHydratedRoleId.current = '';
      return;
    }
    const rid = String(rolePanel.roleId);
    if (lastHydratedRoleId.current === rid) return;
    lastHydratedRoleId.current = rid;
    const role = roles.find((r) => String(r.id) === rid);
    if (!role) return;
    setEditRoleNome(role.nome || '');
    setEditRoleDescricao(role.descricao || '');
    setSelectedPermIds(Array.from(rolePermMap.get(rid) || []));
  }, [rolePanel.open, rolePanel.roleId, roles, rolePermMap]);

  async function onCreateRole() {
    if (!supabase) return;
    const nome = roleName.trim();
    if (nome.length < 3) {
      await alert('Informe um nome de cargo com pelo menos 3 caracteres.', { title: 'Controles e acessos' });
      return;
    }
    const slug = slugifyRoleName(nome);
    if (!slug) {
      await alert('Não foi possível gerar o código do cargo.', { title: 'Controles e acessos' });
      return;
    }
    setBusyKey('create-role');
    const permissionIdsSnapshot = [...selectedPermIds];
    try {
      const { id: newRoleId } = await createHubRole(supabase, { slug, nome, descricao: roleDescription.trim() });
      await setHubRolePermissions(supabase, String(newRoleId), permissionIdsSnapshot);
      setRoleName('');
      setRoleDescription('');
      setCreateRolePanelOpen(false);
      toast('Cargo criado com sucesso.', { variant: 'success' });
      await refresh();
      lastHydratedRoleId.current = '';
      setEditRoleNome(nome);
      setEditRoleDescricao(roleDescription.trim());
      setSelectedPermIds(permissionIdsSnapshot);
      setRolePanel({ open: true, roleId: String(newRoleId) });
    } catch (e) {
      await alert(String(e?.message || e), { title: 'Erro ao criar cargo' });
    } finally {
      setBusyKey('');
    }
  }

  async function onCreateHubAdmin() {
    if (!supabase || !newHubAdminUserId) return;
    setBusyKey('create-hub-admin');
    try {
      await createHubAdminUser(supabase, {
        userId: newHubAdminUserId,
        roleId: newHubAdminRoleId || null,
        actorUserId: session?.user?.id || null,
      });
      setNewHubAdminUserId('');
      setNewHubAdminRoleId('');
      setCreateHubAdminPanelOpen(false);
      toast('Usuário adicionado como admin HUB.', { variant: 'success' });
      await refresh();
    } catch (e) {
      await alert(String(e?.message || e), { title: 'Erro ao adicionar admin HUB' });
    } finally {
      setBusyKey('');
    }
  }

  async function onToggleHubAdmin(userId, ativo) {
    if (!supabase) return;
    setBusyKey(`toggle-hub-admin:${userId}`);
    try {
      await setHubAdminActive(supabase, { userId, ativo });
      toast(`Admin HUB ${ativo ? 'ativado' : 'desativado'}.`, { variant: 'success' });
      await refresh();
    } catch (e) {
      await alert(String(e?.message || e), { title: 'Erro ao atualizar admin HUB' });
    } finally {
      setBusyKey('');
    }
  }

  async function onToggleHubRole(userId, roleId, hasRole) {
    if (!supabase) return;
    setBusyKey(`hub-role:${userId}:${roleId}`);
    try {
      if (hasRole) await revokeHubRoleFromUser(supabase, { userId, roleId });
      else await assignHubRoleToUser(supabase, { userId, roleId, actorUserId: session?.user?.id || null });
      await refresh();
    } catch (e) {
      await alert(String(e?.message || e), { title: 'Erro ao atualizar vínculo' });
    } finally {
      setBusyKey('');
    }
  }

  async function onSaveRolePanel() {
    if (!supabase || !activeRole) return;
    const nome = editRoleNome.trim();
    if (nome.length < 3) {
      await alert('Informe um nome de cargo com pelo menos 3 caracteres.', { title: 'Controles e acessos' });
      return;
    }
    setBusyKey(`save-role:${activeRole.id}`);
    try {
      await updateHubRole(supabase, { id: String(activeRole.id), nome, descricao: editRoleDescricao.trim() });
      await setHubRolePermissions(supabase, String(activeRole.id), selectedPermIds);
      setRolePanel({ open: false, roleId: '' });
      toast('Cargo atualizado.', { variant: 'success' });
      await refresh();
    } catch (e) {
      await alert(String(e?.message || e), { title: 'Erro ao guardar cargo' });
    } finally {
      setBusyKey('');
    }
  }

  async function onToggleOrgMember(memberId, ativo) {
    if (!supabase) return;
    setBusyKey(`org-member:${memberId}`);
    try {
      await setOrganizationMemberActive(supabase, { memberId, ativo });
      toast(`Membro ${ativo ? 'ativado' : 'desativado'}.`, { variant: 'success' });
      await refresh();
    } catch (e) {
      await alert(String(e?.message || e), { title: 'Erro ao atualizar membro da organização' });
    } finally {
      setBusyKey('');
    }
  }

  const colRole = createColumnHelper();
  const roleColumns = useMemo(
    () => [
      colRole.accessor('nome', { header: 'Cargo', cell: (info) => <span className="font-semibold">{info.getValue() || '—'}</span> }),
      colRole.accessor('slug', { header: 'Código', cell: (info) => <span className="font-mono text-xs">{info.getValue()}</span> }),
      colRole.accessor('perm_count', { header: 'Permissões' }),
      colRole.accessor('user_count', { header: 'Admins' }),
      colRole.display({
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <HubButton
            variant="tableSecondary"
            icon="tune"
            iconClassName="text-[16px]"
            onClick={() => {
              const roleId = String(row.original.id);
              setEditRoleNome(row.original.nome || '');
              setEditRoleDescricao(row.original.descricao || '');
              setSelectedPermIds(Array.from(rolePermMap.get(roleId) || []));
              setRolePanel({ open: true, roleId });
            }}
          >
            Gerir cargo
          </HubButton>
        ),
      }),
    ],
    [rolePermMap]
  );

  const colHub = createColumnHelper();
  const hubAdminColumns = useMemo(
    () => [
      colHub.accessor('email', { header: 'E-mail', cell: (info) => <span className="font-mono text-xs break-all">{info.getValue() || '—'}</span> }),
      colHub.accessor('nome', { header: 'Nome' }),
      colHub.accessor('roles', {
        header: 'Cargos',
        cell: (info) => {
          const names = (info.getValue() || []).map((r) => r.nome).filter(Boolean);
          return <span className="text-xs text-on-surface-variant">{names.length ? names.join(', ') : '—'}</span>;
        },
      }),
      colHub.display({
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1">
            <HubButton variant="tableSecondary" icon="manage_accounts" iconClassName="text-[16px]" onClick={() => setHubUserPanel({ open: true, userId: row.original.user_id })}>
              Gerir
            </HubButton>
            <HubButton
              variant={row.original.ativo ? 'danger' : 'tableSecondary'}
              icon={row.original.ativo ? 'toggle_off' : 'toggle_on'}
              iconClassName="text-[16px]"
              disabled={busyKey === `toggle-hub-admin:${row.original.user_id}`}
              onClick={() => void onToggleHubAdmin(row.original.user_id, !row.original.ativo)}
            >
              {row.original.ativo ? 'Desativar' : 'Ativar'}
            </HubButton>
          </div>
        ),
      }),
    ],
    [busyKey]
  );

  const colOrg = createColumnHelper();
  const orgMemberColumns = useMemo(
    () => [
      colOrg.accessor('organizacao', { header: 'Organização' }),
      colOrg.accessor('email', { header: 'E-mail', cell: (info) => <span className="font-mono text-xs break-all">{info.getValue() || '—'}</span> }),
      colOrg.accessor('nome', { header: 'Nome' }),
      colOrg.accessor('papel', {
        header: 'Papel (org)',
        cell: ({ getValue }) => <span title="Papel interno à organização; gestão própria no futuro.">{getValue() || '—'}</span>,
      }),
      colOrg.accessor('ativo', {
        header: 'Estado',
        cell: (info) => <span className={`text-[10px] font-black uppercase ${info.getValue() ? 'text-emerald-700' : 'text-amber-800'}`}>{info.getValue() ? 'Ativo' : 'Inativo'}</span>,
      }),
      colOrg.display({
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <HubButton variant="tableSecondary" icon="visibility" iconClassName="text-[16px]" onClick={() => setOrgUserPanel({ open: true, memberId: row.original.id })}>
            Consultar
          </HubButton>
        ),
      }),
    ],
    []
  );

  if (!supabase) {
    return <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Supabase não configurado.</div>;
  }

  return (
    <>
      <div className="space-y-6">
        <section id="controles-acessos-hub" className="overflow-hidden rounded-sm border border-primary/15 bg-white shadow-sm ring-1 ring-primary/[0.08]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-[#f8fafc] px-4 py-3 sm:px-5">
            <button
              type="button"
              id="gov-section-cargos-heading"
              aria-expanded={cargosSectionOpen}
              aria-controls="gov-section-cargos-panel"
              className="min-w-0 flex flex-1 cursor-pointer items-center gap-2 rounded-sm py-0.5 text-left outline-none ring-inset focus-visible:ring-2 focus-visible:ring-primary/40"
              onClick={toggleCargosSection}
            >
              <span
                className="material-symbols-outlined shrink-0 text-[20px] text-slate-600 transition-transform"
                style={{ transform: cargosSectionOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }}
                aria-hidden
              >
                expand_more
              </span>
              <span className="min-w-0 flex-1">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-tertiary">Passo 1 — Definir cargos no HUB</p>
                <h2 className="mt-0.5 text-[10px] font-black uppercase tracking-[0.18em] text-slate-700">Cargos do HUB (administradores da plataforma)</h2>
              </span>
            </button>
            <HubButton
              variant="primary"
              icon="add"
              className="shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                setRoleName('');
                setRoleDescription('');
                setSelectedPermIds([]);
                setCreateRolePanelOpen(true);
              }}
            >
              Novo cargo
            </HubButton>
          </div>
          <div
            id="gov-section-cargos-panel"
            role="region"
            aria-labelledby="gov-section-cargos-heading"
            hidden={!cargosSectionOpen}
            className="p-4 sm:p-5"
          >
            <EntityDataTable
              data={roleRows}
              columns={roleColumns}
              getRowId={(r) => r.id}
              searchPlaceholder="Buscar cargo…"
              pageSize={10}
              emptyLabel={
                q.isPending
                  ? 'Carregando…'
                  : q.isError
                    ? 'Não foi possível carregar cargos. Rode o seed SQL (hub_admin_roles_permissions) se a lista estiver vazia.'
                    : 'Nenhum cargo — crie o primeiro cargo para poder associar admins.'
              }
            />
          </div>
        </section>

        <section className="overflow-hidden rounded-sm border border-primary/15 bg-white shadow-sm ring-1 ring-primary/[0.08]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-[#f8fafc] px-4 py-3 sm:px-5">
            <button
              type="button"
              id="gov-section-hube-admins-heading"
              aria-expanded={hubAdminsSectionOpen}
              aria-controls="gov-section-hube-admins-panel"
              className="min-w-0 flex flex-1 cursor-pointer items-center gap-2 rounded-sm py-0.5 text-left outline-none ring-inset focus-visible:ring-2 focus-visible:ring-primary/40"
              onClick={toggleHubAdminsSection}
            >
              <span
                className="material-symbols-outlined shrink-0 text-[20px] text-slate-600 transition-transform"
                style={{ transform: hubAdminsSectionOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }}
                aria-hidden
              >
                expand_more
              </span>
              <span className="min-w-0 flex-1">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-tertiary">Passo 2 — Utilizadores nos cargos</p>
                <h2 className="mt-0.5 text-[10px] font-black uppercase tracking-[0.18em] text-slate-700">Administradores do HUB (contas nos cargos)</h2>
              </span>
            </button>
            <HubButton
              variant="primary"
              icon="person_add"
              className="shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                setCreateHubAdminPanelOpen(true);
              }}
            >
              Novo utilizador admin
            </HubButton>
          </div>
          <div
            id="gov-section-hube-admins-panel"
            role="region"
            aria-labelledby="gov-section-hube-admins-heading"
            hidden={!hubAdminsSectionOpen}
            className="p-4 sm:p-5"
          >
            <EntityDataTable
              data={hubAdminRows}
              columns={hubAdminColumns}
              getRowId={(r) => r.user_id}
              searchPlaceholder="Buscar utilizador ou e-mail…"
              pageSize={12}
              emptyLabel={q.isPending ? 'Carregando…' : 'Nenhum administrador do HUB. Adicione um utilizador e associe cargos através de «Gerir».'}
            />
          </div>
        </section>

        <section className="overflow-hidden rounded-sm border border-dashed border-slate-300/90 bg-white/95 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-[#f8fafc] px-4 py-3 sm:px-5">
            <button
              type="button"
              id="gov-section-org-members-heading"
              aria-expanded={orgMembersSectionOpen}
              aria-controls="gov-section-org-members-panel"
              className="min-w-0 flex flex-1 cursor-pointer items-center gap-2 rounded-sm py-0.5 text-left outline-none ring-inset focus-visible:ring-2 focus-visible:ring-primary/40"
              onClick={toggleOrgMembersSection}
            >
              <span
                className="material-symbols-outlined shrink-0 text-[20px] text-slate-600 transition-transform"
                style={{ transform: orgMembersSectionOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }}
                aria-hidden
              >
                expand_more
              </span>
              <span className="min-w-0 flex-1">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Consulta</p>
                <h2 className="mt-0.5 text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">Membros das organizações</h2>
              </span>
            </button>
            <span className="shrink-0 rounded-none border border-slate-200 bg-white px-2 py-1.5 text-[9px] font-black uppercase tracking-wider text-slate-500">Só organização</span>
          </div>
          <div
            id="gov-section-org-members-panel"
            role="region"
            aria-labelledby="gov-section-org-members-heading"
            hidden={!orgMembersSectionOpen}
            className="p-4 sm:p-5"
          >
            <EntityDataTable
              data={orgMemberRows}
              columns={orgMemberColumns}
              getRowId={(r) => r.id}
              searchPlaceholder="Buscar membro ou organização…"
              pageSize={12}
              emptyLabel={
                q.isPending
                  ? 'Carregando…'
                  : q.isError
                    ? 'Não foi possível carregar. Verifique permissões (RLS) e tabela organizacao_membros.'
                    : 'Nenhum vínculo de membro registado.'
              }
            />
          </div>
        </section>
      </div>

      <AppSideover
        open={createRolePanelOpen}
        onClose={() => setCreateRolePanelOpen(false)}
        eyebrow="Controles e acessos · Passo 1"
        title="Novo cargo do HUB"
        bodyClassName="p-4 sm:p-5 bg-slate-50"
        footer={
          <FormSideoverFooter
            onCancel={() => setCreateRolePanelOpen(false)}
            primaryLabel="Criar cargo"
            primaryIcon="add"
            onPrimary={() => void onCreateRole()}
            primaryDisabled={busyKey === 'create-role' || roleName.trim().length < 3}
            busy={busyKey === 'create-role'}
            loadingLabel="A criar…"
          />
        }
      >
        <div className="space-y-3">
          <label className="block text-xs font-semibold text-slate-700">
            Nome do cargo
            <input
              value={roleName}
              onChange={(e) => setRoleName(e.target.value)}
              className="mt-1 w-full rounded-none border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/30"
            />
          </label>
          <label className="block text-xs font-semibold text-slate-700">
            Descrição
            <textarea
              value={roleDescription}
              onChange={(e) => setRoleDescription(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-none border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/30"
            />
          </label>
          <HubRolePermissionChecklist
            permByModule={permByModule}
            selectedPermIds={selectedPermIds}
            onToggle={toggleSelectedPerm}
            disabled={busyKey === 'create-role'}
            showIntro
          />
        </div>
      </AppSideover>

      <AppSideover
        open={rolePanel.open && !!activeRole}
        onClose={() => setRolePanel({ open: false, roleId: '' })}
        eyebrow="Controles e acessos"
        title="Editar cargo do HUB"
        subtitle={activeRole ? `${activeRole.nome} · ${activeRole.slug}` : ''}
        bodyClassName="p-4 sm:p-5 bg-slate-50"
        footer={
          activeRole ? (
            <FormSideoverFooter
              onCancel={() => setRolePanel({ open: false, roleId: '' })}
              primaryLabel="Guardar cargo"
              primaryIcon="save"
              onPrimary={() => void onSaveRolePanel()}
              primaryDisabled={busyKey === `save-role:${activeRole.id}` || editRoleNome.trim().length < 3}
              busy={busyKey === `save-role:${activeRole.id}`}
              loadingLabel="A guardar…"
            />
          ) : null
        }
      >
        {activeRole ? (
          <div className="space-y-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Dados do cargo</p>
            <label className="block text-xs font-semibold text-slate-700">
              Nome
              <input
                value={editRoleNome}
                onChange={(e) => setEditRoleNome(e.target.value)}
                className="mt-1 w-full rounded-none border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/30"
              />
            </label>
            <label className="block text-xs font-semibold text-slate-700">
              Descrição
              <textarea
                value={editRoleDescricao}
                onChange={(e) => setEditRoleDescricao(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-none border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/30"
              />
            </label>
            <HubRolePermissionChecklist
              permByModule={permByModule}
              selectedPermIds={selectedPermIds}
              onToggle={toggleSelectedPerm}
              disabled={busyKey === `save-role:${activeRole.id}`}
              showIntro={false}
            />
          </div>
        ) : null}
      />

      <AppSideover
        open={createHubAdminPanelOpen}
        onClose={() => setCreateHubAdminPanelOpen(false)}
        eyebrow="Controles e acessos · Passo 2"
        title="Adicionar utilizador administrativo (HUB)"
        bodyClassName="p-4 sm:p-5 bg-slate-50"
        footer={
          <FormSideoverFooter
            onCancel={() => setCreateHubAdminPanelOpen(false)}
            primaryLabel="Adicionar"
            primaryIcon="person_add"
            onPrimary={() => void onCreateHubAdmin()}
            primaryDisabled={busyKey === 'create-hub-admin' || !newHubAdminUserId}
            busy={busyKey === 'create-hub-admin'}
            loadingLabel="A adicionar…"
          />
        }
      >
        <div className="space-y-3">
          <p className="rounded-sm border border-slate-100 bg-white px-3 py-2 text-[11px] leading-relaxed text-on-surface-variant">
            A conta tem de estar <strong>já registada</strong> no projeto (Auth). As permissões na consola vêm sempre dos <strong>cargos do HUB</strong>; pode afiná-los em <strong>Gerir</strong> ou em <strong>Gerir cargo</strong> em cada linha.
          </p>
          <label className="block text-xs font-semibold text-slate-700">
            Conta (e-mail já existente)
            <select value={newHubAdminUserId} onChange={(e) => setNewHubAdminUserId(e.target.value)} className="mt-1 w-full rounded-none border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/30">
              <option value="">Selecione…</option>
              {profilesNotHubAdmin.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.email || p.full_name || p.id}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-semibold text-slate-700">
            Cargo inicial do HUB (opcional)
            <select value={newHubAdminRoleId} onChange={(e) => setNewHubAdminRoleId(e.target.value)} className="mt-1 w-full rounded-none border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/30">
              <option value="">Sem cargo inicial</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nome}
                </option>
              ))}
            </select>
          </label>
        </div>
      </AppSideover>

      <AppSideover
        open={hubUserPanel.open && !!activeHubUser}
        onClose={() => setHubUserPanel({ open: false, userId: '' })}
        eyebrow="Passo 2 — Cargos no utilizador"
        title="Cargos HUB ligados ao utilizador"
        subtitle={activeHubUser?.email}
        bodyClassName="p-4 sm:p-5 bg-slate-50"
        footer={
          <FormSideoverFooter>
            <HubButton
              variant="secondary"
              icon="close"
              onClick={() => setHubUserPanel({ open: false, userId: '' })}
              className="!text-xs !font-semibold !tracking-wide focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
            >
              Fechar
            </HubButton>
            <span className="hidden min-[480px]:block" aria-hidden />
          </FormSideoverFooter>
        }
      >
        {activeHubUser ? (
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-on-surface-variant">
              Ligá-lo ou tirá-lo de cada cargo na lista abaixo. O acesso à consola segue os módulos ativos por cargo (<strong>Gerir cargo</strong> na tabela de cargos).
            </p>
            <p className="text-sm font-semibold text-slate-800">{activeHubUser.nome}</p>
            {roles.map((role) => {
              const rid = String(role.id);
              const hasRole = activeHubUser.roles.some((r) => String(r.id) === rid);
              const key = `hub-role:${activeHubUser.user_id}:${rid}`;
              return (
                <div key={rid} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{role.nome}</p>
                    <p className="text-xs text-on-surface-variant">{role.slug}</p>
                  </div>
                  <HubButton variant={hasRole ? 'danger' : 'tableSecondary'} icon={hasRole ? 'remove' : 'add'} iconClassName="text-[16px]" disabled={busyKey === key} onClick={() => void onToggleHubRole(activeHubUser.user_id, rid, hasRole)}>
                    {hasRole ? 'Remover' : 'Adicionar'}
                  </HubButton>
                </div>
              );
            })}
          </div>
        ) : null}
      </AppSideover>

      <AppSideover
        open={orgUserPanel.open && !!activeOrgUser}
        onClose={() => setOrgUserPanel({ open: false, memberId: '' })}
        eyebrow="Membro da organização"
        title="Consulta e estado do vínculo"
        subtitle={activeOrgUser?.email}
        bodyClassName="p-4 sm:p-5 bg-slate-50"
        footer={
          activeOrgUser ? (
            <FormSideoverFooter>
              <HubButton
                variant="secondary"
                icon="close"
                onClick={() => setOrgUserPanel({ open: false, memberId: '' })}
                className="!text-xs !font-semibold !tracking-wide focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
              >
                Fechar
              </HubButton>
              <HubButton
                variant={activeOrgUser.ativo ? 'danger' : 'primary'}
                icon={activeOrgUser.ativo ? 'toggle_off' : 'toggle_on'}
                iconClassName="text-[16px]"
                disabled={busyKey === `org-member:${activeOrgUser.id}`}
                onClick={() => void onToggleOrgMember(activeOrgUser.id, !activeOrgUser.ativo)}
                className="!text-xs !font-semibold !tracking-wide focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
              >
                {activeOrgUser.ativo ? 'Desativar utilizador' : 'Ativar utilizador'}
              </HubButton>
            </FormSideoverFooter>
          ) : null
        }
      >
        {activeOrgUser ? (
          <div className="space-y-4">
            <p className="rounded-sm border border-amber-200/90 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-950">
              Esta área não substitui os <strong>cargos do HUB</strong>. No futuro, a organização tratará dos seus utilizadores e módulos; aqui apenas <strong>vê dados</strong> e pode barrar/restaurar o acesso em emergência (ativar/desativar).
            </p>
            <dl className="space-y-2 text-sm">
              <div><dt className="text-[10px] font-black uppercase text-on-surface-variant">Organização</dt><dd>{activeOrgUser.organizacao}</dd></div>
              <div><dt className="text-[10px] font-black uppercase text-on-surface-variant">Nome</dt><dd>{activeOrgUser.nome}</dd></div>
              <div><dt className="text-[10px] font-black uppercase text-on-surface-variant">Papel</dt><dd>{activeOrgUser.papel}</dd></div>
              <div><dt className="text-[10px] font-black uppercase text-on-surface-variant">Criado em</dt><dd>{activeOrgUser.criado_em ? new Date(activeOrgUser.criado_em).toLocaleString('pt-BR') : '—'}</dd></div>
            </dl>
          </div>
        ) : null}
      </AppSideover>
    </>
  );
}