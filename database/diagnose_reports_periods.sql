-- Rode no SQL Editor do Supabase (o MESMO projeto da URL em VITE_SUPABASE_URL na Vercel).
-- Mostra qual relatório existe e o intervalo real das campanhas.

select
  r.id,
  r.slug,
  r.period_start,
  r.period_end,
  count(c.id) as qtd_campanhas,
  min(c.started_at) as primeira_campanha_inicio,
  max(c.ended_at) as ultima_campanha_fim
from public.reports r
left join public.campaigns c on c.report_id = r.id
group by r.id, r.slug, r.period_start, r.period_end
order by r.created_at desc nulls last;
