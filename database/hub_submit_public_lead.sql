-- RPC pública: registo de lead (cliente final); segmento opcional.

create or replace function public.hub_submit_public_lead(
  p_segment_slug text,
  p_nome text,
  p_email text,
  p_telefone text default null,
  p_cpf text default null,
  p_dados_formulario jsonb default '{}'::jsonb,
  p_template_id text default null,
  p_flow_slug text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_seg text := nullif(lower(trim(coalesce(p_segment_slug, ''))), '');
  v_nome text := trim(coalesce(p_nome, ''));
  v_email text := lower(trim(coalesce(p_email, '')));
  v_tel text := nullif(trim(coalesce(p_telefone, '')), '');
  v_tel_digits text := regexp_replace(trim(coalesce(p_telefone, '')), '\D', '', 'g');
  v_email_domain text := split_part(lower(trim(coalesce(p_email, ''))), '@', 2);
  v_cpf text := nullif(regexp_replace(trim(coalesce(p_cpf, '')), '\D', '', 'g'), '');
  v_id uuid;
begin
  if v_seg is not null and not exists (
    select 1 from public.hub_lead_segment s where s.slug = v_seg and s.is_active = true
  ) then
    return jsonb_build_object('ok', false, 'error', 'invalid_segment');
  end if;

  if length(v_nome) < 2 then
    return jsonb_build_object('ok', false, 'error', 'nome_invalid');
  end if;

  if v_email = '' or v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return jsonb_build_object('ok', false, 'error', 'email_invalid');
  end if;

  if v_email_domain in (
    'test.com',
    'teste.com',
    'fake.com',
    'example.com',
    'example.net',
    'example.org',
    'mailinator.com',
    'mailinator.net',
    'mailinator.org',
    'yopmail.com',
    'yopmail.net',
    'yopmail.fr',
    'tempmail.com',
    'temp-mail.org',
    'temp-mail.ru',
    'guerrillamail.com',
    'guerrillamail.net',
    'guerrillamail.org',
    '10minutemail.com'
  ) then
    return jsonb_build_object('ok', false, 'error', 'email_disposable');
  end if;

  if v_tel is null or length(v_tel_digits) < 10 then
    return jsonb_build_object('ok', false, 'error', 'telefone_invalid');
  end if;

  if v_cpf is not null and length(v_cpf) > 0 and length(v_cpf) <> 11 then
    return jsonb_build_object('ok', false, 'error', 'cpf_invalid');
  end if;

  if p_dados_formulario is null or jsonb_typeof(p_dados_formulario) <> 'object' then
    return jsonb_build_object('ok', false, 'error', 'dados_required');
  end if;

  insert into public.hub_public_leads (
    segment_slug,
    nome,
    email,
    telefone,
    cpf,
    dados_formulario,
    template_id,
    flow_slug,
    status
  )
  values (
    v_seg,
    v_nome,
    v_email,
    v_tel,
    case when v_cpf is null or length(v_cpf) = 0 then null else v_cpf end,
    p_dados_formulario,
    nullif(trim(p_template_id), ''),
    nullif(trim(p_flow_slug), ''),
    'novo'
  )
  returning id into v_id;

  return jsonb_build_object('ok', true, 'lead_id', v_id);
exception
  when foreign_key_violation then
    return jsonb_build_object('ok', false, 'error', 'invalid_segment');
  when others then
    return jsonb_build_object('ok', false, 'error', 'sql_error', 'detail', sqlerrm);
end;
$$;

comment on function public.hub_submit_public_lead(text, text, text, text, text, jsonb, text, text) is
  'Cadastro público de lead (PF): segment_slug opcional (null se vazio); se preenchido, valida segmento activo.';

revoke all on function public.hub_submit_public_lead(text, text, text, text, text, jsonb, text, text) from public;
grant execute on function public.hub_submit_public_lead(text, text, text, text, text, jsonb, text, text) to anon, authenticated;
