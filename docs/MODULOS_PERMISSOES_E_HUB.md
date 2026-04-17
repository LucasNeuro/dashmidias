# Módulos, entidades e permissões — Obra10+ HUB

Este documento organiza os **módulos** do PRD “Sistema central do HUB”, a relação com as **entidades** do core, os **perfis de usuário** e o modelo de **permissões**, com ênfase no **usuário principal do HUB (Administrador HUB)**, que deve poder **controlar acessos e capacidades** de forma centralizada e auditável.

Documentos relacionados: [SPEC.md](./SPEC.md), [SCHEMA_DADOS_V0.md](./SCHEMA_DADOS_V0.md), [ARQUITETURA.md](./ARQUITETURA.md). **Telas por papel:** [MODULOS_E_VISUALIZACOES_POR_PERFIL.md](./MODULOS_E_VISUALIZACOES_POR_PERFIL.md). **Mapa comercial CRM (venda vs operação), cinco segmentos e direcção templates/org/permissões:** [CRM_MAPA_COMERCIAL_CONTROLE_ORG.md](./CRM_MAPA_COMERCIAL_CONTROLE_ORG.md).

---

## Alinhamento explícito ao PRD (mercados, entidades, eventos)

O desenho de módulos e permissões **incorpora** os trechos do documento central do HUB que você citou: **quatro mercados** interligados, **entidades do core** abaixo, **operação orientada a eventos** (com responsável, data/hora, histórico, relatórios e automações) e a distinção **validação operacional vs. camada financeira/auditoria**.

### Quatro mercados — onde entram na plataforma

| Mercado | Cobertura |
|---------|-----------|
| **Imobiliário** | **Imobiliárias parceiras** (como **organizações** na plataforma) usam `imobiliario` + `crm_central`; o **Negócio** pode nascer de lead, imóvel ou oportunidade qualificada |
| **Arquitetura** | `arquitetura` — **Projeto**, entregáveis, cronograma; sempre relacionável ao mesmo `negocio_id` |
| **Serviços** | **Serviço** (catálogo e instâncias), `engenharia_obra`, execuções; fornecedores em `fornecedores` |
| **Produtos** | **Produto** no catálogo (`crm_central`) + comercialização vinculada ao **Negócio** |

O **CRM central multissegmentado** é o **núcleo que intercala** esses mercados: não são quatro sistemas; são **módulos** sobre **base única**, com o **Negócio** como eixo.

### “O sistema deve funcionar como” — checklist do PRD

| Exigência do PRD | Onde está no desenho |
|------------------|----------------------|
| CRM central multissegmentado | `crm_central` (e segmentação por mercado/canal no **Negócio** e nas entradas) |
| Central de oportunidades (tráfego, anúncios, cadastro manual) | `captacao` + fluxos manuais no `crm_central` |
| Sistema operacional de projetos e obras | `arquitetura` + `engenharia_obra` (executor opera; HUB consolida e audita) |
| Homologação e rede de fornecedores | `fornecedores` |
| Controle financeiro (escrow, multisplit) | `financeiro` |
| Auditoria, governança e acompanhamento | `auditoria` |
| Gerador de dados estruturados do ecossistema | `domain_events` + `relatorios` / `dados_plataforma` |

### Entidades principais do core — lista integral (PRD)

Referência literal para rastreabilidade; o mapeamento para módulos está na §3.

**Pessoa, Empresa, Negócio, Projeto, Pipeline, Imóvel, Fornecedor, Produto, Serviço, Contrato, Avanço/entrega, Pagamento, Pós-venda.**

