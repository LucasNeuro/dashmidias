/**
 * Entrada pública: CPF → lead, CNPJ → fluxo parceiro (etapas do fluxo).
 * HashRouter: partilhar sempre a URL completa com #.
 * Slug explícito: /cadastro/fluxo/:slug (evita colisão com /cadastro/lead, etc.).
 */

/** Caminho genérico (usa o fluxo definido na configuração do site, se existir). */
export const PRIMARY_REGISTRATION_INTAKE_PATH = '/cadastro';

/** Prefixo para link direto a um fluxo por identificador (slug). */
export const REGISTRATION_FLOW_BY_SLUG_PATH = '/cadastro/fluxo';

/** Slug do fluxo mestre quando a URL não traz outro (env ou ob10-intake). */
export function defaultMasterFlowSlug() {
  return typeof import.meta !== 'undefined' && import.meta.env?.VITE_REGISTRATION_MASTER_FLOW_SLUG
    ? String(import.meta.env.VITE_REGISTRATION_MASTER_FLOW_SLUG).trim()
    : 'ob10-intake';
}

/**
 * Link público para um fluxo específico (recomendado para partilhar).
 * @param {string | null | undefined} flowSlug — valor da coluna slug em hub_registration_master_flow
 */
export function getRegistrationIntakePublicUrlForFlow(flowSlug) {
  if (typeof window === 'undefined') return '';
  const s = String(flowSlug ?? '').trim();
  if (!s) {
    return `${window.location.origin}/#${PRIMARY_REGISTRATION_INTAKE_PATH}`;
  }
  const enc = encodeURIComponent(s);
  return `${window.location.origin}/#${REGISTRATION_FLOW_BY_SLUG_PATH}/${enc}`;
}

/** Link do fluxo “principal” quando não se passa slug na URL (retrocompatível). */
export function getPrimaryRegistrationIntakePublicUrl() {
  return getRegistrationIntakePublicUrlForFlow(defaultMasterFlowSlug());
}
