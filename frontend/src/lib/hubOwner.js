/**
 * E-mail do responsável final por aprovar solicitações de admin HUB (opcional).
 * Defina em VITE_HUB_OWNER_EMAIL — nunca commite valores reais em repositório público.
 */
export function getHubOwnerEmail() {
  const v = import.meta.env.VITE_HUB_OWNER_EMAIL;
  return typeof v === 'string' && v.trim() ? v.trim().toLowerCase() : '';
}

export function isHubOwnerEmail(email) {
  const owner = getHubOwnerEmail();
  if (!owner) return false;
  return typeof email === 'string' && email.trim().toLowerCase() === owner;
}
