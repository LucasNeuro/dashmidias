# Cadastro de organizações e utilizadores — plano de implementação (HUB)

Este documento alinha **produto**, **documentação existente** e **estado atual do Postgres (Supabase)** para implementar:

1. Cadastro de **organizações** (imobiliária, escritório de arquitetura, empresa de engenharia, etc.).
2. Criação e gestão de **administradores do HUB** (nível plataforma).
3. Depois do primeiro acesso, a **própria organização** poder **criar e convidar utilizadores** (RBAC por papel na org).

**Referências:** [SCHEMA_DADOS_V0.md](./SCHEMA_DADOS_V0.md), [MODULOS_PERMISSOES_E_HUB.md](./MODULOS_PERMISSOES_E_HUB.md), [ACESSOS_AUTH_E_GOVERNANCA.md](./ACESSOS_AUTH_E_GOVERNANCA.md), [ESTRUTURA_CODIGOS_IDENTIFICADORES_HUB.md](./ESTRUTURA_CODIGOS_IDENTIFICADORES_HUB.md) (NEG/OPP/mercados e código `HUB-OPP-*` de rastreio; legado `ORG-*`). SQL homologação operacional: [database/hub_homologacao_workflow.sql](../database/hub_homologacao_workflow.sql).

**Projeto Supabase de referência:** `OBRA10` (verificado via MCP — tabelas abaixo existem em `public`).

---

## 1. Princípio de dois níveis (inalterável no desenho)

| Nível | Quem | O que faz |
|--------|------|-----------|
| **Plataforma (HUB)** | Administrador HUB | Cria/suspende **organizações**, atribui **módulos** (`organizacao_modulos`), pode criar **primeiro admin da org** ou convites iniciais; governança global, convites `criado_por_escopo = hub` em `organizacao_convites`. |
| **Organização** | `admin_organizacao` (papel template) | Gere **membros** da própria org: convites com `criado_por_escopo = admin_organizacao`, alteração de papéis dentro da org (limitado por RLS). |

A **auth** continua centralizada em `auth.users`; o vínculo multi-tenant é `organizacao_membros` + `papel_id` → `papel_template`.

---

## 2. Estado atual do banco (Supabase — resumo)

### 2.1 Já existem e suportam o modelo

| Tabela | Função |
|--------|--------|
| `auth.users` | Contas de login. |
| `profiles` | Legado (email, `full_name`, `role` user/admin/owner). |
| `perfis` | `administrador_hub`, `nome_exibicao` — alinhado à UI atual. |
| `hub_admins` | **Admin HUB** (`user_id` PK, `ativo`, `criado_por_user_id`). |
| `hub_solicitacoes_admin` | Fila de pedidos de acesso admin (fluxo já referenciado na doc de acessos). |
| `convites_administrador_hub` | Convite por **token** para tornar alguém admin HUB (uso futuro / alternativa à promoção manual). |
| `organizacoes` | Tenant: `nome`, `slug`, `status` (ativa / suspensa / em_onboarding), **`tipo_organizacao`** (nullable — **a fixar por convenção**), `criado_por_user_id`, **`codigo_rastreio`** (opcional — identificador `HUB-OPP-{MERCADO}-{DATA}-{SUFIXO}`, ver `database/hub_partner_org_approve_and_invite.sql`). |
| `organizacao_membros` | `organizacao_id` + `user_id` + **`papel_id`** (FK `papel_template`) + `papel_legacy`. Unique implícito por desenho: par org+user. |
| `organizacao_convites` | Convite por e-mail: `token_hash`, `organizacao_id`, `email`, `papel_id`, `expira_em`, **`criado_por_escopo`** ∈ `hub` \| `admin_organizacao`, `criado_por_user_id`. |
| `papel_template` | Papéis base. **No ambiente atual:** `hub_admin` (escopo **plataforma**), `admin_organizacao`, `membro` (escopo **organizacao**). |
| `papel_template_permissoes` + `permissao_recursos` + `modulos_catalogo` | Catálogo de módulos e permissões finas (ex.: `crm_central`, `campanhas`, …). |
| `organizacao_modulos` | Liga org ↔ módulo do catálogo (`ativo`, `config` jsonb). |
| `hub_partner_org_signups` | Pedidos do formulário público `/cadastro/organizacao`: `dados_formulario`, **`cnpja_snapshot`**, `consulta_fonte`, `status`; **`workflow_etapa`** / **`workflow_etapa_em`** (mini-Kanban HUB: `pendente` → `aguardando_retorno` → `em_analise` → `aprovado`, limpos após `processado`); após aprovação: `organizacao_id`, `hub_convite_id`, **`codigo_rastreio`**, `modulos_concedidos`, `processado_*` (ver `hub_partner_org_approve_and_invite.sql`). |
| `hub_partner_org_signup_timeline` | Histórico de eventos com **rótulo legível para o parceiro**; preenchido no envio do pedido, ao mover etapas (RPC `hub_admin_set_signup_workflow_etapa`) e por trigger em mudanças de `status` (`processado` / `rejeitado`). Leitura pública agregada em `hub_public_homologacao_status`. Ver `database/hub_homologacao_workflow.sql`. |

