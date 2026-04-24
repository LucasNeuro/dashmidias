-- =============================================================================
-- Corrige erro 23505 ao criar hub_partner_org_signups_one_pending_per_doc
-- -----------------------------------------------------------------------------
-- Quando já existem dois (ou mais) pedidos PENDENTES com o mesmo CNPJ/CPF
-- (coluna cnpj), o índice único não pode ser criado.
--
-- Este script mantém apenas o pedido mais recente por documento e marca os
-- duplicados como rejeitado (preserva linhas para auditoria).
--
-- Ordem sugerida:
--   1) Executar ESTE ficheiro
--   2) Executar de novo o trecho CREATE INDEX em hub_partner_org_signup_public_rpc.sql
--      (ou o ficheiro completo, se preferir)
-- =============================================================================

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY cnpj
      ORDER BY criado_em DESC
    ) AS rn
  FROM public.hub_partner_org_signups
  WHERE status = 'pendente'
)
UPDATE public.hub_partner_org_signups s
SET status = 'rejeitado'
FROM ranked r
WHERE s.id = r.id
  AND r.rn > 1;

-- Opcional: verificar se ainda há duplicados pendentes (deve devolver 0 linhas)
-- SELECT cnpj, count(*) FROM hub_partner_org_signups WHERE status = 'pendente' GROUP BY cnpj HAVING count(*) > 1;
