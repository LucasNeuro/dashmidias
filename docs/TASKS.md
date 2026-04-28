# Tarefas e registo de progresso — Obra10+ (dashmidias)

Documento **vivo**: regista trabalho concluído, em andamento e ideias de backlog. Atualizar sempre que uma entrega relevante for fechada (ou quando prioridades mudarem). Complementa [PLANEJAMENTO.md](./PLANEJAMENTO.md) e [ACESSOS_AUTH_E_GOVERNANCA.md](./ACESSOS_AUTH_E_GOVERNANCA.md).

| Legenda | Significado |
|---------|-------------|
| `[x]` | Concluído (com data) |
| `[~]` | Em andamento / parcial |
| `[ ]` | Planejado / backlog |

---

## Resumo simples (para quem não é da área de tecnologia)

Estas são as melhorias recentes em **linguagem direta**:

- **Sugestão com IA nos formulários:** ao montar um modelo de cadastro, um botão pode sugerir **nome** e **descrição** de uma vez. Nos **cadastros gerais de leads** também funciona; é preciso indicar o **ramo do parceiro** (como na homologação). O sistema tenta **não repetir** o mesmo texto no nome e na descrição.
- **Menu do administrador:** quando há muitas abas no topo, elas **andam para o lado** com **setas**, sem barra de rolagem aparente, para não “quebrar” o layout.
- **Nomes mais claros no menu:** por exemplo **«Cadastro geral leads»** e **«Campos»**.
- **Textos mais amigáveis:** menos menções a nomes internos de sistema; foco no que a pessoa **faz** na tela.
- **Campos (tela de configuração):** dá para **ligar ou desligar** grupos e campos, **mudar a ordem** com setas, e **gerir as etapas** do cadastro público (ligar, desligar, ordem, editar) na própria lista de etapas. Cada grupo equivale a **uma etapa própria** no **cadastro de parceiro** (`/cadastro/organizacao`); o formulário simples de **leads** (`/cadastro/lead`) **não** usa este assistente em vários passos.

---

## Como manter

1. Ao **terminar** uma tarefa com impacto (tela, endereço do site, banco de dados, publicação): acrescentar uma linha em **Concluído** (data `AAAA-MM-DD`, área, **uma frase clara** — preferir linguagem que qualquer colega entenda).
2. Ao **começar** algo que vá levar várias entregas: criar linha em **Em andamento** e mover para Concluído ao fechar.
3. O que ainda **não começou** fica no **Backlog**; pode mudar de prioridade conforme o produto.
4. Não copiar aqui o detalhe de scripts SQL — apontar para `database/` ou outro documento quando fizer sentido.

---

## Concluído