### 2.2 Convenção recomendada: `organizacoes.tipo_organizacao`

Valores sugeridos (texto livre ou CHECK futuro), alinhados ao produto:

- `imobiliaria`
- `arquitetura`
- `engenharia`
- `servicos` (ou especialidades agregadas, se preferirem um único tipo)
- `outro`

**Nota:** o CRM e os módulos comerciais **não** dependem só deste campo — ele orienta onboarding, menus e relatórios. Módulos habilitados vêm de `organizacao_modulos`.

---

## 3. Fluxos a implementar (por ordem sugerida)

### Fase A — Administrador HUB (já parcialmente na app)

- Manter coerência: promoção em `hub_admins` + `perfis.administrador_hub` + resolução de `hub_solicitacoes_admin` (ver [ACESSOS_AUTH_E_GOVERNANCA.md](./ACESSOS_AUTH_E_GOVERNANCA.md)).
- Opcional: uso de `convites_administrador_hub` (link com expiração) em vez de só promoção manual.

### Fase B — Criar organização (HUB)

1. UI em área **Admin** (`/adm/...` ou módulo dedicado): formulário nome, `tipo_organizacao`, documento opcional, slug opcional.
2. `INSERT` em `organizacoes` com `criado_por_user_id = auth.uid()` (HUB admin).
3. Definir `organizacao_modulos` (quais módulos a org contratou).
4. **Primeiro utilizador org:**
   - **Opção 1:** criar `organizacao_convites` com `papel_id` = `admin_organizacao`, `criado_por_escopo = hub`, e enviar e-mail (Edge Function ou fluxo manual com link).
   - **Opção 2:** se o admin da org já tiver conta: `INSERT` em `organizacao_membros` + ligação em `perfis`/onboarding.

**Caminho paralelo — cadastro público de parceiro:** o fluxo **Governança → Organizações** usa `hub_partner_org_signups`: o pedido já inclui snapshot CNPJ completo. O admin HUB pode **mover o pedido no mini-Kanban** (separador *Decisão* do sideover) via `hub_admin_set_signup_workflow_etapa`; o parceiro vê o **histórico** na página pública de acompanhamento (`hub_public_homologacao_status` → campo `timeline`, normalizado no front em `OrgHomologacaoTrackPage.jsx`). Para **formalizar**, executa `hub_approve_partner_org_signup`, que provisiona org, módulos e convite. O parceiro aceita em **`#/convite/organizacao?token=...`** (`hub_preview_org_invite` + `hub_claim_org_invite`).

**UX após enviar o formulário público** (`PartnerOrgSignupPage.jsx` → `submitHubPartnerOrgSignup`):

1. **Spinner** de overlay enquanto o pedido é registado.
2. Em sucesso **com** `codigo_rastreio` (RPC `hub_submit_partner_org_signup`): **modal** a informar que o link de acompanhamento foi enviado para o e-mail cadastrado; opções **Fechar** e **Ver acompanhamento** (`#/homologacao/organizacao?codigo=...`). O envio real do e-mail fica a cargo da automação (ex.: Make) ou de outro canal — o texto do modal alinha a expectativa do utilizador.
3. **Webhook Make (Integromat):** no sucesso, o front faz `POST` JSON opcional se existir `VITE_MAKE_HOMOLOGACAO_WEBHOOK_URL` no `.env` (ver `frontend/.env.example`). Implementação: `frontend/src/lib/postMakeHomologacaoWebhook.js`. Payload inclui entre outros `email`, `codigo_rastreio`, `tracking_url` (URL completa com hash), `nome_empresa`, `template_id`, `partner_kind`, `signup_id`, `event`, `at`. Em ambiente **legado** (insert directo sem RPC completa), o modal explica limitação e o webhook pode ir com `legacy_insert: true`. **Não** commitar o URL do hook no repositório; definir em local e no Render (variável `VITE_*` — visível no bundle; usar hook dedicado).

**Prefixo `HUB-OPP-{MERCADO}-*`:** o segmento do meio (ex. `PRO`, `ARQ`) vem do mapeamento SQL `partner_kind` → sufixo (`hub_partner_org_codigo_hub_opp_format.sql`) e do **`partner_kind` do template** (`registration_form_template`) enviado no submit. Se o código não refletir o mercado esperado, corrigir o template na base, não só o front.

