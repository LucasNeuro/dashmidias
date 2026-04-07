# Obra10+ HUB — Especificação (SPEC)

Documento de referência para produto e engenharia. Consolida a visão do sistema central, princípios obrigatórios, entidades, eventos, módulos, fluxos e stack acordada (**Supabase** + **React**), com foco na **Fase 1** e extensões posteriores.

---

## 1. Visão do produto

### 1.1 Objetivo

Desenvolver uma **plataforma única, modular e integrada**, com um **CRM central** que conecte os mercados operados pelo HUB:

- **Imobiliário**
- **Arquitetura**
- **Serviços** (engenharia, marcenaria, marmoraria, vidraçaria, etc.)
- **Produtos**

O sistema deve funcionar como:

| Papel | Descrição |
|--------|-----------|
| CRM central multissegmentado | Entrada e gestão de oportunidades (tráfego, anúncios, cadastro manual) |
| Sistema operacional de projetos e obras | Gerenciamento e acompanhamento (com papéis distintos para executor vs HUB — ver §6.3) |
| Homologação e rede de fornecedores | Cadastro, documentos, performance, vínculo a negócios |
| Controle financeiro | Escrow, multisplit, rastreabilidade; **liberação condicionada a regras** |
| Auditoria e governança | Leitura, cruzamento de dados, conformidade, sustentação do financeiro confiável |
| Gerador de dados estruturados | Tudo o que ocorre na plataforma alimenta histórico, relatórios e inteligência futura |

### 1.2 Problema que resolve

Hoje o mercado tende a ser fragmentado: CRM separado da operação, projeto separado da obra, fornecedores desconectados, financeiro descentralizado e pouca base única para decisão. O HUB reduz **perda de controle, retrabalho, baixa previsibilidade e perda de margem**, centralizando dados e governança sem necessariamente microgerir cada execução de campo.

### 1.3 Diferencial

Não é “apenas um software de tarefas ou funil”. A lógica central é **capturar, organizar, cruzar e transformar dados operacionais e comerciais em inteligência do HUB**, com continuidade do CRM **após o fechamento** (contratos, execução, pagamentos, pós-venda).

---

## 2. Princípios obrigatórios

1. **Sistema único** — Uma plataforma com módulos especializados e base central; evitar vários sistemas conectados de forma improvisada.
2. **Base de dados centralizada** — Todos os dados convergem para uma estrutura central; cada usuário vê apenas o que sua função permite.
3. **Centro lógico: o negócio, não o projeto** — Tudo relevante deve poder vincular-se ao **`ID_NEGOCIO`**: imóvel, projeto, obra, serviço, produto, fornecedores, contratos, pagamentos, pós-venda. O negócio representa oportunidade, jornada e valor.
4. **Operação orientada a eventos** — O sistema registra **fatos** (eventos) com data/hora, responsável, contexto, histórico, relatórios e gatilhos de automação — não apenas telas isoladas.
5. **Validação não trava tudo; o financeiro sim** — Fluxo operacional pode avançar na responsabilidade de cada área; **fluxo financeiro** e **auditoria** dependem de dados confiáveis e regras explícitas.
6. **Financeiro controlado pelo sistema** — Registrar, custodiar (escrow), distribuir (multisplit) e rastrear; transações geram dados estruturados.
7. **Integração na origem com captação** — Meta, Google, LinkedIn, formulários, landing pages, cadastro manual e importações futuras, com rastreio de **origem, campanha, canal e segmento**.

---

## 3. Entidades principais (core)

Modelagem conceitual de partida; implementação física evolui no Supabase (tabelas, FKs, RLS).