| Data | Área | Nota |
|------|------|------|
| 2026-04-28 | Captura de leads (público) | `PublicLeadCapturePage`: removido cabeçalho técnico (nome/descrição do template), removido botão **Sair** no rodapé e reforçada validação de contacto. **E-mail e telefone agora obrigatórios** com validação mais rígida no front; backend atualizado em `hub_submit_public_lead.sql` para validar formato de e-mail, bloquear domínios descartáveis/teste e exigir telefone válido. |
| 2026-04-28 | Governança / tabelas admin | `EntityDataTable` com **scroll horizontal** (`overflow-x-auto` + `table w-max min-w-full`) para suportar mais colunas sem quebrar layout. Em `AdminStandardCatalogPage`, ações de linha ajustadas para não quebrar: botão **Excluir** só com ícone da lixeira e ações em faixa única (`flex-nowrap`). |
| 2026-04-28 | Governança / acessos HUB | Criado RBAC HUB inicial em `database/hub_admin_roles_permissions.sql` (cargos, permissões, vínculos e função de leitura). Tela real de gestão criada e depois consolidada: removida aba **Configurações**, renomeada aba **Controle de usuários** para **Controles e acessos**, rota `/adm/configuracoes` redireciona para `/adm/usuarios`, e gestão de cargos/permissões incorporada na própria página de usuários (tabelas + sideovers). |
| 2026-04-25 | Captura de leads ↔ homologação | Modelos **`template_purpose = lead_capture`**: ao abrir com `tpl=` em **`/cadastro/organizacao`**, redirect para **`/cadastro/captura`** (`PartnerOrgSignupPage`). Homologação pública não mistura secções do catálogo só de CRM/leads (`isCatalogSectionExcludedFromPartnerOrgSignup` em `orgStandardFields`). Formulário público `TemplateFieldsPublicForm`: tipos alinhados + zona de arrastar para documentos (`partner_signup_documents`). Painel «Cadastro geral leads»: copy neutro («contexto para IA» vs «ramo» no texto público). |
| 2026-04-27 | Governança / Campos + cadastro parceiro | Aba e títulos **«Campos»** (antes «Campos padrão»); painel de grupo **sem** escolher «onde aparece» (comercial vs logística) — **uma etapa por grupo**, ordem = tabela **Etapas no cadastro público**; colunas da admin e textos alinhados. No site, `partitionSignupWizardExtraSlices` com catálogo na BD = **um passo do assistente por grupo** em `PartnerOrgSignupForm`. **Leads** (`PublicLeadSignupPage`) **não** entram neste fluxo. Coluna interna `partition_bucket` derivada só do `slug` (compatibilidade). |
| 2026-04-22 | Supabase / templates | API alinhada a `registration_form_template.fields` (jsonb); RLS: `registration_form_template_rls_production.sql`; recursão hub: `fix_hub_admins_rls_recursion.sql`. |
| 2026-04-22 | Cadastro público + Admin templates | Título de `/cadastro/organizacao` legível (cartão claro) e dinâmico (`tpl=`, perfil HUB); em `/adm` templates, convite por link (copiar URL); envio por e-mail (Resend / `send-template-invite`) em pausa até reactivar no front. |
| 2026-04-22 | Governança /admin | Removido code-split `lazy` das páginas admin; `AdminGovernanceLayout` sem `Suspense` com `GovernancePageSkeleton`. |
| 2026-04-22 | Governança UI | Páginas `AdminAuditPage`, `AdminUsersPage`, `AdminOrganizationsPage`: estado de carregamento em texto, sem skeleton animado. |
| 2026-04-22 | Deploy | `render.yaml` ajustado: Static Site, `npm ci`, `staticPublishPath` `frontend/dist`, `envVars` com `sync: false` para Vite. |
| 2026-04-22 | Repositório | `.gitignore` na raiz e reforço em `frontend/.gitignore` para `.env` / `.env.*` com exceção `!.env.example`. |
| 2026-04-22 | Auth / UI | Login unificado em `/login`; `/entrada` só compat (`?tpl=` → cadastro; senão → `/login`); coluna esquerda mantida; fundo com `public/images/login-hero-bg.svg` + gradiente no `AuthSplitLayout`; removida escolha manual Hub/Imóveis antes do login. |
| 2026-04-22 | Documentação | `ACESSOS_AUTH_E_GOVERNANCA.md` atualizado (rotas, guards, diagrama) alinhado ao login unificado. |
| 2026-04-22 | Painel campanhas | Removido overlay + `CampaignsDashboardSkeleton` (conflitava com o conteúdo); carregamento com `CampaignsDashboardLoading` dentro do `AppShell`; ajustes visuais (tabs em “pílula”, bordas suaves, cartões com `rounded-xl`). |
| 2026-04-22 | Cadastro / métricas por convite | Wizard público chama `submitHubPartnerOrgSignup` com `template_id` e `partner_kind`; CNPJ ou CPF; senhas não persistidas em `dados_formulario`. Admin templates: coluna «Pedidos» (agregados por estado). SQL opcional: `database/hub_partner_org_signups_template_id_index.sql`. |
| 2026-04-22 | Governança / IA | Edge Function `suggest-template-description` (Mistral via secrets); botão «Sugerir com IA» no sideover de template (`RegistrationTemplateSideover`). |
| 2026-04-22 | Templates / campos | Revert do modelo «Padrão+» (`asStandard` / etapa em extras): extras simples de novo; catálogo fixo só no separador Padrão (sem badges de âmbito nem coluna `+N`). Próximo passo de produto: tabela dedicada a campos padrão + seed + aba/UI opcional e IA (ver Backlog). |
| 2026-04-22 | Governança / catálogo padrão | Tabelas `hub_standard_field_section` + `hub_standard_field` (`database/hub_standard_catalog.sql` + seed); página `/adm/catalogo-padrao` (secções, etapas públicas, CRUD de campos); convite público e templates leem da BD com fallback a `orgStandardFields.js` se a BD estiver vazia ou indisponível. Evolução UX **2026-04-27:** aba «Campos», uma etapa por grupo no parceiro — ver linha **2026-04-27**. |
| 2026-04-22 | Homologação — cadastro parceiro (backend) | `database/hub_partner_org_approve_and_invite.sql`: RPC `hub_approve_partner_org_signup` (org + `organizacao_modulos` + convite `admin_organizacao`), `hub_preview_org_invite`, `hub_claim_org_invite`; `organizacoes.codigo_rastreio` (formato `HUB-OPP-*`); colunas em `hub_partner_org_signups` (`organizacao_id`, `hub_convite_id`, `modulos_concedidos`, `processado_*`). |
| 2026-04-22 | Homologação — convite pós-aprovação | Página `OrgInviteAcceptPage` + rota pública `/#/convite/organizacao?token=`; `PartnerOrgSignupPage` envia `cnpjSnapshot`/`consultaFonte` para `submitHubPartnerOrgSignup` → `cnpja_snapshot` + `consulta_fonte` em `hub_partner_org_signups`. |
| 2026-04-22 | Homologação — UI governança (v1) | `AdminOrganizationsPage`: métricas, tabela expansível, side-over com abas (consulta / dados / decisão), botão de acção com ícone, provisionar org + convite + rejeitar. |
| 2026-04-25 | Cadastro — motor de fluxos + entrada por documento | SQL `hub_registration_master_flow.sql` (fluxo `ob10-intake` + etapas→templates); `registrationFlowRules.js`, `registrationMasterFlowApi.js`; `/#/cadastro` com CPF/CNPJ (fallback escolha manual); CNPJ resolve etapas com `entry_condition` (`doc_type`/`audience`/`partner_kind`); `/#/adm/cadastro-fluxos` CRUD etapas; `PartnerOrgSignupPage` indica etapa N de M (`from=intake`); env `VITE_REGISTRATION_MASTER_FLOW_SLUG`. |
| 2026-04-25 | Cadastro público — leads + entrada | Rotas `/#/cadastro` (`RegistrationEntryPage`: PF→segmentos→`/#/cadastro/lead`) e PJ→`/#/cadastro/organizacao` (opcional `VITE_DEFAULT_PARTNER_SIGNUP_TPL`); `PublicLeadSignupPage` + RPC `hub_submit_public_lead`; SQL `hub_lead_segment.sql`, `hub_public_leads.sql`, `hub_submit_public_lead.sql`; `/entrada` sem `tpl`→`/cadastro`; link «Pedido de contacto» em `PartnerOrgSignupPage`. |
| 2026-04-25 | Documentação / Make + Cursor | [INTEGRACAO_MAKE_MCP_E_TASKS.md](./INTEGRACAO_MAKE_MCP_E_TASKS.md): **MCP toolbox** (URL + `MAKE_TOOLBOX_KEY`, timeout 40s, troubleshooting OAuth) e modo **stateless** com token; modos A/B; skill `projeto-tasks-dashmidias` (Make opcional). |
| 2026-04-25 | Skills Cursor | Skill `projeto-tasks-dashmidias` reforçada: obriga actualizar `docs/TASKS.md` após entregas (não só "oferecer"); triggers "sempre actualizar" e ligação no passo 5 de `obra10-implementacao-base-docs`. |
| 2026-04-23 | Homologação — UI relatório + rastreio no pedido | `partnerOrgGovernanceDisplay.js`: grupos no formulário, normalização de snapshot (`normalizeHubCnpjSnapshotInput`), `resolveConsultaFonteLabel`, relatório leve consulta CNPJ + SUFRAMA; cartões de contexto e legenda NEG/OPP/`HUB-OPP-*` (ciclo de vida); coluna **`hub_partner_org_signups.codigo_rastreio`** + `UPDATE` na RPC; painel alinhado após provisionar. |
| 2026-04-23 | Documentação códigos HUB | `docs/ESTRUTURA_CODIGOS_IDENTIFICADORES_HUB.md` (NEG/OPP/mercados, `HUB-OPP-*`); `docs/CADASTRO_ORGANIZACOES_E_USUARIOS.md` atualizado (snapshot, fluxo, checklist). |
| 2026-04-22 | Homologação — Kanban + timeline | `database/hub_homologacao_workflow.sql`: `workflow_etapa`, `hub_partner_org_signup_timeline`, trigger em `status`, RPC `hub_admin_set_signup_workflow_etapa`; `hub_submit` + `hub_public_homologacao_status` em `hub_partner_org_signup_public_rpc.sql` (timeline no acompanhamento público). Front: `HomologacaoWorkflowKanban.jsx` (sideover *Decisão*), `OrgHomologacaoTrackPage` (histórico), `rpcHubAdminSetSignupWorkflowEtapa` em `hubPartnerOrgGovernance.js`. |
| 2026-04-26 | Formulários / sugestão com IA | Um único botão **«Sugerir com IA»** no **nome do modelo** preenche **título** e **descrição**; vale para **homologação** e para **cadastro geral leads** (com escolha do **ramo do parceiro** nos leads). Ajustes no serviço em nuvem e no site para o texto do nome e o texto da descrição **não ficarem iguais**. |
| 2026-04-26 | Governança / abas superiores | Abas do painel (Auditoria, Configurações, etc.) com **rolagem horizontal** e **setas**; barra de rolagem **escondida**, para não empilhar linhas em telas menores. |
| 2026-04-26 | Nomes no menu | Aba **«Cadastro geral leads»** (antes «Captura de leads»); aba **«Campos»** (evolução dos nomes «Catálogo de campos padrão» / «Campos padrão»); textos do painel alinhados. |
| 2026-04-26 | Textos na interface | Mensagens de ajuda e erros com **menos jargão técnico** (sem citar nomes de tabelas do banco; orientação para suporte quando algo falha na IA). |
| 2026-04-26 | Campos (admin) — iteração | Tela de configuração: palavras **grupo** e **campo**; **Ligar / Desligar** e ordem nos grupos, campos e **Etapas no cadastro público**. Refinamento do modelo (**uma etapa por grupo**, só parceiro) em **2026-04-27**. |
| 2026-04-26 | Repositório | Pasta `docs/` incluída no `.gitignore` da raiz do projeto **dashmidias** (documentação local não sobe para o Git por padrão). |

