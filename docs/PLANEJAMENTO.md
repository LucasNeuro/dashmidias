# Obra10+ HUB — Planejamento de desenvolvimento

Este documento organiza **como** construir o sistema em etapas, alinhado ao [SPEC.md](./SPEC.md) e ao PRD Obra10+. Stack: **React** (frontend), **Supabase** (PostgreSQL, Auth, RLS, Storage, Realtime se necessário), **poucas Edge Functions/APIs** para o que não pode ficar no cliente.

**Por onde começar na prática:** [FLUXO_INICIO_DESENVOLVIMENTO.md](./FLUXO_INICIO_DESENVOLVIMENTO.md) · **Arquitetura:** [ARQUITETURA.md](./ARQUITETURA.md) · **Tabelas v0:** [SCHEMA_DADOS_V0.md](./SCHEMA_DADOS_V0.md)

---

## 1. Objetivos do planejamento

- Entregar valor **incremental** sem perder o fio condutor: **`ID_NEGOCIO`** e **eventos**.
- Manter **uma base central** desde o primeiro marco (evitar “sistemas colados”).
- Reduzir superfície de risco: **RLS e servidor** para dinheiro, webhooks e segredos.
- Documentar **milestones verificáveis** e ordem sugerida de trabalho.

---

## 2. Fases (alinhamento ao PRD)

### Fase 1 — Fundação e operação mínima viável

**Meta:** core de dados, CRM central, pipeline, entradas (manual + preparação para tráfego), contratos vinculados ao negócio, módulos **básicos** (imobiliário para **imobiliárias parceiras** como tenants, arquitetura, engenharia/obras), **financeiro básico** (modelagem + fluxos simples; escrow/multisplit podem começar como estados e regras documentadas antes do PSP definitivo).

**Entregáveis conceituais:**

- Pessoa, Empresa, Usuário (Auth), Negócio, Pipeline/estágios
- Lead / oportunidade com **origem** (manual primeiro; campos prontos para UTM/campanha)
- Opcional cedo: **ingestão WhatsApp** em paralelo ao legado (ex.: Pipedrive) — ver [GUIA_CAPTACAO_WHATSAPP_UAZAPI.md](./GUIA_CAPTACAO_WHATSAPP_UAZAPI.md)
- Vínculo negócio ↔ imóvel / projeto / obra (tanto faz começar com 1–2 tipos; schema extensível)
- **Negócio** como centro com **portas de entrada** na **imobiliária parceira** e no **escritório de arquitetura** (e outras); ver [SPEC.md §3.2](./SPEC.md)
- **Fornecedores (MVP):** cadastro **induzido** pelo **arquiteto** e pela **organização** (admin/permissão); vínculo a negócio/projeto — **sem** depender de self-service do fornecedor no primeiro corte (ver [SPEC.md §3.3](./SPEC.md))
- Contratos ligados ao negócio
- Tabela (ou equivalente) de **eventos de domínio** mínima
- RLS por organização / papel (primeira versão pode ser simples, mas **obrigatória** em dados sensíveis)
- React: shell da app, auth, listagem/detalhe de negócio, pipeline básico

### Fase 2 — Rede, cliente e governança ampliada

**Meta:** **rede de fornecedores** com **cadastro autônomo** e **homologação** digital (evolução do MVP em que o fornecedor foi cadastrado só por arquiteto/org), portal do **cliente final**, auditoria e relatórios mais ricos, integrações de ads **prioritárias** (uma de cada família se possível: Meta / Google / LinkedIn).

### Fase 3 — Escala, automação e inteligência

**Meta:** onboarding digital completo, automações, recomendações/IA, expansão dos módulos, analytics avançado (warehouse ou réplica de leitura, conforme volume).

---

## 3. Marcos sugeridos (Fase 1 detalhada)

Ordem **sugerida**; ajustar conforme prioridade do negócio (ex.: imobiliário primeiro vs arquitetura primeiro).

| # | Marco | Resultado verificável |
|---|--------|------------------------|
| M1 | Projeto e ambientes | Repositório React + projeto Supabase; variáveis de ambiente; deploy opcional do front |
| M2 | Auth e organizações | Login; usuário pertence a empresa/organização; papel mínimo (ex.: admin org vs membro) |
| M3 | Schema core v0 | Tabelas: `pessoas`, `empresas`, `negocios`, `pipeline_stages` (ou normalizado), FKs e índices básicos |
| M4 | RLS v0 | Policies: usuário só lê/escreve dados da(s) sua(s) organização(ões); revisão manual com checklist |
| M5 | CRM entrada manual | Criar lead/oportunidade; converter ou associar a **negócio**; histórico básico |
| M6 | Pipeline | Mudança de estágio; datas; responsável; eventos `LEAD_QUALIFICADO`, `PROPOSTA_ENVIADA`, `NEGOCIO_FECHADO` (registro) |
| M7 | Imóvel básico | Cadastro imóvel; relação com negócio; lista para imobiliária/corretor |
| M8 | Contratos v0 | Contrato vinculado ao negócio; status; upload Storage se aplicável; evento `CONTRATO_ASSINADO` (manual ou integração futura) |
| M9 | Projeto / obra básicos | Entidades mínimas + vínculo ao negócio; telas simples; eventos `PROJETO_INICIADO`, `ETAPA_CONCLUIDA` (opcional neste marco) |
| M10 | Eventos consolidados | `domain_events` populados nas ações principais; página ou query de linha do tempo por negócio |
| M11 | Financeiro básico | Pagamentos vinculados ao negócio; estados (registrado / retido / liberado); sem necessidade de PSP completo no primeiro dia |
| M12 | Edge Function #1 | Ex.: webhook que recebe payload de formulário/ads **ou WhatsApp (uazapi)** (stub ou provedor real) e cria oportunidade com metadados de origem — detalhes no [GUIA_CAPTACAO_WHATSAPP_UAZAPI.md](./GUIA_CAPTACAO_WHATSAPP_UAZAPI.md) |

