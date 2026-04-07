-- =============================================================================
-- Atualiza TODOS os registros em public.reports + campanhas ligadas à janela
-- 2025-11-01 → 2026-03-31 (útil quando o slug na Vercel não bate com o único
-- relatório que você editou, ou há vários relatórios).
--
-- Rode no SQL Editor do Supabase do ambiente de PRODUÇÃO (igual à Vercel).
-- =============================================================================

do $$
declare
  v_start date := date '2025-11-01';
  v_end date := date '2026-03-31';
  r record;
begin
  for r in select id, slug from public.reports
  loop
    update public.reports
    set
      period_start = v_start,
      period_end = v_end,
      period_range_label = '01 Nov 2025 — 31 Mar 2026',
      cycle_label = 'Ciclo operacional: nov/2025 – mar/2026'
    where id = r.id;

    update public.campaigns c
    set
      started_at = (sub.s)::date,
      ended_at = (sub.e)::date
    from (
      select
        id as cid,
        v_start + ((abs(hashtext(id::text))) % 85) as s,
        least(
          v_end,
          greatest(
            v_start + ((abs(hashtext(id::text))) % 85) + 14,
            v_start + ((abs(hashtext(id::text))) % 85) + 25 + ((abs(hashtext(id::text || 'X'))) % 95)
          )
        ) as e
      from public.campaigns
      where report_id = r.id
    ) sub
    where c.id = sub.cid;

    update public.campaigns
    set ended_at = least(v_end, started_at + 45)
    where report_id = r.id
      and (ended_at is null or started_at is null or ended_at < started_at);

    raise notice 'OK report % (%) período % → %', r.slug, r.id, v_start, v_end;
  end loop;
end $$;