---

## Em andamento

| Item | Notas |
|------|--------|
| `[~]` Deploy Render produção | Confirmar rewrites SPA (`/*` → `index.html`), variáveis `VITE_*` no painel, URLs no Supabase Auth. |

---

## Backlog (prioridade a definir com o produto)

| Item | Ref / contexto |
|------|------------------|
| `[~]` Aprovação HUB — fila admin | **Parcial:** homologação de **cadastro de organização parceira** (`hub_partner_org_signups` + RPC) na UI de Organizações. **Pendente:** alinhar UI "aprovar" **solicitações admin HUB** com `hub_admins` + `hub_solicitacoes_admin` (doc [CADASTRO_ORGANIZACOES_E_USUARIOS.md](./CADASTRO_ORGANIZACOES_E_USUARIOS.md), [PLANEJAMENTO](./PLANEJAMENTO.md) MVP). |
| `[ ]` Templates por organização + slugs | Em cima do v1 global: RLS por `organizacao_id`, links estáveis, import opcional de `localStorage` — ver [CRM_HUB_TEMPLATES_E_ESCALA_SUPABASE.md](./CRM_HUB_TEMPLATES_E_ESCALA_SUPABASE.md). |
| `[ ]` Rotas públicas com slug de org | `organizacoes.slug` global — paths tipo `/o/:orgSlug` (schema §7.3). |
| `[ ]` CNPJÁ em produção | `VITE_CNPJA_API_KEY` no Render; considerar proxy servidor no futuro (segredo fora do bundle). |
| `[ ]` **Governança — fila de leads públicos** | Adiar até módulo CRM; dados já em `hub_public_leads`. |
| `[ ]` **Pós-submit multi-etapa parceiro** | Hoje só a 1.ª etapa do fluxo abre; `sessionStorage` guarda próximos `tpl` — completar navegação após homologação ou unificar num único `hub_partner_org_signups`. |
| `[ ]` CRM / pipeline | Marcos M5–M7 em [PLANEJAMENTO.md](./PLANEJAMENTO.md). |
| `[ ]` RLS checklist | [FLUXO_INICIO_DESENVOLVIMENTO.md](./FLUXO_INICIO_DESENVOLVIMENTO.md) Fase A. |
| `[ ]` **IA — sugestão ao editar catálogo padrão** | Edge Function a partir de rótulo/chave → sugerir tipo, opções, secção e campos relacionados (complementa `/adm/catalogo-padrao`). |
| `[ ]` **Secções e campos de cadastro — modelo robusto (anti-“chumbado”)** | **Estado actual:** blocos «padrão» vêm do catálogo em código (`frontend/src/lib/orgStandardFields.js`: grupos `produto_servico`, `atuacao_servicos`, `logistica`); activação por `signup_settings.disabledBuiltinGroups` + `standard_fields_disabled`; campos livres em `registration_form_template.fields` (jsonb). **Evolução recomendada (fases):** (1) *Sem tabela nova:* acrescentar no jsonb do template um array `sections` (`id`, `title`, `sortOrder`) e, em cada item de `fields`, `sectionId` — o wizard ordena passos por secção (inclui misturar extras com blocos lógicos). (2) *Tabela auxiliar opcional:* `registration_form_template_section` (`id`, `template_id` FK, `slug`, `title`, `sort_order`, `metadata jsonb`) para edição relacional, RLS alinhada ao template; `fields` referenciam `section_id` ou `slug`. (3) *Catálogo global opcional:* tabela de definições reutilizáveis entre templates (somente se o produto exigir biblioteca partilhada). Documento de apoio: [CRM_HUB_TEMPLATES_E_ESCALA_SUPABASE.md](./CRM_HUB_TEMPLATES_E_ESCALA_SUPABASE.md). |
| `[ ]` Assistente IA — panorama dos formulários | Edge Function (ex. Mistral) que consome **só agregados** (templates + contagens `hub_partner_org_signups` por `template_id` / estado) e texto estruturado dos nomes de campos; sem enviar PII em massa. UI: cartão em `/adm/templates` ou relatório dedicado. |

