import { getParticipantHomePath } from './appPortal';

/**
 * Destino após login:
 * - Administradores HUB / auditoria → governança (/adm)
 * - Solicitação de admin HUB pendente → /acesso/pendente-hub
 * - Participantes → home do ambiente escolhido (Hub ou Imóveis)
 */
export function getPostLoginPath({ isHubAdmin, hubSolicitacaoPendente, portal }) {
  if (isHubAdmin) return '/adm/auditoria';
  if (hubSolicitacaoPendente) return '/acesso/pendente-hub';
  return getParticipantHomePath(portal);
}
