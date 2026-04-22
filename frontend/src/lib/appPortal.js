/**
 * Dois ambientes na mesma app (Auth partilhado). Slugs: hub → obras/fornecedores; imoveis → imobiliário.
 */
export const PORTAL_HUB = 'hub';
export const PORTAL_IMOVEIS = 'imoveis';

const LS = 'app-portal';

export function isValidPortal(s) {
  return s === PORTAL_HUB || s === PORTAL_IMOVEIS;
}

export function getStoredPortal() {
  if (typeof window === 'undefined') return null;
  try {
    const v = window.localStorage.getItem(LS);
    return isValidPortal(v) ? v : null;
  } catch {
    return null;
  }
}

export function setStoredPortal(portal) {
  if (!isValidPortal(portal)) return;
  try {
    window.localStorage.setItem(LS, portal);
  } catch {
    /* ignore */
  }
}

/** Home após login para participantes (não admin / sem pendência de governança). Hub e Imóveis: painel de insights. */
export function getParticipantHomePath(_portal) {
  return '/painel/campanhas';
}

/** Rota de login com slug de ambiente. */
export function loginPathForPortal(portal) {
  if (!isValidPortal(portal)) return '/login';
  return `/login/${portal}`;
}
