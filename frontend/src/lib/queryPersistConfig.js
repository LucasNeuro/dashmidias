import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

export const QUERY_CACHE_STORAGE_KEY = 'obra10_hub_query_cache_v1';

/** Persister síncrono (localStorage) para o TanStack Query — cache sobrevive a recargas. */
/** Escrita no localStorage é síncrona e pode travar a UI se o cache for grande; espaçamos gravações. */
const PERSIST_THROTTLE_MS = 4000;

export function createAppQueryPersister() {
  return createSyncStoragePersister({
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    key: QUERY_CACHE_STORAGE_KEY,
    throttleTime: PERSIST_THROTTLE_MS,
  });
}

/**
 * Só persistimos chaves sem dados sensíveis de auditoria (evita dumps grandes / PII em disco).
 * @param {{ queryKey: unknown[] }} query
 */
export function shouldPersistQuery(query) {
  const k = query.queryKey;
  if (!Array.isArray(k) || k.length === 0) return false;
  const [root, section] = k;
  if (root === 'registration_form_templates' || root === 'registration_form_template') return true;
  if (root === 'governance') {
    if (section === 'audit') return false;
    return typeof section === 'string';
  }
  return false;
}
