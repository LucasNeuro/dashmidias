import { Store } from '@tanstack/store';

/**
 * Estado global da shell autenticada (gaveta, grupos do menu, menu mobile).
 * Persistência em localStorage fica no AppShell, por chave por usuário.
 */
export const uiShellStore = new Store({
  drawerOpen: true,
  /** @type {Record<string, boolean>} */
  expandedGroups: {},
  mobileOpen: false,
});

export function setDrawerOpen(updater) {
  uiShellStore.setState((s) => ({
    ...s,
    drawerOpen: typeof updater === 'function' ? updater(s.drawerOpen) : updater,
  }));
}

export function setMobileOpen(updater) {
  uiShellStore.setState((s) => ({
    ...s,
    mobileOpen: typeof updater === 'function' ? updater(s.mobileOpen) : updater,
  }));
}

export function setExpandedGroups(updater) {
  uiShellStore.setState((s) => ({
    ...s,
    expandedGroups: typeof updater === 'function' ? updater(s.expandedGroups) : updater,
  }));
}

/** @param {Record<string, boolean>} groups */
export function hydrateExpandedGroups(groups) {
  uiShellStore.setState((s) => ({ ...s, expandedGroups: { ...groups } }));
}

export function hydrateDrawerOpen(open) {
  uiShellStore.setState((s) => ({ ...s, drawerOpen: open }));
}
