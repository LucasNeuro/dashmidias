-- Permite gravar leads sem segmento CRM (opcional nos modelos de captura).
-- Em seguida, rode o script actualizado hub_submit_public_lead.sql (a RPC passa a aceitar segmento em branco).

alter table public.hub_public_leads
  alter column segment_slug drop not null;