| Entidade | Papel |
|----------|--------|
| **Pessoa** | Contato humano; pode ligar-se a usuário auth e a empresas |
| **Empresa** | **Imobiliária parceira** (no ecossistema HUB), escritório de arquitetura, engenharia, fornecedor, etc. |
| **Negócio** | **Aggregate comercial central** (`ID_NEGOCIO`); oportunidade e fio condutor |
| **Pipeline** | Estágios comerciais associados ao negócio (por segmento/tipo) |
| **Imóvel** | Ativo ou objeto de intermediação; relação com negócio |
| **Projeto** | Arquitetura / escopo de projeto; ligado ao negócio |
| **Obra / execução** | Fase de engenharia ou produção; ligada ao negócio |
| **Fornecedor** | Rede de execução; no **MVP**, cadastro **induzido** por arquiteto/org (§3.3); **Fase 2+**, homologação e cadastro autônomo |
| **Produto** | Item vendível; linha comercial |
| **Serviço** | Oferta de serviço (pacote ou unitário) |
| **Contrato** | Sempre vinculado ao negócio (incl. assinatura externa integrada) |
| **Avanço / entrega** | Marcos, entregáveis, evidências |
| **Pagamento** | Intenção, captura, retenção, split, liberação |
| **Pós-venda** | Acompanhamento pós-fechamento |

### 3.1 O que um negócio pode conter ou relacionar

Um mesmo **Negócio** pode envolver, ao longo do tempo:

- Um ou mais **imóveis**
- **Projeto(s)** de arquitetura
- **Obra / serviços** de engenharia e especialidades
- **Marcenaria, marmoraria**, etc. (como serviços ou fornecedores)
- **Venda de produtos**
- **Conjunto de fornecedores**
- **Um ou mais contratos** e aditivos
- **Um ou mais pagamentos** (escrow / multisplit)

**Exemplo:** Negócio começa imobiliário e desdobra em compra/venda, projeto, execução e fornecedores — **sempre** com rastreio sob o mesmo `ID_NEGOCIO` quando fizer sentido na jornada.

### 3.2 Negócio como centro — portas de entrada (imobiliária, arquitetura, etc.)

O **aggregate central** é sempre o **Negócio** (`ID_NEGOCIO`). Ele **não depende** de começar num único módulo: **várias frentes** podem **criar** ou **alimentar** o mesmo fio condutor, conforme o caso:

| Porta de entrada (exemplos) | Quem costuma operar | O que alimenta o negócio |
|----------------------------|---------------------|---------------------------|
| Lead / imóvel / interessado | **Imobiliária parceira**, corretor | CRM + módulo imobiliário → `negocios` + vínculos |
| Oportunidade / cliente / projeto novo | **Arquiteto**, escritório de arquitetura | CRM arquitetura → mesmo `negocios` (ou promoção explícita lead → negócio) |
| Tráfego / formulário / WhatsApp | Org com captação | Oportunidade com origem → negócio |
| Obra / execução (menos usual como “primeiro” passo) | Engenharia | Pode existir registro ligado a negócio já criado por outra frente |
| Produto / serviço comercializado | Equipe comercial da org | Linha no catálogo + negócio |

Na prática, **imobiliária e arquitetura** são duas **portas muito comuns** no ecossistema; o modelo de dados deve permitir que **o mesmo princípio** (`organizacao_id` + `negocio_id` + eventos) sirva para ambas, sem duplicar “tipos de sistema”. **Colaboração entre organizações** no mesmo negócio (ex.: imobiliária + arquiteto de outra org) pode evoluir com tabelas de **convite / parceria** em fase posterior — o centro lógico continua sendo o **negócio**.

### 3.3 Fornecedores — primeiro momento vs. rede autônoma (PRD)

- **Primeiro momento (Fase 1 / MVP operacional):** o cadastro de **fornecedores** (marcenaria, marmoraria, etc.) é feito de forma **induzida**: principalmente pelo **arquiteto** (ao montar projeto, cronograma ou rede de execução) e **pela própria organização** (admin ou perfil com permissão — imobiliária, escritório, engenharia, conforme a org). Ou seja: **quem já está na plataforma** cria o registro do fornecedor e o **vínculo** ao `negocio_id` / projeto; o fornecedor **ainda pode não ter login** nem cadastro autônomo.
- **Evolução (Fase 2+):** **cadastro autônomo** do fornecedor, homologação digital, documentos, performance e self-service conforme o §5.6 completo — reduz trabalho manual e escala a rede.

---

## 4. Perfis de usuário

Cada perfil possui **permissões específicas**, **visão limitada** e **interface adaptada** ao contexto (mesmo backend, capacidades diferentes).

