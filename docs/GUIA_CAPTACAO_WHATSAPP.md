# Guia — Captação WhatsApp  e fluxo paralelo ao Pipedrive

Este documento registra a **orientação acordada** para integrar leads vindos do WhatsApp à plataforma Obra10+ (Supabase), **sem desmontar** o fluxo atual (IA no WhatsApp → Pipedrive). É complementar ao [SPEC.md](./SPEC.md) e ao [PLANEJAMENTO.md](./PLANEJAMENTO.md).

**Referência externa:** documentação OpenAPI da uazapi — [https://docs.uazapi.com/](https://docs.uazapi.com/)

---

## 1. Contexto operacional atual


| Camada         | Situação                                 |
| -------------- | ---------------------------------------- |
| Entrada        | Leads chegam por **IA no WhatsApp**      |
| CRM legado     | Dados seguem para **Pipedrive**          |
| Plataforma HUB | Em construção — **Supabase** + **React** |


**Objetivo:** manter o fluxo da IA e o Pipedrive **como estão** no curto prazo, e adicionar um **segundo fluxo** que **espelha / acumula** capturas no banco da plataforma para virar fonte central no médio prazo.

---

## 2. Por que fluxo paralelo (e não “trocar tudo de uma vez”)

- **Menor risco:** comercial e atendimento não param.
- **Dados cedo na base única:** origem, telefone, conversa, eventos — alinhado à orientação a eventos do SPEC.
- **Transição planejada:** depois define-se se o Pipedrive vira só histórico, integração bidirecional ou é desligado.

**Trade-off consciente:** por um tempo existem **duas fontes** (Pipedrive + plataforma). É preciso regra de negócio e, se necessário, reconciliação (IDs externos, deduplicação).

---

## 3. Provedor: uazapi (WhatsApp API)

O HUB já utiliza (ou pretende utilizar) a **uazapi** como camada de API sobre instâncias WhatsApp. Pontos relevantes da API (OpenAPI):

- **Autenticação:** header `token` (instância); operações administrativas com `admintoken`.
- **Webhooks:** configuráveis por instância (`POST /webhook`, etc.) com eventos como `messages`, `messages_update`, `connection`, `leads`, entre outros.
- **CRM embutido no provedor:** endpoints de chat/lead (`/chat/editLead`, `/chat/find`, …) — útil no WhatsApp; na plataforma Obra10+ a **fonte de verdade** deve ser o **Supabase**, não duplicar processos críticos só no provedor.
- **Prevenção de loop:** a documentação recomenda `excludeMessages: ["wasSentByApi"]` em webhooks quando há automação que **envia** mensagem pela API — evita reentrada infinita de eventos.

Recomenda-se **WhatsApp Business** para integração (menos instabilidade que conta pessoal), conforme avisos da própria uazapi.

---

## 4. Arquitetura recomendada (Supabase)

```
WhatsApp (cliente) → uazapi → Webhook HTTPS → Edge Function (Supabase) → Postgres (RLS) + domain_events
```

- **Não** expor tokens uazapi no React.
- **Webhook** aponta para **Edge Function** (ou backend mínimo) que: valida payload, normaliza telefone/`wa_chatid`, aplica **idempotência**, grava tabelas e dispara evento de domínio.

### 4.1 Onde entra Make.com (ou similar)

- **Útil** para **POC** ou quando o time prefere orquestrar sem código inicial.
- **Produção:** preferir **Edge Function** direto do webhook uazapi → Supabase (menor latência, melhor auditoria, segredos centralizados, custo e RLS sob controle).
- Meio-termo aceitável: Make em homologação; produção na Function.

---

## 5. Modelagem sugerida (tabelas — conceitual)

Evitar uma única tabela “genérica” para tudo; separar responsabilidades:


| Tabela (exemplo)                               | Função                                                                                                                                 |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `channel_instances` / `whatsapp_instances`     | Liga `organization_id` à instância uazapi (metadados; **segredos** em vault/env, não em coluna aberta se possível)                     |
| `lead_captures` ou extensão de `oportunidades` | Registro de captação: `origem = whatsapp`, telefone E.164, `wa_chatid`, nome, resumo/última mensagem, `raw_payload` (jsonb) para debug |
| `whatsapp_messages` (opcional Fase 1+)         | Histórico append-only de mensagens se necessário para timeline/IA futura                                                               |
| `domain_events`                                | Ex.: `LEAD_CRIADO`, `MENSAGEM_RECEBIDA_WHATSAPP` — ver SPEC §7                                                                         |


**Negócio (`id_negocio`):** pode ser criado **depois**, na qualificação humana ou regra de negócio — não é obrigatório no primeiro webhook.

### 5.1 Idempotência e duplicidade (Pipedrive + plataforma)

- Chave natural: `**wa_chatid`** e/ou telefone normalizado (`+55...`).
- Mesmo evento ou retry do webhook **não** deve gerar segundo lead.
- Campo opcional futuro: `external_pipedrive_deal_id` (ou tabela `external_refs`) para reconciliar.

---

## 6. Eventos de domínio sugeridos


| Tipo                               | Quando                                                          |
| ---------------------------------- | --------------------------------------------------------------- |
| `LEAD_CRIADO`                      | Primeira vez que o contato vira oportunidade/lead na plataforma |
| `MENSAGEM_RECEBIDA_WHATSAPP`       | Nova mensagem inbound relevante (se política do HUB registrar)  |
| `OPORTUNIDADE_ATUALIZADA_WHATSAPP` | Mudança de estágio/atributos vindos do canal                    |


Payload mínimo: timestamp, `organization_id`, referência ao registro de lead, `wa_chatid` ou telefone, trecho de contexto (sem dados sensíveis desnecessários).

---

## 7. Configuração prática (checklist)

1. Criar Edge Function pública `POST` (URL estável) para receber webhook uazapi.
2. Na uazapi, configurar webhook da instância: eventos mínimos `**messages`**; avaliar `**leads**` conforme uso dos campos de lead da API.
3. Incluir `**excludeMessages: ["wasSentByApi"]**` se qualquer automação responder pela API ao receber mensagem.
4. Mapear `instance` / token da instância → `organization_id` no HUB (tabela de configuração).
5. Testar com ferramenta de inspeção de webhook (ex.: serviços citados na doc uazapi) antes de apontar produção.
6. Revisar **RLS**: leads e eventos só na organização correta.

---

## 8. O que não fazer neste momento (sem decisão explícita)

- Desligar IA ou Pipedrive sem plano de migração.
- Colocar **admintoken** ou **token de instância** no frontend.
- Tratar o CRM interno da uazapi como substituto do modelo **Negócio** do HUB.

---

## 9. Evolução futura

- Sincronização bidirecional Pipedrive ↔ Supabase (somente se ainda fizer sentido).
- Qualificação no React ligada a `id_negocio`.
- Consentimento / LGPD: política de retenção de mensagens e `raw_payload`.

---

*Documento vivo. Ajustar nomes de tabelas quando o schema Supabase for definido (ADR ou migration).*