---

## Histórico (changelog curto)

Lista **do mais novo para o mais antigo**. Cada data resume o que foi entregue nesse dia; detalhes técnicos estão na tabela **Concluído** acima.

- **2026-04-27** — **Campos (governança + cadastro parceiro):** aba só **«Campos»**; **uma etapa por grupo** no assistente do **parceiro** (`/cadastro/organizacao`), sem escolha manual «comercial vs logística»; ajuda sobre **desligar etapa** = some dos formulários que usam o catálogo. **Leads** (`/cadastro/lead`) **não** usam esse assistente por etapas.
- **2026-04-28** — **Governança / Controles e acessos:** consolidada gestão de acessos em `/adm/usuarios`; aba **Configurações** removida da navegação, rótulo trocado para **Controles e acessos** e redirecionamento de `/adm/configuracoes` para `/adm/usuarios`. Primeira base de RBAC HUB criada (cargos/permissões + sideovers).
- **2026-04-28** — **Captura pública de leads:** front removeu elementos técnicos (cabeçalho de template e botão **Sair**), e-mail/telefone obrigatórios com validação mais forte; backend (`hub_submit_public_lead`) passou a bloquear e-mails descartáveis e telefone inválido.
- **2026-04-28** — **Tabelas admin:** scroll horizontal padrão em `EntityDataTable` e ações compactas em `AdminStandardCatalogPage` (lixeira sem texto) para evitar quebra de linha.
- **2026-04-26** — **Documentação de acompanhamento:** `TASKS.md` ganhou texto **bem simples** (resumo para quem não é de TI), secção **«Como manter»**, mesmo vocabulário do painel («**Em andamento**» em vez de «em curso»), e este histórico **reordenado** (antes a data **2026-04-23** aparecia no meio de entradas de **2026-04-22**).
- **2026-04-26** — **Produto:** sugestão com **IA** no nome do modelo (**título** + **descrição**, sem repetir igual); vale em **homologação** e em **cadastro geral leads** (com **ramo do parceiro** nos leads).
- **2026-04-26** — **Painel admin:** abas superiores com **rolagem para o lado** e **setas**; nome **«Cadastro geral leads»** e mudanças no nome da aba de campos; mensagens mais claras (**sem nomes de tabela** na cara do usuário).
- **2026-04-26** — **Primeira rodada Campos / etapas:** tabelas com **ligar/desligar** e **subir/descer** grupos e campos; lista **«Etapas no cadastro público»** com ordem e **editar** (refinamento em **2026-04-27**: uma etapa por grupo só no cadastro **parceiro**).
- **2026-04-26** — **Git:** pasta `docs/` dentro de **dashmidias** no `.gitignore` (documentação local não sobe ao repositório por padrão).
- **2026-04-25** — **Cadastro (motor):** SQL `hub_registration_master_flow`; entrada em `/#/cadastro` por **CPF ou CNPJ**; admin `/#/adm/cadastro-fluxos` para etapas do fluxo.
- **2026-04-25** — **Cadastro (leads):** `hub_public_leads`, **segmentos**, rotas **`/cadastro`** e **`/cadastro/lead`** (PF → pedido de contato).
- **2026-04-25** — **Integração:** guia Make + MCP (**toolbox** URL+key vs token **sem estado**) em `INTEGRACAO_MAKE_MCP_E_TASKS.md`; skill de tarefas com **obrigatoriedade de atualizar** `TASKS.md` após entregas (+ passo 5 em `obra10-implementacao-base-docs`).
- **2026-04-23** — **Homologação — detalhes do pedido:** relatório de consulta **CNPJ** legível (sem JSON cru), cartões no formulário, **código de rastreio** também em `hub_partner_org_signups`; documentação dos códigos NEG, OPP e dos identificadores com prefixo `HUB-OPP-`.
- **2026-04-22** — **Homologação — Kanban e acompanhamento:** mini-Kanban no sideover (**etapas operacionais**), **timeline** no status público, SQL `hub_homologacao_workflow.sql` e RPC **`hub_admin_set_signup_workflow_etapa`**.
- **2026-04-22** — **Homologação — parceiros (MVP):** RPC aprovar + pré-visualização e resgate do convite; página aceitar convite; snapshot **CNPJ** no pedido; primeira UI **Governança → Organizações**.
- **2026-04-22** — **Templates de cadastro:** tabela `registration_form_template` (+ campos, RLS); admin e convite público `?tpl=`; distinção **papel RBAC** vs **modelos de formulário**; e-mail no UI pausado, **copiar link** mantido (`send-template-invite` guardada).
- **2026-04-22** — **Governança e painel:** campanhas sem skeleton em tela cheia (`CampaignsDashboardLoading`); backlog anotado: **secções/campos** evolutivos + **IA** em agregados; **Padrão+** revertido em favor de catálogo em **Supabase** + página **`/adm/catalogo-padrao`** com fallback ao JS quando a BD está vazia.
- **2026-04-22** — **Primeira versão deste arquivo** (`TASKS.md`) e registro do que já existia no projeto (login, admin, `render.yaml`, `.gitignore`, etc.).

---

*Mantido em par com a skill `projeto-tasks-dashmidias` em `.cursor/skills/`.*
