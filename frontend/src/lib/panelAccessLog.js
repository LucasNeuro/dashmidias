import { getSupabase } from './supabaseClient';

/** Registra visualização do painel para auditoria (RLS: só o próprio user_id). */
export async function logPanelAccess(userId, path = '/') {
  try {
    const supabase = getSupabase();
    if (!supabase || !userId) return;
    const ua = typeof navigator !== 'undefined' ? String(navigator.userAgent).slice(0, 500) : null;
    const { error } = await supabase.from('panel_access_logs').insert({
      user_id: userId,
      path,
      user_agent: ua,
    });
    if (error) console.warn('[panel_access_logs]', error.message);
  } catch (e) {
    console.warn('[panel_access_logs]', e);
  }
}