- **Pós-venda:** coerente com “o CRM não morre no fechamento” — relacionamento, casos, renovação de oportunidades no mesmo cliente/**Negócio**; UX simples no `cliente_portal` onde couber.

### Operação orientada a eventos (exemplo do PRD)

Cadeia ilustrativa: lead criado → **Negócio**; lead qualificado; proposta enviada; contrato assinado; projeto iniciado; serviço iniciado; etapa concluída; pagamento recebido; **escrow**; pagamento liberado.

Cada evento deve, no mínimo:

| Requisito | Materialização sugerida |
|-----------|-------------------------|
| Registro imutável do fato | Tabela **`domain_events`** (tipo, `negocio_id`, payload JSON) |
| Responsável | `actor_user_id` / `actor_pessoa_id` |
| Data e hora | `occurred_at` (e `recorded_at` se necessário) |
| Histórico | Timeline = consulta ordenada de eventos + estado das entidades |
| Relatórios | Agregações por origem, mercado, etapa, fornecedor, cadeia |
| Automações | Consumidores assíncronos (Fase 3: filas, Edge Functions) |

Tipos de evento alinhados ao PRD incluem, entre outros: `LEAD_CRIADO`, `LEAD_QUALIFICADO`, `PROPOSTA_ENVIADA`, `NEGOCIO_FECHADO`, `CONTRATO_ASSINADO`, `PROJETO_INICIADO`, `SERVICO_INICIADO`, `ETAPA_CONCLUIDA`, `PAGAMENTO_RECEBIDO`, `PAGAMENTO_LIBERADO` (e estados intermediários de escrow conforme regras).

### Validação: operação vs. financeiro

Conforme o PRD: **nem toda etapa operacional depende de validação do HUB** para avançar — arquiteto, engenharia e fornecedor evoluem suas frentes. **Financeiro e auditoria** apoiam-se em **dados confiáveis** e **regras** para liberação e rastreabilidade. Nos módulos, isso separa **fluxo operacional** (`arquitetura`, `engenharia_obra`, partes de `fornecedores`) de **gates** em `financeiro` + leitura em `auditoria`.

---

## 1. Princípio de governança em dois níveis

| Nível | Quem | O que controla |
|-------|------|----------------|
| **Plataforma (HUB)** | **Administrador HUB** | Organizações no ecossistema, políticas globais, **catálogo de módulos e permissões**, papéis base, integrações sensíveis, auditoria **entre** organizações (quando aplicável), parâmetros que afetam confiança e dinheiro em escala. |
| **Organização** | Admin da **imobiliária parceira**, escritório, engenharia, etc. | Usuários **dentro** da própria organização, atribuição de papéis (corretor, arquiteto…), dados operacionais, convites, limites acordados com o HUB. |

**Resposta direta:** sim — o **Administrador HUB** é o perfil que, no desenho do produto, **pode e deve** poder **definir, ajustar e auditar** quem acessa o quê **no âmbito da plataforma** (e, quando o contrato comercial permitir, **padronizar** permissões por tipo de parceiro). O **admin da organização** continua responsável pelo dia a dia **dentro** da sua `organizacao_id`, sem necessariamente enxergar outras empresas.

> **Implementação:** isso exige no banco/código distinção explícita entre `is_hub_admin` / tabela `hub_administradores` (ou claim seguro no JWT emitido por fluxo controlado) e `organizacao_membros.papel`. **RLS** deve refletir: usuário comum só vê sua org; **HUB admin** usa políticas específicas ou serviço dedicado **com trilha de auditoria** (nunca “bypass” invisível).

---

## 2. Catálogo de módulos (alinhado ao PRD)

Módulos são **áreas funcionais** da mesma plataforma (não produtos separados). Um mesmo usuário pode acumular capacidades de vários módulos conforme papel.

| ID sugerido | Módulo | Função (resumo) | Fase típica |
|-------------|--------|-----------------|-------------|
| `captacao` | **Captação e integrações** | Meta, Google, LinkedIn, formulários, landing pages, importações; normalização de origem/campanha/canal | 1 |
| `crm_central` | **CRM central multissegmentado** | Leads, oportunidades, pipeline, qualificação, proposta, fechamento; **continua após o fechamento**; cadastro de **serviços** e **produtos** no catálogo comercial | 1 |
| `imobiliario` | **Imobiliário** | **Imobiliárias parceiras** (tenants): corretores, imóveis, base/portal, interessados, pipeline de venda, relatórios — governança do parceiro pelo **Administrador HUB** | 1 |
| `arquitetura` | **Arquitetura** | CRM do arquiteto, oportunidades, clientes, cronograma, entregáveis, ligação com execução | 1 |
| `engenharia_obra` | **Engenharia / obra** | Cronograma, diário, relatórios, fotos, equipe, contratos/aditivos/compras no âmbito da obra — executor opera; **HUB consolida e audita** | 1 |
| `contratos` | **Contratos e documentos** | Contratos, aditivos, anexos **vinculados ao negócio**; integração com assinatura externa | 1 |
| `financeiro` | **Financeiro** | Pagamentos, escrow por negócio, multisplit, rastreabilidade; **liberação por regra** | 1 (básico) |
| `fornecedores` | **Fornecedores e homologação** | **Fase 1:** cadastro **induzido** por **arquiteto** e **organização** + vínculo a negócio/projeto. **Fase 2+:** autônomo, homologação, documentos, performance | 1 (mínimo) / 2 (rede) |
| `cliente_portal` | **Portal do cliente final** | Acompanhamento simples: status, aprovações, cronograma, relatórios/fotos, contratos e pagamentos **relevantes** | 2 |
| `auditoria` | **Auditoria e governança** | Leitura e cruzamento de dados, conformidade, suporte à liberação financeira, indicadores; **não microgerir** cada clique operacional | 2 |
| `relatorios` | **Relatórios e inteligência operacional** | Dashboards por origem, mercado, fornecedor, cadeia (consome `domain_events` e dados transacionais) | 2 |
| `onboarding` | **Onboarding e aprendizagem** | Trilhas, módulos obrigatórios, homologação digital, bloqueios por pendência | 3 |
| `dados_plataforma` | **Dados estruturados / exportação** | Leituras agregadas, APIs de leitura para BI, consistência do modelo orientado a eventos | contínuo |

> **Nota PRD:** no material original, o bloco do **Módulo financeiro** foi duplicado com texto de onboarding; no produto, **financeiro** = pagamentos, escrow, multisplit; **onboarding** = trilhas e capacitação (linhas separadas na tabela acima).

---

## 3. Entidades do core ↔ módulos (matriz resumida)

| Entidade (PRD) | Onde “mora” principalmente |
|----------------|----------------------------|
| **Pessoa** | `crm_central`, `imobiliario`, `arquitetura`, `cliente_portal` |
| **Empresa** | `crm_central`, `imobiliario`, `fornecedores` |
| **Negócio** | **Núcleo transversal** — `crm_central` + todos os módulos que vinculam ao `negocio_id` |
| **Pipeline** | `crm_central` (+ imobiliário/arquiteto conforme segmento) |
| **Imóvel** | `imobiliario`, vínculo no **Negócio** |
| **Projeto** | `arquitetura` |
| **Obra / execução** | `engenharia_obra` |
| **Fornecedor** | `fornecedores` |
| **Produto** | `crm_central` (catálogo) + operações comerciais |
| **Serviço** | `crm_central` (catálogo) + `engenharia_obra` / fornecedores conforme caso |
| **Contrato** | `contratos` |
| **Avanço / entrega** | `arquitetura`, `engenharia_obra` |
| **Pagamento** | `financeiro` |
| **Pós-venda** | `crm_central` / `cliente_portal` (Fase 2+) |

**Regra do PRD:** imóvel, projeto, obra, serviço, produto, fornecedores, contratos e pagamentos **amarram ao mesmo `ID_NEGOCIO`** quando integrarem a mesma jornada.

---

## 4. Perfis de usuário (PRD) ↔ módulos típicos

Não são necessariamente **contas diferentes**; são **papéis** (roles) com pacotes de permissão. O **Administrador HUB** define **quais módulos/ações** cada papel pode ter **por padrão**; o **admin da organização** atribui papéis aos usuários da sua org.

| Perfil | Visão / módulos típicos (padrão sugerido) |
|--------|-------------------------------------------|
| **Administrador HUB** | Todos os módulos **em modo governança**: orgs, políticas, permissões globais, auditoria cross-org, integrações globais, **sem** necessidade de operar cada negócio do dia a dia |
| **Imobiliária parceira** (gestor na org) | `imobiliario`, `crm_central`, `contratos` (leitura/criação conforme regra), `relatorios` (da **própria** org parceira) |
| **Corretor** | `crm_central`, `imobiliario` (subconjunto), `contratos` (limitado) |
| **Arquiteto** | `arquitetura`, `crm_central` (seu funil), ligação com `engenharia_obra` (leitura ou colaboração) |
| **Engenharia** | `engenharia_obra`, leitura de `contratos`/`financeiro` conforme política |
| **Fornecedor** | `fornecedores` (próprio cadastro), tarefas/vínculos a **negócios** autorizados |
| **Cliente final** | `cliente_portal` apenas (UX simples) |

**Interface adaptada:** o mesmo React app esconde rotas e componentes com base nas **capacidades** resolvidas no login (ex.: hook `useCan('financeiro', 'liberar_pagamento')`).

**Detalhamento de módulos e visualizações por perfil** (incluindo arquiteto, engenharia, fornecedor, cliente): ver [MODULOS_E_VISUALIZACOES_POR_PERFIL.md](./MODULOS_E_VISUALIZACOES_POR_PERFIL.md).

---

## 5. Modelo de permissões recomendado (conceitual)

### 5.1 Capabilities (capacidades)

Granularidade: **`modulo.acao`** (ex.: `negocios.editar`, `financeiro.liberar_pagamento`, `auditoria.ler_cross_org`).

- **Papel (role)** = conjunto de capabilities **default**.
- **Administrador HUB** pode: editar **templates de papel**, criar **exceções** por organização (ex.: org X não vê `financeiro`), ativar/desativar **módulo** para org inteira.

### 5.2 Tabelas sugeridas (evolução do schema)

| Tabela | Função |
|--------|--------|
| `hub_administradores` | `user_id` dos administradores da plataforma (poucos usuários) |
| `modulos_catalogo` | Lista canônica de módulos (`id`, nome, descricao) |
| `permissao_recursos` | Recursos/ações por módulo |
| `papel_template` | Nome do papel + org nula = global HUB |
| `papel_template_permissoes` | N:N papel_template ↔ permissão |
| `organizacao_modulos` | Quais módulos estão **licenciados/ativos** para aquela org |
| `organizacao_membros` | Já previsto no schema v0 — estender com `papel_id` ou JSON de capabilities **somente** se documentado (preferível FK para papel da org) |

A **primeira versão** pode ser só `organizacao_membros.papel` **enum** + lista fixa no código; migrar para tabelas quando o HUB precisar **mudar permissões sem deploy**.

### 5.3 O que só o Administrador HUB deve poder fazer (exemplos)

- Criar / suspender **organização**.
- Definir **módulos habilitados** por organização.
- Ajustar **templates de papéis** (corretor, fornecedor…).
- Ver **logs de auditoria** e eventos **entre** organizações (governança).
- Configurar **integrações globais** (chaves rotacionadas, webhooks de plataforma).
- Aprovar políticas que afetam **liberação financeira** ou **escrow** em nível de regra de plataforma.

---

## 6. RLS e segurança (lembrete)

- **Usuário de organização:** policies com `organizacao_id IN (SELECT ... membros WHERE user_id = auth.uid())`.
- **Administrador HUB:** policies separadas **ou** RPC/Edge Function com `service_role` **registrando** `domain_events` do tipo `HUB_ADMIN_ACESSO` — evitar acesso invisível.
- **Cliente final:** apenas linhas ligadas ao seu **negócio** ou **convite** (modelagem futura em `cliente_portal`).

---

## 7. Resumo executivo

- Os **quatro mercados** (imobiliário, arquitetura, serviços, produtos) estão explícitos na seção **Alinhamento explícito ao PRD** e distribuídos pelos módulos; o **CRM central** os intercala na mesma base.
- As **treze entidades** do core do PRD estão listadas integralmente nessa mesma seção e mapeadas na §3 em torno do **`ID_NEGOCIO`**.
- **Eventos** (registro, responsável, data/hora, histórico, relatórios, automações) são o contrato entre operação e camada de dados; **`domain_events`** é a âncora técnica.
- Os **módulos** da §2 cobrem o checklist “o sistema deve funcionar como” (CRM, captação, obra/projeto, fornecedores, financeiro, auditoria, dados estruturados).
- Permissões respeitam **escopo de organização**, exceto **HUB admin** na governança; **financeiro/auditoria** concentram os gates que o PRD associa a dinheiro e confiança.

---

*Documento vivo. Alinhar com migrations de `hub_administradores` / catálogo de módulos quando a Fase 2 de governança entrar no roadmap.*
