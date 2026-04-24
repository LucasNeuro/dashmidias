# Tarefas e registo de progresso — Obra10+ (dashmidias)

Documento **vivo**: regista trabalho concluído, em curso e ideias de backlog. Atualizar sempre que uma entrega relevante for fechada (ou quando prioridades mudarem). Complementa [PLANEJAMENTO.md](./PLANEJAMENTO.md) e [ACESSOS_AUTH_E_GOVERNANCA.md](./ACESSOS_AUTH_E_GOVERNANCA.md).

| Legenda | Significado |
|---------|-------------|
| `[x]` | Concluído (com data) |
| `[~]` | Em curso / parcial |
| `[ ]` | Planejado / backlog |

---

## Como manter

1. Ao **terminar** uma tarefa com impacto (UI, rota, Supabase, deploy): adicionar linha em **Concluído** (data `AAAA-MM-DD`, ficheiro ou área, uma frase).
2. Ao **iniciar** algo que atravesse vários PRs: criar linha em **Em curso** e mover para Concluído ao fechar.
3. Itens ainda **não iniciados** ficam no **Backlog**; podem ser reordenados por prioridade de produto.
4. Não duplicar o detalhe de migrations SQL — referir `database/` ou ficheiro de doc quando fizer sentido.

---

## Concluído

| Data | Área | Nota |
|------|------|------|
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
| 2026-04-22 | Governança / catálogo padrão | Tabelas `hub_standard_field_section` + `hub_standard_field` (`database/hub_standard_catalog.sql` + seed); página `/adm/catalogo-padrao` (secções, etapa comercial/logística, CRUD de campos); convite público e templates leem da BD com fallback a `orgStandardFields.js` se a BD estiver vazia ou indisponível. |
| 2026-04-22 | Homologação — cadastro parceiro (backend) | `database/hub_partner_org_approve_and_invite.sql`: RPC `hub_approve_partner_org_signup` (org + `organizacao_modulos` + convite `admin_organizacao`), `hub_preview_org_invite`, `hub_claim_org_invite`; `organizacoes.codigo_rastreio` (formato `HUB-OPP-*`); colunas em `hub_partner_org_signups` (`organizacao_id`, `hub_convite_id`, `modulos_concedidos`, `processado_*`). |
| 2026-04-22 | Homologação — convite pós-aprovação | Página `OrgInviteAcceptPage` + rota pública `/#/convite/organizacao?token=`; `PartnerOrgSignupPage` envia `cnpjSnapshot`/`consultaFonte` para `submitHubPartnerOrgSignup` → `cnpja_snapshot` + `consulta_fonte` em `hub_partner_org_signups`. |
| 2026-04-22 | Homologação — UI governança (v1) | `AdminOrganizationsPage`: métricas, tabela expansível, side-over com abas (consulta / dados / decisão), botão de acção com ícone, provisionar org + convite + rejeitar. |
| 2026-04-23 | Homologação — UI relatório + rastreio no pedido | `partnerOrgGovernanceDisplay.js`: grupos no formulário, normalização de snapshot (`normalizeHubCnpjSnapshotInput`), `resolveConsultaFonteLabel`, relatório leve consulta CNPJ + SUFRAMA; cartões de contexto e legenda NEG/OPP/`HUB-OPP-*` (ciclo de vida); coluna **`hub_partner_org_signups.codigo_rastreio`** + `UPDATE` na RPC; painel alinhado após provisionar. |
| 2026-04-23 | Documentação códigos HUB | `docs/ESTRUTURA_CODIGOS_IDENTIFICADORES_HUB.md` (NEG/OPP/mercados, `HUB-OPP-*`); `docs/CADASTRO_ORGANIZACOES_E_USUARIOS.md` atualizado (snapshot, fluxo, checklist). |
| 2026-04-22 | Homologação — Kanban + timeline | `database/hub_homologacao_workflow.sql`: `workflow_etapa`, `hub_partner_org_signup_timeline`, trigger em `status`, RPC `hub_admin_set_signup_workflow_etapa`; `hub_submit` + `hub_public_homologacao_status` em `hub_partner_org_signup_public_rpc.sql` (timeline no acompanhamento público). Front: `HomologacaoWorkflowKanban.jsx` (sideover *Decisão*), `OrgHomologacaoTrackPage` (histórico), `rpcHubAdminSetSignupWorkflowEtapa` em `hubPartnerOrgGovernance.js`. |

---

