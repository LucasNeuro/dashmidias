-- =============================================================================
-- Período nov/2025 → mar/2026 + datas de campanhas alinhadas (overlap com filtro)
--
-- Ajuste v_slug se necessário (deve bater com VITE_REPORT_SLUG do .env).
-- Rode no SQL Editor do Supabase.
-- =============================================================================

do $$
declare
  v_slug text := 'obra10-2025-12-2026-02';
  v_report uuid;
  v_start date := date '2025-11-01';
  v_end date := date '2026-03-31';
begin
  select id into v_report from public.reports where slug = v_slug limit 1;

  if v_report is null then
    raise exception 'Relatório não encontrado: slug = %. Troque v_slug no script.', v_slug;
  end if;

  update public.reports
  set
    period_start = v_start,
    period_end = v_end,
    period_range_label = '01 Nov 2025 — 31 Mar 2026',
    cycle_label = 'Ciclo operacional: nov/2025 – mar/2026'
  where id = v_report;

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
    where report_id = v_report
  ) sub
  where c.id = sub.cid;

  update public.campaigns
  set ended_at = least(v_end, started_at + 45)
  where report_id = v_report
    and (ended_at is null or started_at is null or ended_at < started_at);

  raise notice 'OK: relatório % (%) período % → %', v_slug, v_report, v_start, v_end;
end $$;
