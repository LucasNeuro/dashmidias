-- Popular catálogo com o mesmo conteúdo que frontend/src/lib/orgStandardFields.js (ORG_BUILTIN_PARTNER_EXTRA_FIELDS).
-- Idempotente. Ordem: hub_standard_catalog.sql → hub_signup_wizard_step.sql (tabela) → este ficheiro.

insert into public.hub_standard_field_section (slug, title, sort_order, wizard_step, is_active)
values
  ('produto_servico', 'Produto / serviço', 0, 'produto_servico', true),
  ('atuacao_servicos', 'Atuação e serviços (obra / decoração)', 1, 'atuacao_servicos', true),
  ('logistica', 'Logística e doca', 2, 'logistica', true)
on conflict (slug) do nothing;

insert into public.hub_signup_wizard_step (slug, label, partition_bucket, sort_order, is_active)
values
  ('produto_servico', 'Produto / serviço', 'commercial', 0, true),
  ('atuacao_servicos', 'Atuação e serviços (obra / decoração)', 'commercial', 1, true),
  ('logistica', 'Logística e doca', 'logistics', 2, true)
on conflict (slug) do update set
  label = excluded.label,
  partition_bucket = excluded.partition_bucket,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active;

-- Campos: produto_servico
insert into public.hub_standard_field (
  section_id, field_key, label, field_type, required, options, placeholder, rows, sort_order, is_active
)
select s.id, v.field_key, v.label, v.field_type, v.required, v.options::jsonb, v.placeholder, v.rows, v.sort_order, true
from public.hub_standard_field_section s
cross join (values
  ('categoria_produto_servico', 'Categoria de produto/serviço', 'textarea', false, '[]'::text,
   'Tags de classificação — ex.: matéria-prima, EPI, manutenção predial', 4, 0),
  ('capacidade_produtiva_mensal', 'Capacidade produtiva mensal', 'text', false, '[]'::text,
   'Unidades, toneladas ou horas que entrega por mês', null, 1),
  ('moq_pedido_minimo', 'Quantidade mínima de pedido (MOQ)', 'text', false, '[]'::text,
   'Menor lote que aceitam vender', null, 2),
  ('portfolio_catalogo', 'Portfólio / catálogo', 'url', false, '[]'::text,
   'Link (drive, site ou PDF) com a lista de produtos', null, 3)
) as v(field_key, label, field_type, required, options, placeholder, rows, sort_order)
where s.slug = 'produto_servico'
on conflict (field_key) do nothing;

-- atuacao_servicos
insert into public.hub_standard_field (
  section_id, field_key, label, field_type, required, options, placeholder, rows, sort_order, is_active
)
select s.id, v.field_key, v.label, v.field_type, v.required, v.options::jsonb, v.placeholder, v.rows, v.sort_order, true
from public.hub_standard_field_section s
cross join (values
  ('ramo_atuacao_principal', 'Ramo de atuação principal', 'text', false, '[]'::text,
   'Ex.: marmorista, gesseiro, designer de interiores, pedreiro de acabamento', null, 0),
  ('servicos_realizados', 'Serviços realizados', 'textarea', false, '[]'::text,
   'Sub-especialidades — ex.: instalação de cubas esculpidas, assentamento de grandes formatos, pintura técnica', 4, 1),
  ('registro_profissional', 'Registro profissional', 'text', false, '[]'::text,
   'Ex.: CAU (arquitetos), CREA (engenheiros ou técnicos)', null, 2),
  ('portfolio_obras_midia', 'Portfólio / fotos de obras', 'url', false, '[]'::text,
   'Instagram, site, pasta em nuvem (Drive, etc.)', null, 3),
  ('equipamentos_proprios', 'Equipamentos próprios', 'textarea', false, '[]'::text,
   'Ex.: andaimes, laser, máquinas de corte — o que dispõem para execução', 3, 4)
) as v(field_key, label, field_type, required, options, placeholder, rows, sort_order)
where s.slug = 'atuacao_servicos'
on conflict (field_key) do nothing;

-- logistica (select com opções JSON)
insert into public.hub_standard_field (
  section_id, field_key, label, field_type, required, options, placeholder, rows, sort_order, is_active
)
select s.id, v.field_key, v.label, v.field_type, v.required, v.options::jsonb, v.placeholder, v.rows, v.sort_order, true
from public.hub_standard_field_section s
cross join (values
  ('modalidade_frete_padrao', 'Modalidade de frete padrão', 'select', false,
   '["CIF (fornecedor paga o frete)", "FOB (comprador paga o frete)"]'::text, '', null, 0),
  ('transportadoras_homologadas', 'Transportadoras homologadas', 'textarea', false, '[]'::text,
   'Transportadoras que costuma utilizar', 3, 1),
  ('horario_recebimento_doca', 'Horário de recebimento (doca)', 'text', false, '[]'::text,
   'Ex.: 08:00 às 17:00', null, 2),
  ('horario_expedicao_coleta', 'Horário de expedição / coleta', 'text', false, '[]'::text,
   'Quando a mercadoria está pronta para sair', null, 3),
  ('horario_cutoff', 'Horário de cut-off (hora limite)', 'text', false, '[]'::text,
   'Até que horas o pedido conta no prazo do dia', null, 4),
  ('janelas_agendamento', 'Janelas de agendamento', 'textarea', false, '[]'::text,
   'Marcação prévia ou ordem de chegada', 3, 5),
  ('intervalos_pausa', 'Intervalos de pausa', 'textarea', false, '[]'::text,
   'Almoço, troca de turno, etc.', 3, 6),
  ('restricoes_veiculo', 'Restrições de veículo', 'textarea', false, '[]'::text,
   'Ex.: só VUC, bitrem não entra, altura máxima 4 m', 3, 7),
  ('tempo_medio_carga_descarga', 'Tempo médio de carga/descarga', 'text', false, '[]'::text,
   'Tempo médio do veículo parado na doca', null, 8)
) as v(field_key, label, field_type, required, options, placeholder, rows, sort_order)
where s.slug = 'logistica'
on conflict (field_key) do nothing;