## Em curso

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
| `[ ]` CRM / pipeline | Marcos M5–M7 em [PLANEJAMENTO.md](./PLANEJAMENTO.md). |
| `[ ]` RLS checklist | [FLUXO_INICIO_DESENVOLVIMENTO.md](./FLUXO_INICIO_DESENVOLVIMENTO.md) Fase A. |
| `[ ]` **IA — sugestão ao editar catálogo padrão** | Edge Function a partir de rótulo/chave → sugerir tipo, opções, secção e campos relacionados (complementa `/adm/catalogo-padrao`). |
| `[ ]` **Secções e campos de cadastro — modelo robusto (anti-“chumbado”)** | **Estado actual:** blocos «padrão» vêm do catálogo em código (`frontend/src/lib/orgStandardFields.js`: grupos `produto_servico`, `atuacao_servicos`, `logistica`); activação por `signup_settings.disabledBuiltinGroups` + `standard_fields_disabled`; campos livres em `registration_form_template.fields` (jsonb). **Evolução recomendada (fases):** (1) *Sem tabela nova:* acrescentar no jsonb do template um array `sections` (`id`, `title`, `sortOrder`) e, em cada item de `fields`, `sectionId` — o wizard ordena passos por secção (inclui misturar extras com blocos lógicos). (2) *Tabela auxiliar opcional:* `registration_form_template_section` (`id`, `template_id` FK, `slug`, `title`, `sort_order`, `metadata jsonb`) para edição relacional, RLS alinhada ao template; `fields` referenciam `section_id` ou `slug`. (3) *Catálogo global opcional:* tabela de definições reutilizáveis entre templates (somente se o produto exigir biblioteca partilhada). Documento de apoio: [CRM_HUB_TEMPLATES_E_ESCALA_SUPABASE.md](./CRM_HUB_TEMPLATES_E_ESCALA_SUPABASE.md). |
| `[ ]` Assistente IA — panorama dos formulários | Edge Function (ex. Mistral) que consome **só agregados** (templates + contagens `hub_partner_org_signups` por `template_id` / estado) e texto estruturado dos nomes de campos; sem enviar PII em massa. UI: cartão em `/adm/templates` ou relatório dedicado. |

---

## Histórico (changelog curto)

- **2026-04-22** — Homologação: mini-Kanban no sideover (etapas operacionais), timeline pública no acompanhamento, SQL `hub_homologacao_workflow.sql` + RPC admin `hub_admin_set_signup_workflow_etapa`.
- **2026-04-23** — Homologação parceiros: relatório consulta CNPJ (sem JSON bruto), cartões agrupados no formulário, inferência de fonte quando a coluna vem vazia, `codigo_rastreio` também em `hub_partner_org_signups`; doc de códigos NEG/OPP/`HUB-OPP-*`.
- **2026-04-22** — Homologação parceiros (MVP): RPC aprovar + preview/claim convite org; página aceitar convite; snapshot CNPJ no insert do pedido; primeira versão da UI em Governança → Organizações.
- **2026-04-22** — Templates de cadastro: persistência em `registration_form_template` (+ campos) com RLS; listagem/edição no admin; convite público via `?tpl=`.
- **2026-04-22** — Backlog e UI de /adm/templates: distinção explícita entre `papel_template` (RBAC) e modelos de formulário de convite (agora em Supabase; `localStorage` só fallback dev).
- **2026-04-22** — Admin templates: removido envio de convite por e-mail no UI; mantido copiar link; Edge `send-template-invite` conservada no repositório.
- **2026-04-22** — Criação do ficheiro; preenchido com o estado conhecido do repositório e do trabalho recente (auth, admin, deploy, gitignore).
- **2026-04-22** — Registado: painel de campanhas sem skeleton fullscreen; componente de loading dedicado.
- **2026-04-22** — Backlog formalizado: secções/campos configuráveis (jsonb `sections` + `sectionId` → opcional tabela `registration_form_template_section`); assistente IA para insights agregados sobre formulários.
- **2026-04-22** — Padrão+ revertido; direcção: catálogo de campos padrão em tabela Supabase (seed a partir do código actual) + possível aba no sideover e sugestões IA, mantendo extras como hoje.
- **2026-04-22** — Catálogo padrão em Supabase + `/adm/catalogo-padrao` (secções e campos); fallback ao JS quando a BD não tem dados.

---

*Mantido em par com a skill `projeto-tasks-dashmidias` em `.cursor/skills/`.*
