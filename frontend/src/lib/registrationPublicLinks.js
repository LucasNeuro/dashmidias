/**
 * Entrada pública de cadastro (HashRouter: partilhar URL com #).
 */

export const PRIMARY_REGISTRATION_INTAKE_PATH = '/cadastro';

export function getPrimaryRegistrationIntakePublicUrl() {
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}/#${PRIMARY_REGISTRATION_INTAKE_PATH}`;
}
