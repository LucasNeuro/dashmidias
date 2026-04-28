import { Suspense, useMemo } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { HorizontalScrollNav } from '../components/HorizontalScrollNav';
import { useAuth } from '../context/AuthContext';
import { getAppNavItems } from '../lib/appNavItems';

const TAB_LINK =
  'inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-2 text-[10px] font-black uppercase tracking-widest text-on-surface-variant transition-colors hover:bg-slate-100 hover:text-primary sm:px-3 sm:text-[11px]';
const TAB_ACTIVE = 'bg-primary text-white shadow-sm shadow-primary/20';

/** Invólucro mais leve que o card padrão do shell — evita “caixa dentro de caixa” em /adm. */
const GOVERNANCE_CONTENT_SHELL =
  'flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200/70 bg-white shadow-[0_1px_10px_rgba(15,23,42,0.04)]';

const GOVERNANCE_MAIN_PAD = 'px-3 py-3 sm:px-4 sm:py-4 lg:px-5 lg:py-4';

export function AdminGovernanceLayout() {
  const { isAdmin, hubAdmin, isHubOwner, isPlatformOwner, portal } = useAuth();
  const hubGovernance = hubAdmin || isHubOwner || isPlatformOwner;
  const navItems = useMemo(
    () => getAppNavItems({ isAdmin, hubGovernance, portal }),
    [isAdmin, hubGovernance, portal]
  );

  const headerTabs = (
    <HorizontalScrollNav className="rounded-xl bg-slate-50/95 p-1">
      <nav className="flex flex-nowrap gap-1" aria-label="Módulos de governança">
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
        to="/adm/templates"
        className={({ isActive }) => `${TAB_LINK} ${isActive ? TAB_ACTIVE : ''}`}
      >
        <span className="material-symbols-outlined text-[18px] opacity-80" aria-hidden>
          widgets
        </span>
        Cadastro homologação
      </NavLink>
      <NavLink
        to="/adm/captura-leads"
        className={({ isActive }) => `${TAB_LINK} ${isActive ? TAB_ACTIVE : ''}`}
      >
        <span className="material-symbols-outlined text-[18px] opacity-80" aria-hidden>
          contact_mail
        </span>
        Cadastro geral leads
      </NavLink>
      <NavLink
        to="/adm/catalogo-padrao"
        className={({ isActive }) => `${TAB_LINK} ${isActive ? TAB_ACTIVE : ''}`}
      >
        <span className="material-symbols-outlined text-[18px] opacity-80" aria-hidden>
          category
        </span>
        Campos
      </NavLink>
      <NavLink
        to="/adm/usuarios"
        className={({ isActive }) => `${TAB_LINK} ${isActive ? TAB_ACTIVE : ''}`}
      >
        <span className="material-symbols-outlined text-[18px] opacity-80" aria-hidden>
          group
        </span>
        Controles e acessos
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
    </HorizontalScrollNav>
  );

  return (
    <AppShell
      title="Config e governança"
      subtitle="Auditoria, cadastro homologação, cadastro geral leads (CRM), campos padrão dos formulários e organizações — a sessão aparece na barra superior."
      navItems={navItems}
      headerTabs={headerTabs}
      contentClassName={GOVERNANCE_CONTENT_SHELL}
      mainClassName={GOVERNANCE_MAIN_PAD}
    >
      <Suspense
        fallback={
          <div className="flex min-h-[30vh] items-center justify-center px-4 py-8 text-[10px] font-black uppercase tracking-widest text-slate-500">
            Carregando módulo…
          </div>
        }
      >
        <Outlet />
      </Suspense>
    </AppShell>
  );
}