| Perfil | Observação |
|--------|------------|
| Administrador HUB | Governança global, auditoria, configurações |
| Imobiliária parceira | Gestor da **organização** imobiliária parceira: operação e equipe **dessa** imobiliária na plataforma (tenant); não confundir com o operador **HUB** |
| Corretor | Pipeline e relacionamento |
| Arquiteto | CRM e projeto do escritório |
| Engenharia / executora | Operação de obra (HUB consolida e audita — §6.3) |
| Fornecedor | Marcenaria, marmoraria, vidraçaria, etc. |
| Cliente final | Visão simples: status, aprovações, cronograma, documentos e pagamentos relevantes |

Implementação: **Supabase Auth** + **RLS** (e, quando necessário, claims/metadata de organização e papel). Regras críticas **nunca** dependem só do React.

### 4.1 Organizações, multi-tenant e o que o HUB “vê”

- **Organização** é o **tenant** principal. Entre os tipos mais comuns no ecossistema estão **imobiliárias parceiras** (empresas de intermediação cadastradas/governadas pelo HUB na plataforma), escritórios de arquitetura, engenharias executoras, fornecedores homologados, etc. A maior parte dos dados operacionais leva `organizacao_id`; **RLS** restringe **usuários normais** às organizações das quais são **membros** — eles **não** enxergam dados de outras empresas.
- O **HUB**, no papel de **Administrador HUB**, **gerencia as organizações no sistema**: cadastro e ciclo de vida (ativa/suspensa), **quais módulos** cada org usa, políticas e templates de permissão, integrações de plataforma, e leituras de **auditoria e governança entre organizações** quando necessário para cumprir o PRD — **com trilha de auditoria** e respeito a **LGPD/contratos** (o desenho não admite “superusuário invisível”).
- Em resumo: **todas as organizações são entidades gerenciadas na plataforma pelo HUB** (no sentido produto: quem opera o Obra10+); **visão transversal de dados** é **privilégio explícito** do **Administrador HUB** (e futuros papéis de auditoria que o produto definir), não de todo usuário.

---

## 5. Módulos do sistema

### 5.1 CRM central (núcleo)

**Funções:** entrada de leads, imóveis, oportunidades de tráfego, cadastro manual; pipeline, qualificação, proposta, fechamento; integração entre mercados.

**Regra:** o CRM **não termina no fechamento** — permanece conectado a contratos, execução, fornecedores e financeiro.

**Integrações de captação:** Meta Ads, Google Ads, LinkedIn Ads, formulários, landing pages, manual, importações futuras. O sistema deve permitir **origem, campanha, canal, segmento** e **desempenho por fonte**.

**WhatsApp (uazapi):** captura via webhook para a plataforma pode rodar **em paralelo** a fluxos legados (ex.: IA → WhatsApp → Pipedrive), alimentando Supabase sem obrigar mudança imediata no atendimento. Ver guia dedicado: [GUIA_CAPTACAO_WHATSAPP_UAZAPI.md](./GUIA_CAPTACAO_WHATSAPP_UAZAPI.md).

### 5.2 Módulo imobiliário

Atende o **mercado imobiliário** por meio de **imobiliárias parceiras**: cada parceira é, em geral, uma **organização** (`organizacao_id`) com o módulo habilitado pelo **Administrador HUB** — o **operador da plataforma (Obra10+ / HUB) não é**, por definição do produto, “a imobiliária”; ele **orquestra o ecossistema** e **gerencia** parceiros, módulos e governança.

**Dentro da org da imobiliária parceira:** cadastro de **corretores**, **imóveis**, base/portal de imóveis, relacionamento com interessados, pipeline de venda, relatórios. Quando houver venda ou oportunidade qualificada, **vincular às demais camadas** do HUB via negócio (arquitetura, obra, fornecedores, financeiro, etc.).

> **Modelagem:** no futuro pode existir campo `tipo_organizacao` (ex.: `imobiliária_parceira`, `arquitetura`, `engenharia`) para menus e RLS mais finos; o conceito acima permanece.

### 5.3 Módulo arquitetura

CRM do arquiteto, pipeline, clientes, cronograma, entregáveis, conexão com fornecedores/executores, evolução do projeto, transição para execução.

### 5.4 Módulo engenharia e gerenciamento de obra

Cronograma, avanço, diário de obra, relatórios, fotos, equipe, contratos/aditivos, compras, controle de execução.

