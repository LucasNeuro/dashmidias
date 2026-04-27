/**
 * Preferências por usuário em sessionStorage (isoladas por sessão de login).
 * Útil para cache de UI sem misturar contas no mesmo browser.
 */
const PREFIX = 'hub_user_sess_v1__';

function key(userId) {
  return `${PREFIX}${userId || 'anon'}`;
}

/**
 * @param {string | undefined} userId
 * @param {string} prefKey
 * @returns {unknown}
 */
export function getUserSessionPref(userId, prefKey) {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(key(userId));
    if (!raw) return null;
    const j = JSON.parse(raw);
    return j && typeof j === 'object' ? j[prefKey] ?? null : null;
  } catch {
    return null;
  }
}

/**
 * @param {string | undefined} userId
 * @param {string} prefKey
 * @param {unknown} value
 */
export function setUserSessionPref(userId, prefKey, value) {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.sessionStorage.getItem(key(userId));
    const j = raw ? JSON.parse(raw) : {};
    const next = { ...(typeof j === 'object' && j ? j : {}), [prefKey]: value };
    window.sessionStorage.setItem(key(userId), JSON.stringify(next));
  } catch {
    /* ignore */
  }
}