**Definição de “Fase 1 pronta” para time:** M1–M11 concluídos com checklist de segurança RLS; M12 ou integração real equivalente planejada na Fase 2 se ads/WhatsApp não forem prioridade no primeiro corte.

---

## 4. Estratégia de APIs (poucas, propositalmente)

| Necessidade | Onde implementar |
|-------------|------------------|
| CRUD autenticado multi-tenant | **Postgres + RLS**; React com **Supabase client** |
| Upload de arquivos | **Supabase Storage** + policies |
| Webhook Meta/Google/LinkedIn | **Edge Function** (validação de assinatura, normalização, idempotência) |
| Webhook **WhatsApp (uazapi)** | **Edge Function** → Postgres; tokens só servidor; `excludeMessages: ["wasSentByApi"]` se houver respostas automáticas pela API — [GUIA_CAPTACAO_WHATSAPP_UAZAPI.md](./GUIA_CAPTACAO_WHATSAPP_UAZAPI.md) |
| Pagamentos / escrow com segredo | **Edge Function** + integração PSP; **nunca** chave no React |
| Jobs (lembretes, sincronização) | Edge Functions agendadas ou serviço futuro |

**Dívida técnica aceitável no início:** alguns processos disparados manualmente ou por SQL controlado, desde que **eventos** e **vínculo ao negócio** já existam.

---

## 5. Modelagem e migrations

- Versionar schema com **migrations** Supabase (CLI), commits pequenos.
- Convenções de nome: português ou inglês **consistente** em todo o projeto (escolher uma e documentar no SPEC ou ADR).
- Toda tabela multi-tenant: coluna `organization_id` (ou equivalente) + RLS.
- **Negócio:** chave estrangeira explícita em entidades filhas quando fizer sentido; para N:N usar tabelas de junção.

---

## 6. Frontend (React)

- Estrutura por **domínio** (crm, negocios, imoveis, contratos) ou feature folders — decidir no M1 e registrar em ADR curto.
- Estado servidor: TanStack Query (ou similar) + Supabase; evitar duplicar fonte da verdade.
- Design system leve no início (componentes reutilizáveis para formulários, tabelas, pipeline).

---

## 7. Auditoria e financeiro (lembranças de planejamento)

- **Operação** pode avançar com UX por perfil; **pagamento liberado** exige regra + trilha (evento + estado).
- Auditoria Fase 1 pode ser **leitura de eventos + relatórios simples**; Fase 2 amplia painéis e alertas.
- Escrow/multisplit: na Fase 1, modelar **estados e partes**; integração real com provedor quando houver definição jurídica/operacional.

---

## 8. Riscos e mitigação

| Risco | Mitigação |
|-------|-----------|
| RLS incorreta (vazamento de dados) | Checklist por release; testes com dois usuários/organizações; revisão de policies |
| Escopo creep (“só mais um módulo”) | SPEC + este plano; tudo novo entra como item de Fase 2/3 ou sprint seguinte |
| Eventos esquecidos | Code review com pergunta: “gera `domain_event`?” |
| Dependência de integrações ads | Campos de origem no schema desde M5; webhook depois |
| Complexidade fiscal | Separar “registro operacional” de “regras contábeis”; consultoria externa quando necessário |

---

## 9. Próximos artefatos recomendados em `docs/`

| Arquivo | Conteúdo |
|---------|----------|
| [FLUXO_INICIO_DESENVOLVIMENTO.md](./FLUXO_INICIO_DESENVOLVIMENTO.md) | Ordem ideal: schema + RLS → React → integrações |
| [ARQUITETURA.md](./ARQUITETURA.md) | Camadas, diagrama, fluxos, segurança, bounded contexts |
| [SCHEMA_DADOS_V0.md](./SCHEMA_DADOS_V0.md) | Tabelas e colunas v0 (`negocios`, `domain_events`, etc.) |
| [GUIA_CAPTACAO_WHATSAPP_UAZAPI.md](./GUIA_CAPTACAO_WHATSAPP_UAZAPI.md) | Fluxo paralelo IA/Pipedrive + ingestão Supabase; uazapi, webhooks, idempotência |
| [EVENTOS_SERVICO_E_FINTECH.md](./EVENTOS_SERVICO_E_FINTECH.md) | Serviço de `domain_events`, cadeia PRD, payloads, produtores, **webhooks fintech** |
| `RLS.md` | Políticas por tabela; exemplos de teste |
| `adr/0001-template.md` | Decisões (template + ADRs reais) |

---

## 10. Como usar este plano no dia a dia

1. **Sprint:** escolher 1–2 marcos ou fatias deles.
2. **Antes de codar:** atualizar SPEC se mudar regra de negócio.
3. **Depois de feature:** garantir evento + RLS + critério de aceite marcado.
4. **Revisão de segurança:** roteiro rápido em cada PR que toque em dados (§8).

---

*Documento vivo. Atualizar datas, owners e status dos marcos conforme o time avança.*