**Papel do HUB:** a empresa executora **gerencia** a obra; o HUB **acessa dados**, **consolida**, **audita** e alimenta **inteligência**, sem assumir necessariamente a gestão operacional completa em todos os casos. Experiência do cliente final não precisa expor essa complexidade.

### 5.5 Contratos

Contratos, aditivos, anexos e documentos complementares **vinculados ao negócio**, inclusive se a assinatura ocorrer em plataforma externa (integração registra metadados e estado).

### 5.6 Fornecedores e homologação

**Visão alvo (PRD completo):** cadastro autônomo do fornecedor, homologação, estrutura da empresa, equipe, especialidades, documentos, performance, vínculo a oportunidades, projetos e negócios — fornecedor se estrutura na plataforma e reduz trabalho manual do HUB.

**Primeiro momento:** priorizar cadastro **pelo arquiteto** e **pela organização** (ver **§3.3**): registro mestre mínimo + vínculo ao negócio/projeto; convite e login do fornecedor vêm depois. A UI de arquitetura e a de admin da org devem expor **“adicionar fornecedor ao negócio/projeto”** cedo no roadmap.

### 5.7 Módulo cliente

Acompanhar processo, status, aprovações quando aplicável, cronogramas, relatórios/fotos, contratos/aditivos e pagamentos relevantes. **UX simples.**

### 5.8 Módulo de onboarding e aprendizagem

Trilhas de onboarding, módulos obrigatórios, capacitação, homologação digital, progressão por etapas, bloqueios por não conclusão — padronização do ecossistema e menos dependência de treinamento presencial.

### 5.9 Módulo financeiro

**Funções:** controle de pagamentos; **conta escrow por negócio** (ou equivalente lógico); **multisplit**; rastreabilidade.

**Regra:** liberação conforme **regras** e evidências aceitas pela governança; todas as movimentações geram **dados estruturados** para auditoria e analytics.

> **Nota de documentação:** no material original havia trecho do financeiro duplicado com texto de onboarding; neste SPEC, **financeiro** e **onboarding** permanecem módulos distintos conforme acima.

#### Escrow / multisplit via BaaS ou PSP (API)

É **viável e alinhado à arquitetura** usar um **provedor externo** (PSP, **Banking-as-a-Service**, pagamentos com **subcontas** / **split** / retenção, conforme modelo jurídico e regulatório) **somente via API**, chamado a partir do **servidor** — por exemplo **Supabase Edge Function** com segredos, **nunca** no React.

**Fluxo-alvo (evolução):** ao confirmar **`CONTRATO_ASSINADO`** (ou callback do integrador de assinatura), uma função servidor: (1) valida regras e idempotência; (2) chama a API do provedor para **abrir conta virtual / carteira / intenção de pagamento** associada ao **`negocio_id`**; (3) persiste no Postgres `provider`, `external_account_id` (ou equivalente), estado; (4) **webhooks** do provedor atualizam `pagamentos`, disparam `PAGAMENTO_RECEBIDO` / liberação / split e alimentam auditoria.

**Fase 1:** estados e valores podem existir **só no Postgres** (M11) até haver **definição jurídica** (contrato com PSP, KYC, Pix, escrow fiduciário vs. retenção lógica). **Fase 2+:** plugar o BaaS/PSP escolhido; registrar a decisão em **ADR**.

A escolha do fornecedor depende de **Brasil** (Pix, arranjos, split), volume, papel do HUB (facilitador vs. parte) e assessoria jurídica — o produto permanece **agnóstico** na camada de domínio (`negocio_id` + eventos + IDs externos).

### 5.10 Camada de auditoria e governança

Não é apenas “aprovar etapa”. É **estrutura de acompanhamento e auditoria**: ler e cruzar dados da operação, conformidade, qualidade, **sustentação da liberação financeira**, histórico, indicadores, proteção das partes.

O HUB **não precisa** travar toda execução, mas precisa de **rastreabilidade** e uso dessa camada para o que impacta **confiança e dinheiro**.

---

## 6. Fluxo principal do sistema

