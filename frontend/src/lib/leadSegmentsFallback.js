/** Quando Supabase não está configurado ou a tabela ainda não existe (dev). */
export const FALLBACK_LEAD_SEGMENTS = [
  { slug: 'projeto', label: 'Projeto de arquitetura / interiores', description: '', sort_order: 10 },
  { slug: 'imovel', label: 'Imóvel', description: '', sort_order: 20 },
  { slug: 'obra-reforma', label: 'Obra ou reforma', description: '', sort_order: 30 },
  { slug: 'outro', label: 'Outro', description: '', sort_order: 90 },
];