**Ordem sugerida de SQL no Supabase (homologação):** `hub_homologacao_workflow.sql` **antes** de republicar `hub_submit_partner_org_signup` com insert na timeline; manter coerência com `hub_partner_org_signup_public_rpc.sql` e `hub_partner_org_approve_and_invite.sql` (código `HUB-OPP-*`: `hub_partner_org_codigo_hub_opp_format.sql`).

### Fase C — Admin da organização convida o restante da equipa

1. Utilizador com papel `admin_organizacao` na org acede a **“Equipa” / “Utilizadores”** (rota a definir, ex. `/app/org/:slug/equipe`).
2. Cria `organizacao_convites` com `criado_por_escopo = admin_organizacao`, `papel_id` = `membro` ou outros papéis futuros (corretor, etc. — novos rows em `papel_template` se necessário).
3. Aceitação do convite: utilizador regista-se ou faz login → troca `token` → `INSERT` em `organizacao_membros` + preenche `usado_em` / `usado_por_user_id`.

### Fase D — RLS e segurança (obrigatório antes de produção)

- Políticas já existentes para HUB admin devem permitir leitura/escrita **controlada** em `organizacoes` e convites.
- **Membro comum:** só `organizacao_id` das suas filas em `organizacao_membros`.
- **admin_organizacao:** apenas utilizadores e convites **da mesma** `organizacao_id`.
- Nunca expor `token_hash` em claro; validar convites só server-side ou RPC `SECURITY DEFINER` auditável.

*(Revisar ficheiros em `database/` e alinhar com migrations versionadas no Supabase.)*

---

## 4. O que falta no frontend (checklist)

| Item | Estado |
|------|--------|
| Wizard / formulário **nova organização** (HUB) | Não existe como fluxo completo |
| Página **convites pendentes** + aceitar convite (token na URL) | Rota pública `/#/convite/organizacao` + RPCs preview/claim (após aplicar SQL no Supabase) |
| **Aprovar cadastro público** + módulos + snapshot CNPJ + **Kanban / timeline** | UI em **Governança → Organizações** (sideover: fluxo + decisão) + RPCs `hub_admin_set_signup_workflow_etapa`, `hub_approve_partner_org_signup`; página pública `/#/homologacao/organizacao` com histórico (`timeline` da RPC) |
| **Pós-envio do cadastro público** (spinner, modal, webhook Make) | Implementado: `PartnerOrgSignupPage.jsx` + `postMakeHomologacaoWebhook.js`; configurar `VITE_MAKE_HOMOLOGACAO_WEBHOOK_URL` por ambiente |
| **Gestão de equipa** por `admin_organizacao` (listar membros, convidar, revogar) | Ausente |
| `AuthContext`: org **atual** (se multi-org no futuro: `organizacao_id` selecionado) | A consolidar com `organizacao_membros` |
| Rotas e menu: entrada **por org** vs portal Hub/Imóveis | Já existe portal; falta amarrar **org** ao CRM |

---

## 5. Integração com o CRM (contexto)

- Cada **negócio** (`negocios`) já leva `organizacao_id` no schema v0.
- Utilizadores **só** enxergam negócios das organizações em que são membros (RLS).
- Tipos de organização **não** substituem o CRM segmentado: definem contexto comercial (imobiliário vs arquitetura, etc.) e podem filtrar templates de pipeline no futuro.

---

## 6. Próximos artefactos técnicos (recomendado)

1. **Migration** única: CHECK ou enum em `tipo_organizacao` (se quiserem restringir valores).
2. **RPC** `aceitar_convite_organizacao(token, ...)` com validação e transação.
3. **Edge Function** `send-invite-email` (Resend / SMTP) — opcional na primeira entrega (convite copiado manualmente); o fluxo de homologação pode continuar a depender do Make (webhook) para e-mail de acompanhamento até haver função dedicada.
4. **Make / automação:** cenário que recebe o webhook de homologação, envia e-mail com o `tracking_url` e eventualmente duplica lógica de notificações.
5. Atualizar **este documento** quando fluxos estiverem validados em staging.

---

## 7. Referência rápida de papéis (`papel_template` — ambiente atual)

| `codigo` | `escopo` | Uso |
|----------|----------|-----|
| `hub_admin` | plataforma | Alinhado a administrador HUB (`hub_admins`). |
| `admin_organizacao` | organizacao | Dono operacional da org; convida membros. |
| `membro` | organizacao | Utilizador padrão da org. |

Papéis adicionais (ex.: `corretor`, `gestor_comercial`) podem ser adicionados com o mesmo mecanismo de `papel_template` + `papel_template_permissoes`.
