import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL || '';
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

/** Uma única instância por aba — evita GoTrueClient duplicado (spam no console e comportamento estranho). */
let supabaseSingleton = null;

export function isSupabaseConfigured() {
  if (!url || !key) return false;
  if (url.includes('seu-projeto') || url.includes('SUBSTITUA')) return false;
  if (key.includes('SUBSTITUA') || key.length < 20) return false;
  return true;
}

export function getSupabase() {
  if (!isSupabaseConfigured()) return null;
  if (!supabaseSingleton) {
    supabaseSingleton = createClient(url, key);
  }
  return supabaseSingleton;
}

export function getReportSlug() {
  return import.meta.env.VITE_REPORT_SLUG || 'obra10-2025-12-2026-02';
}
