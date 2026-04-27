/**
 * Segmentos de lead (cliente final) — tabela hub_lead_segment.
 */

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @returns {Promise<Array<{ slug: string, label: string, description: string, sort_order: number }>>}
 */
export async function fetchActiveLeadSegments(supabase) {
  const { data, error } = await supabase
    .from('hub_lead_segment')
    .select('slug, label, description, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}