1. **Entrada** — Lead, imóvel, serviço, produto, oportunidade de tráfego ou cadastro manual → alimenta ou cria **Negócio** (pode nascer na **imobiliária**, no **escritório de arquitetura** ou em outra frente — ver **§3.2**).
2. **CRM** — Qualificação → pipeline → proposta → negociação → fechamento.
3. **Desdobramento** — Conforme tipo: fluxo imobiliário, projeto de arquitetura, engenharia, marcenaria, produto, múltiplos fornecedores — tudo amarrado ao **`ID_NEGOCIO`** quando aplicável.
4. **Contratos e operação** — Contratos vinculados; cronogramas; fornecedores relacionados; início da execução.
5. **Acompanhamento e auditoria** — Consolidação de status, evidências, relatórios, histórico.
6. **Financeiro** — Pagamentos registrados; retenção; repartição; liberação por regra.
7. **Consolidação de dados** — Alimentação da base analítica / inteligência.

---

## 7. Eventos do sistema (orientação a eventos)

A equipe deve pensar o sistema como **máquina de registro de fatos relevantes**.

### 7.1 Exemplos de tipos de evento

| Evento (exemplo) | Uso |
|------------------|-----|
| `LEAD_CRIADO` | Entrada CRM |
| `IMOVEL_CADASTRADO` | Base imobiliária |
| `OPORTUNIDADE_CRIADA` | Tráfego / formulário |
| `MENSAGEM_RECEBIDA_WHATSAPP` | Canal WhatsApp (webhook / uazapi) — opcional conforme política de registro |
| `LEAD_QUALIFICADO` | Qualificação |
| `PROPOSTA_ENVIADA` | Comercial |
| `NEGOCIO_FECHADO` | Fechamento |
| `CONTRATO_ASSINADO` | Jurídico / integração |
| `PROJETO_INICIADO` | Arquitetura |
| `SERVICO_INICIADO` | Serviços |
| `ETAPA_CONCLUIDA` | Operação |
| `RELATORIO_ENVIADO` | Obra / projeto |
| `PAGAMENTO_RECEBIDO` | Financeiro |
| `PAGAMENTO_EM_ESCROW` | Retenção no provedor (opcional; pode ir só no payload de `PAGAMENTO_RECEBIDO`) |
| `PAGAMENTO_LIBERADO` | Escrow / regras |
| `FORNECEDOR_VINCULADO` | Rede |
| `ADITIVO_APROVADO` | Contratos |

### 7.2 Regras por evento

Cada evento deve, no mínimo conceitualmente:

- Registrar **data e hora**
- Registrar **responsável** (usuário ou sistema)
- Registrar **contexto** (ex.: `id_negocio`, referências relacionadas)
- Alimentar **histórico** e **relatórios**
- Permitir **automações** futuras (Fase 3+)

**Implementação sugerida (Supabase):** tabela append-only **`domain_events`** (ver [SCHEMA_DADOS_V0.md](./SCHEMA_DADOS_V0.md)), populada por aplicação, **RPC em transação**, **Edge Functions** (webhooks assinatura/fintech) — **serviço de eventos** e integração PSP descritos em [EVENTOS_SERVICO_E_FINTECH.md](./EVENTOS_SERVICO_E_FINTECH.md).

---

## 8. Camada de dados estruturados / analytics

Leituras desejadas (exemplos):

- Por pessoa, empresa, negócio, segmento, origem, fornecedor, cadeia operacional

Indicadores exemplificativos:

- Origem do lead, performance por mercado, volume por empresa, taxa de fechamento, avanço por etapa, volume financeiro, qualidade de entrega, incidência de aditivo, performance de fornecedor, comportamento por cadeia

**Diretriz:** tudo que for transacional deve ser **modelado para exportação** futura (views, replicação, warehouse), sem bloquear a Fase 1.

---

## 9. Stack e diretrizes técnicas

| Camada | Escolha |
|--------|---------|
| Frontend | **React** |
| Banco, Auth, APIs de dados | **Supabase** (PostgreSQL, Auth, Row Level Security, Storage, Realtime conforme necessidade) |
| Lógica sensível / integrações | **Poucas APIs** no início: priorizar **Supabase Edge Functions** (ou backend mínimo) para webhooks (ads, **WhatsApp/uazapi**), callbacks de pagamento, regras que não podem rodar no cliente |

### 9.1 Quando usar Edge Function (ou API) vs cliente direto

