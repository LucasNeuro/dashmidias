import { useEffect, useMemo } from 'react';
import { useStore } from '@tanstack/react-store';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useUiFeedback } from '../context/UiFeedbackContext';
import {
  hydrateDrawerOpen,
  hydrateExpandedGroups,
  setDrawerOpen,
  setMobileOpen,
  setExpandedGroups,
  uiShellStore,
} from '../stores/uiShellStore';
import { HubBrandMark } from './HubBrandMark';

const LS_DRAWER = 'app-shell-drawer-open';
const LS_GROUP_EXPAND = 'app-shell-group-expand';
const RAIL_W = 'w-[3.25rem]';
const DRAWER_W = 'w-56';

function navIconForLabel(label) {
  const m = {
    Hub: 'home',
    Imóveis: 'real_estate_agent',
    CRM: 'groups',
    Campanhas: 'campaign',
    'Config e Audit': 'tune',
    Auditoria: 'tune',
  };
  return m[label] || 'circle';
}

function itemIcon(item) {
  return item.icon || navIconForLabel(item.label);
}

/**
 * Ativo: uma barra — só no rail quando a gaveta está fechada; só no texto quando aberta.
 * (Evita duas linhas verdes no mesmo item.)
 */
function railLinkClass(isActive, drawerOpen) {
  const base =
    'flex h-11 w-11 shrink-0 items-center justify-center rounded-sm border-l-[3px] -ml-px transition-colors';
  const showBar = isActive && !drawerOpen;
  return `${base} ${showBar ? 'border-tertiary text-white' : isActive ? 'border-transparent text-white' : 'border-transparent text-white/60'}`;
}

function drawerLinkClass(isActive, drawerOpen) {
  const base =
    'flex min-h-[2.75rem] w-full items-center px-3 text-sm font-medium border-l-[3px] -ml-px transition-colors';
  const showBar = isActive && drawerOpen;
  if (showBar) return `${base} border-tertiary text-white`;
  if (isActive) return `${base} border-transparent text-white`;
  return `${base} border-transparent text-white/70`;
}

function drawerSubLinkClass(isActive) {
  const base =
    'flex w-full items-center py-2 pl-4 pr-2 text-[13px] font-medium border-l-[3px] -ml-px transition-colors';
  return `${base} ${
    isActive ? 'border-tertiary text-white' : 'border-transparent text-white/60'
  }`;
}

function drawerColClass(drawerOpen) {
  return `flex shrink-0 flex-col justify-center transition-[width] duration-200 ease-out overflow-hidden ${
    drawerOpen ? `${DRAWER_W}` : 'w-0'
  }`;
}

/** Barra global: gradiente alinhado ao `AppSideover` (governança), marca à esquerda. */
function AppShellTopBar({ onOpenMobileNav }) {
  const { signOut, session } = useAuth();
  const { toast } = useUiFeedback();
  const email = session?.user?.email?.trim() || '';

  return (
    <header className="relative z-[80] flex h-14 shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-gradient-to-r from-primary via-[#1a3050] to-[#24364a] px-3 shadow-[0_2px_12px_rgba(7,16,24,0.35)] sm:px-4 lg:px-6">
      <div
        className="pointer-events-none absolute inset-y-0 right-0 w-[min(40%,14rem)] bg-gradient-to-l from-white/[0.07] to-transparent"
        aria-hidden
      />
      <div className="relative flex min-w-0 items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={onOpenMobileNav}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white transition hover:bg-white/10 lg:hidden"
          aria-label="Abrir menu de navegação"
        >
          <span className="material-symbols-outlined text-[26px] leading-none">menu</span>
        </button>
        <HubBrandMark compact />
      </div>
      <div className="relative flex shrink-0 items-center gap-1 sm:gap-2">
        {email ? (
          <span className="hidden max-w-[14rem] truncate text-xs font-medium text-white/85 md:inline" title={email}>
            {email}
          </span>
        ) : null}
        <button
          type="button"
          onClick={() =>
            toast('Centro de notificações em breve.', { variant: 'info', duration: 4200 })
          }
          className="flex h-10 w-10 items-center justify-center rounded-lg text-white/90 transition hover:bg-white/10"
          aria-label="Notificações"
        >
          <span className="material-symbols-outlined text-[24px] leading-none">notifications</span>
        </button>
        <button
          type="button"
          onClick={() => void signOut()}
          className="flex h-10 items-center gap-1.5 rounded-lg border border-white/25 bg-white/5 px-3 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-white/15"
        >
          <span className="material-symbols-outlined text-[20px] leading-none sm:text-[22px]">logout</span>
          <span className="hidden sm:inline">Sair</span>
        </button>
      </div>
    </header>
  );
}

/**
 * Rail (ícones) + gaveta (rótulos) — minidrawer.
 */
