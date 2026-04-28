/** Quando Supabase não está configurado ou a tabela ainda não existe (dev). Alinhar a hub_lead_segment. */
export const FALLBACK_LEAD_SEGMENTS = [
  { slug: 'parceiro', label: 'PARCEIRO', description: '', sort_order: 10 },
  { slug: 'cliente', label: 'CLIENTE', description: '', sort_order: 20 },
  { slug: 'imovel', label: 'IMOVEL', description: '', sort_order: 30 },
];
