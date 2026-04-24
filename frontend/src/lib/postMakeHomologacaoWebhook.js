/**
 * Notifica Make (Integromat) após cadastro público de organização.
 * Defina `VITE_MAKE_HOMOLOGACAO_WEBHOOK_URL` no `.env` (local e Render).
 * O URL fica exposto no bundle do cliente — use um webhook dedicado e rotações se necessário.
 *
 * @param {Record<string, unknown>} payload
 */
export function postMakeHomologacaoWebhook(payload) {
  const url = import.meta.env.VITE_MAKE_HOMOLOGACAO_WEBHOOK_URL;
  const u = typeof url === 'string' ? url.trim() : '';
  if (!u) return;
  void fetch(u, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, event: 'homologacao_org_signup', at: new Date().toISOString() }),
    mode: 'cors',
  }).catch(() => {});
}

/** URL completa (HashRouter) para partilhar com automações. */
export function buildHomologacaoTrackingPageUrl(codigoRastreio) {
  const c = String(codigoRastreio || '').trim();
  if (typeof window === 'undefined' || !c) return '';
  const { origin, pathname } = window.location;
  const p = pathname.endsWith('/') && pathname !== '/' ? pathname.slice(0, -1) : pathname;
  return `${origin}${p}#/homologacao/organizacao?codigo=${encodeURIComponent(c)}`;
}