function SideRow({ drawerOpen, left, right, variant = 'nav' }) {
  const inner =
    variant === 'header'
      ? 'flex w-full min-w-0 flex-col justify-center px-2.5 py-2'
      : variant === 'group'
        ? 'flex w-full min-w-0 flex-col justify-start py-1.5 pr-1'
        : 'flex min-h-[2.75rem] w-full min-w-0 flex-col justify-center';
  return (
    <div className="flex items-start">
      <div
        className={`flex ${RAIL_W} shrink-0 justify-center border-[#1a344d] bg-[#1a344d] ${variant === 'group' ? 'items-start pt-2' : 'items-center py-1'}`}
      >
        {left}
      </div>
      <div className={drawerColClass(drawerOpen)}>
        <div className={inner}>{right}</div>
      </div>
    </div>
  );
}

function DesktopSidebar({ navItems, drawerOpen, isGroupExpanded, toggleGroup }) {
  const { session, profile, isAdmin } = useAuth();
  const email = session?.user?.email || '';
  const name = profile?.full_name?.trim() || email.split('@')[0] || 'Usuário';
  const initial = (name[0] || '?').toUpperCase();
  const role = isAdmin ? 'Administrador' : 'Usuário';

  const navRows = [];

  navItems.forEach((item) => {
    if (item.group && item.children?.length) {
      const icon = itemIcon(item);
      const subOpen = isGroupExpanded(item.label);
      navRows.push(
        <SideRow
          key={item.label}
          variant="group"
          drawerOpen={drawerOpen}
          left={
            <NavLink
              to={item.to}
              end={item.end ?? false}
              title={item.label}
              className={({ isActive }) => railLinkClass(isActive, drawerOpen)}
            >
              <span className="material-symbols-outlined text-[22px] leading-none" aria-hidden>
                {icon}
              </span>
            </NavLink>
          }
          right={
            <div className="flex w-full flex-col gap-0.5">
              <button
                type="button"
                onClick={() => toggleGroup(item.label)}
                className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm font-medium text-white/85"
                aria-expanded={subOpen}
              >
                <span className="pl-1">{item.label}</span>
                <span className="material-symbols-outlined shrink-0 text-[20px] text-white/45" aria-hidden>
                  {subOpen ? 'expand_less' : 'expand_more'}
                </span>
              </button>
              {subOpen ? (
                <div className="mt-0.5 flex flex-col gap-0.5 border-l border-white/10 pl-2">
                  {item.children.map((sub) => (
                    <NavLink key={`${sub.to}-${sub.label}`} to={sub.to} end={sub.end} className={({ isActive }) => drawerSubLinkClass(isActive)}>
                      {sub.label}
                    </NavLink>
                  ))}
                </div>
              ) : null}
            </div>
          }
        />
      );
      return;
    }

    const icon = itemIcon(item);
    if (item.children?.length) {
      item.children.forEach((sub) => {
        navRows.push(
          <SideRow
            key={sub.to}
            drawerOpen={drawerOpen}
            left={
              <NavLink to={sub.to} end={sub.end} title={sub.label} className={({ isActive }) => railLinkClass(isActive, drawerOpen)}>
                <span className="material-symbols-outlined text-[22px] leading-none" aria-hidden>
                  {itemIcon(sub)}
                </span>
              </NavLink>
            }
            right={
              <NavLink to={sub.to} end={sub.end} className={({ isActive }) => drawerLinkClass(isActive, drawerOpen)}>
                {sub.label}
              </NavLink>
            }
          />
        );
      });
      return;
    }

    navRows.push(
      <SideRow
        key={item.to}
        drawerOpen={drawerOpen}
        left={
          <NavLink to={item.to} end={item.end} title={item.label} className={({ isActive }) => railLinkClass(isActive, drawerOpen)}>
            <span className="material-symbols-outlined text-[22px] leading-none" aria-hidden>
              {icon}
            </span>
          </NavLink>
        }
        right={
          <NavLink to={item.to} end={item.end} className={({ isActive }) => drawerLinkClass(isActive, drawerOpen)}>
            {item.label}
          </NavLink>
        }
      />
    );
  });

  return (
    <div className="pointer-events-auto flex h-full min-h-0 flex-col overflow-hidden bg-[#1a344d] shadow-2xl">
      <div className="sidebar-scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-hidden pt-10">{navRows}</div>
      <div className="flex shrink-0 items-stretch border-t border-white/10">
        <div className={`flex ${RAIL_W} shrink-0 flex-col items-center justify-center bg-[#1a344d] py-1.5`}>
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-tertiary/25 text-xs font-bold text-white ring-2 ring-white/10"
            aria-hidden
          >
            {initial}
          </div>
        </div>
        <div className={drawerColClass(drawerOpen)}>
          <div className="flex min-h-[2.75rem] flex-col justify-center gap-0.5 px-2 py-1.5">
            {drawerOpen ? (
              <>
                <p className="truncate text-sm font-semibold text-white">{name}</p>
                <p className="truncate text-xs text-white/50">{role}</p>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Mobile: uma coluna com ícone + texto (sem minidrawer). */
function MobileDrawerNav({ navItems, onNavigate, isGroupExpanded, toggleGroup }) {
  return (
    <nav className="flex flex-col gap-0.5 px-2 py-2" aria-label="Menu expandido">
      {navItems.map((item) => {
        if (item.group && item.children?.length) {
          const open = isGroupExpanded(item.label);
          const icon = itemIcon(item);
          return (
            <div key={item.label} className="mb-1">
              <button
                type="button"
                onClick={() => toggleGroup(item.label)}
                className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-white/85"
                aria-expanded={open}
              >
                <span className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-[22px] text-white/70" aria-hidden>
                    {icon}
                  </span>
                  {item.label}
                </span>
                <span className="material-symbols-outlined shrink-0 text-[20px] text-white/45" aria-hidden>
                  {open ? 'expand_less' : 'expand_more'}
                </span>
              </button>
              {open ? (
                <div className="mt-0.5 flex flex-col gap-0.5 border-l border-white/10 pl-3">
                  {item.children.map((sub) => (
                    <NavLink
                      key={`${sub.to}-${sub.label}`}
                      to={sub.to}
                      end={sub.end}
                      onClick={onNavigate}
                      className={({ isActive }) => drawerSubLinkClass(isActive)}
                    >
                      {sub.label}
                    </NavLink>
                  ))}
                </div>
              ) : null}
            </div>
          );
        }
        if (item.children?.length) {
          return (
            <div key={item.to || item.label} className="mb-1">
              <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/40">{item.label}</p>
              <div className="flex flex-col gap-0.5">
                {item.children.map((sub) => (
                  <NavLink
                    key={sub.to}
                    to={sub.to}
                    end={sub.end}
                    onClick={onNavigate}
                    className={({ isActive }) => `${drawerLinkClass(isActive, true)} gap-3 items-center rounded-lg`}
                  >
                    <span className="material-symbols-outlined text-[22px]" aria-hidden>
                      {itemIcon(sub)}
                    </span>
                    {sub.label}
                  </NavLink>
                ))}
              </div>
            </div>
          );
        }
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) => `${drawerLinkClass(isActive, true)} gap-3 items-center rounded-lg`}
          >
            <span className="material-symbols-outlined text-[22px]" aria-hidden>
              {itemIcon(item)}
            </span>
            {item.label}
          </NavLink>
        );
      })}
    </nav>
  );
}

/**
 * Shell autenticado: minidrawer (rail + gaveta) + área principal clara.
 */
export function AppShell({
  navItems = [],
  title,
  subtitle,
  headerActions,
  /** Conteúdo logo abaixo do título (ex.: tabs de governança), sem scroll separado. */
  headerTabs = null,
  /** Substitui o padding horizontal/vertical padrão do `<main>`. */
  mainClassName,
  /** Substitui o invólucro branco (card) por classes próprias; omitir = padrão. */
  contentClassName,
  children,
}) {
  const { session, profile, isAdmin } = useAuth();
  const userId = session?.user?.id ?? '';
  const drawerKey = useMemo(() => (userId ? `${LS_DRAWER}__${userId}` : LS_DRAWER), [userId]);
  const groupKey = useMemo(() => (userId ? `${LS_GROUP_EXPAND}__${userId}` : LS_GROUP_EXPAND), [userId]);

  const email = session?.user?.email || '';
  const footerName = profile?.full_name?.trim() || email.split('@')[0] || 'Usuário';
  const footerInitial = (footerName[0] || '?').toUpperCase();
  const footerRole = isAdmin ? 'Administrador' : 'Usuário';
  const drawerOpen = useStore(uiShellStore, (s) => s.drawerOpen);
  const expandedGroups = useStore(uiShellStore, (s) => s.expandedGroups);
  const mobileOpen = useStore(uiShellStore, (s) => s.mobileOpen);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      hydrateDrawerOpen(window.localStorage.getItem(drawerKey) !== '0');
    } catch {
      hydrateDrawerOpen(true);
    }
  }, [drawerKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      hydrateExpandedGroups(JSON.parse(window.localStorage.getItem(groupKey) || '{}'));
    } catch {
      hydrateExpandedGroups({});
    }
  }, [groupKey]);

  const isGroupExpanded = (label) => expandedGroups[label] !== false;
  const toggleGroup = (label) => {
    setExpandedGroups((prev) => {
      const cur = prev[label] !== false;
      return { ...prev, [label]: !cur };
    });
  };

  useEffect(() => {
    try {
      window.localStorage.setItem(drawerKey, drawerOpen ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [drawerKey, drawerOpen]);

  useEffect(() => {
    try {
      window.localStorage.setItem(groupKey, JSON.stringify(expandedGroups));
    } catch {
      /* ignore */
    }
  }, [groupKey, expandedGroups]);

  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  const closeMobile = () => setMobileOpen(false);

  const contentShellDefault =
    'flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden rounded-2xl bg-white shadow-[0_4px_24px_rgba(15,23,42,0.06)]';
  const contentShell = contentClassName?.trim() ? contentClassName : contentShellDefault;
  const mainBase =
    'min-h-0 w-full min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-[#f8fafc]';
  const mainPadDefault = 'px-5 py-4 sm:px-6 sm:py-5 lg:px-8';
  const mainContentPad = mainClassName !== undefined && mainClassName !== null ? mainClassName : mainPadDefault;

  /** Desktop: só largura rail + gaveta — sidebar colada à margem esquerda (sem gap). */
  const mainColumnOffset = drawerOpen ? 'lg:pl-[calc(3.25rem+14rem)]' : 'lg:pl-[3.25rem]';

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-[#f1f5f9] text-on-surface">
      <AppShellTopBar onOpenMobileNav={() => setMobileOpen(true)} />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:flex-row">
        <div
          className="pointer-events-none fixed left-0 z-40 hidden h-[calc(100%-3.5rem)] lg:block"
          style={{ top: '3.5rem' }}
        >
          <div className="relative h-full w-max min-h-0">
            <DesktopSidebar
              navItems={navItems}
              drawerOpen={drawerOpen}
              isGroupExpanded={isGroupExpanded}
              toggleGroup={toggleGroup}
            />
            <button
              type="button"
              onClick={() => setDrawerOpen((d) => !d)}
              className="pointer-events-auto absolute left-full top-2 z-[45] flex h-7 w-7 -translate-x-1/2 items-center justify-center rounded-full bg-tertiary text-primary shadow-[0_2px_10px_rgba(34,197,94,0.4)] ring-1 ring-white/50 transition hover:brightness-110 hover:ring-white/70"
              aria-expanded={drawerOpen}
              aria-label={drawerOpen ? 'Recolher menu de nomes' : 'Expandir menu de nomes'}
            >
              <span className="material-symbols-outlined text-[18px] leading-none font-bold">
                {drawerOpen ? 'chevron_left' : 'chevron_right'}
              </span>
            </button>
          </div>
        </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-[90] lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" className="absolute inset-0 bg-black/50" aria-label="Fechar menu" onClick={closeMobile} />
          <div className="sidebar-scrollbar absolute left-0 top-0 flex h-full w-[min(100%,20rem)] flex-col overflow-y-auto bg-[#1a344d] shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
              <span className="text-sm font-black uppercase tracking-widest text-white/90">Menu</span>
              <button type="button" onClick={closeMobile} className="p-2 text-white" aria-label="Fechar">
                <span className="material-symbols-outlined text-[24px]">close</span>
              </button>
            </div>
            <div className="min-h-0 flex-1 px-1 py-2">
              <MobileDrawerNav
                navItems={navItems}
                onNavigate={closeMobile}
                isGroupExpanded={isGroupExpanded}
                toggleGroup={toggleGroup}
              />
            </div>
            <div className="shrink-0 border-t border-white/10 p-3">
              <div className="flex gap-3">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-tertiary/25 text-sm font-bold text-white ring-2 ring-white/10"
                  aria-hidden
                >
                  {footerInitial}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">{footerName}</p>
                  <p className="mt-0.5 truncate text-xs text-white/50">{footerRole}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

        <div
          className={`flex min-h-0 min-w-0 w-full flex-1 flex-col pl-1.5 pt-1.5 pr-1.5 pb-1.5 transition-[padding] duration-200 ease-out sm:pl-2 sm:pt-2 sm:pr-2 sm:pb-2 lg:pt-2 lg:pr-2 lg:pb-2 ${mainColumnOffset}`}
        >
          <div className={contentShell}>
            <header className="z-30 shrink-0 border-b border-slate-100 bg-white px-5 py-3 sm:px-6 sm:py-3.5 lg:px-7">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  {title ? <h1 className="text-lg font-bold tracking-tight text-[#0b1622] sm:text-xl">{title}</h1> : null}
                  {subtitle ? <p className="mt-0.5 max-w-2xl break-words text-sm leading-snug text-slate-600">{subtitle}</p> : null}
                </div>
                {headerActions ? <div className="flex shrink-0 flex-wrap items-center gap-1.5">{headerActions}</div> : null}
              </div>
              {headerTabs ? <div className="mt-3 min-w-0 border-t border-slate-100 pt-2.5">{headerTabs}</div> : null}
            </header>
            <main className={`${mainBase} ${mainContentPad}`}>
              {children}
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}