- **Cliente + RLS:** CRUD e leituras do dia a dia do usuário autenticado, desde que policies cubram autorização.
- **Edge Function / API:** segredos (tokens de ads, **tokens de instância WhatsApp/uazapi**, chaves de PSP), webhooks de terceiros, orquestração de escrow com validações server-side, geração de documentos assinados, jobs agendados.

### 9.2 Segurança

- **RLS obrigatória** em tabelas com dados multi-tenant ou sensíveis.
- Princípio: o browser é hostil; **regras de negócio críticas** validadas no servidor (Postgres/RLS/Edge).

---

## 10. Regras de negócio críticas (checklist)

1. Centro do sistema é o **negócio**, não só o projeto.
2. CRM atende **imobiliário, arquitetura, serviços e produtos**.
3. Entrada por **tráfego** e **cadastro manual** (e demais canais planejados).
4. Fluxo operacional de cada área pode seguir **gestão própria**, com dados refletidos no HUB.
5. HUB **consolida e audita** dados dessas operações.
6. Fluxo financeiro **controlado e condicionado por regra**.
7. Contratos e aditivos **vinculados ao negócio**.
8. **Dados estruturados** gerados a partir das ações e eventos do sistema.

---

## 11. Fora de escopo imediato (Fase 1)

Detalhamento completo de IA/recomendações, automações complexas, todos os conectores de ads em produção no primeiro marco, e modelo fiscal/contábil completo — podem ser **planejados** e **preparados** via eventos e schema extensível.

---

## 12. Glossário rápido

| Termo | Significado |
|--------|-------------|
| HUB | Operadora da plataforma; camada de governança e inteligência |
| Negócio | Oportunidade comercial e fio condutor (`ID_NEGOCIO`) |
| Escrow | Retenção de valores até condições atendidas |
| Multisplit | Distribuição de valores entre partes conforme regras |

---

## Documentos relacionados em `docs/`

| Documento | Conteúdo |
|-----------|-----------|
| [PLANEJAMENTO.md](./PLANEJAMENTO.md) | Marcos, APIs, fases |
| [FLUXO_INICIO_DESENVOLVIMENTO.md](./FLUXO_INICIO_DESENVOLVIMENTO.md) | Sequência recomendada para começar a construir |
| [ARQUITETURA.md](./ARQUITETURA.md) | Camadas React, Supabase, Edge Functions; fluxos e segurança |
| [SCHEMA_DADOS_V0.md](./SCHEMA_DADOS_V0.md) | Modelo de dados inicial (tabelas `negocios`, `domain_events`, multi-tenant); **§7 slugs e rotas** |
| [GUIA_CAPTACAO_WHATSAPP_UAZAPI.md](./GUIA_CAPTACAO_WHATSAPP_UAZAPI.md) | Fluxo paralelo Pipedrive + ingestão Supabase via uazapi |
| [UI_LOGIN_E_IDENTIDADE.md](./UI_LOGIN_E_IDENTIDADE.md) | Login, paleta Obra10+ (branco + charcoal + dourado), shell pós-login e referências de mercado |
| [MODULOS_PERMISSOES_E_HUB.md](./MODULOS_PERMISSOES_E_HUB.md) | Módulos do PRD, entidades ↔ módulos, perfis; **Administrador HUB** e controle central de permissões |
| [MODULOS_E_VISUALIZACOES_POR_PERFIL.md](./MODULOS_E_VISUALIZACOES_POR_PERFIL.md) | **Matriz módulo × perfil**, telas por participante (arquiteto, cliente, etc.) e fluxogramas |
| [FLUXOGRAMA_ENTIDADES.md](./FLUXOGRAMA_ENTIDADES.md) | Diagramas Mermaid: **entidades** do core, ER, vida útil e vínculos ao `ID_NEGOCIO` |
| [FLUXOGRAMA_FEATURES.md](./FLUXOGRAMA_FEATURES.md) | **Inventário de funcionalidades** (checklist) + fluxogramas por módulo e jornada |
| [EVENTOS_SERVICO_E_FINTECH.md](./EVENTOS_SERVICO_E_FINTECH.md) | **Serviço de eventos** (PRD: responsável, data, histórico, relatórios, automações) + **integração fintech** |

---

*Versão inicial alinhada ao PRD executivo Obra10+. Evoluir com ADRs e diagramas em `docs/` conforme decisões de implementação.*
