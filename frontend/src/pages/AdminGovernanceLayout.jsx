import { useMemo } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { useAuth } from '../context/AuthContext';
import { getAppNavItems } from '../lib/appNavItems';
import { PORTAL_IMOVEIS } from '../lib/appPortal';

const TAB_LINK =
  'inline-flex items-center gap-1.5 border-b-2 border-transparent px-3 py-2.5 text-[11px] font-black uppercase tracking-widest text-on-surface-variant transition-colors hover:text-primary';
const TAB_ACTIVE = 'border-tertiary text-primary';

export function AdminGovernanceLayout() {
  const { profile, isAdmin, hubAdmin, isHubOwner, isPlatformOwner, portal } = useAuth();
  const hubGovernance = hubAdmin || isHubOwner || isPlatformOwner;
  const navItems = useMemo(
    () => getAppNavItems({ isAdmin, hubGovernance, portal }),
    [isAdmin, hubGovernance, portal]
  );

  const headerActions = (
    <Link
      to={portal === PORTAL_IMOVEIS ? '/imoveis' : '/painel/campanhas'}
      className="text-[10px] font-black uppercase tracking-widest border border-primary px-4 py-2 hover:bg-primary hover:text-white transition-colors"
    >
      {portal === PORTAL_IMOVEIS ? 'Início Imóveis' : 'Dashboard'}
    </Link>
  );

  return (
    <AppShell
      title="Config e governança"
      subtitle={`Logado como ${profile?.email || '—'}`}
      navItems={navItems}
      headerActions={headerActions}
    >
      <div className="w-full min-w-0 py-1 sm:py-2">
        <nav
          className="mb-3 flex flex-wrap gap-1 border-b border-surface-container-high bg-white/90"
          aria-label="Módulos de governança"
        >
          <NavLink
            to="/adm/auditoria"
            end
            className={({ isActive }) => `${TAB_LINK} ${isActive ? TAB_ACTIVE : ''}`}
          >
            <span className="material-symbols-outlined text-[18px] opacity-80" aria-hidden>
              fact_check
            </span>
            Auditoria
          </NavLink>
          <NavLink
            to="/adm/configuracoes"
            className={({ isActive }) => `${TAB_LINK} ${isActive ? TAB_ACTIVE : ''}`}
          >
            <span className="material-symbols-outlined text-[18px] opacity-80" aria-hidden>
              settings
            </span>
            Configurações
          </NavLink>
          <NavLink
            to="/adm/templates"
            className={({ isActive }) => `${TAB_LINK} ${isActive ? TAB_ACTIVE : ''}`}
          >
            <span className="material-symbols-outlined text-[18px] opacity-80" aria-hidden>
              widgets
            </span>
            Templates
          </NavLink>
          <NavLink
            to="/adm/catalogo-padrao"
            className={({ isActive }) => `${TAB_LINK} ${isActive ? TAB_ACTIVE : ''}`}
          >
            <span className="material-symbols-outlined text-[18px] opacity-80" aria-hidden>
              category
            </span>
            Catálogo de campos padrão
          </NavLink>
          <NavLink
            to="/adm/usuarios"
            className={({ isActive }) => `${TAB_LINK} ${isActive ? TAB_ACTIVE : ''}`}
          >
            <span className="material-symbols-outlined text-[18px] opacity-80" aria-hidden>
              group
            </span>
            Controle de usuários
          </NavLink>
          <NavLink
            to="/adm/organizacoes"
            className={({ isActive }) => `${TAB_LINK} ${isActive ? TAB_ACTIVE : ''}`}
          >
            <span className="material-symbols-outlined text-[18px] opacity-80" aria-hidden>
              domain
            </span>
            Organizações
          </NavLink>
        </nav>
        <Outlet />
      </div>
    </AppShell>
  );
}
