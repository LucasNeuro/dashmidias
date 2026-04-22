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

---

## Em curso

| Item | Notas |
|------|--------|
| `[~]` Deploy Render produção | Confirmar rewrites SPA (`/*` → `index.html`), variáveis `VITE_*` no painel, URLs no Supabase Auth. |

---

## Backlog (prioridade a definir com o produto)

| Item | Ref / contexto |
|------|------------------|
| `[ ]` Aprovação HUB coerente | Alinhar UI "aprovar" com `hub_admins` + `hub_solicitacoes_admin` (doc [CADASTRO_ORGANIZACOES_E_USUARIOS.md](./CADASTRO_ORGANIZACOES_E_USUARIOS.md), [PLANEJAMENTO](./PLANEJAMENTO.md) MVP). |
| `[ ]` Templates por organização + slugs | Em cima do v1 global: RLS por `organizacao_id`, links estáveis, import opcional de `localStorage` — ver [CRM_HUB_TEMPLATES_E_ESCALA_SUPABASE.md](./CRM_HUB_TEMPLATES_E_ESCALA_SUPABASE.md). |
| `[ ]` Rotas públicas com slug de org | `organizacoes.slug` global — paths tipo `/o/:orgSlug` (schema §7.3). |
| `[ ]` CNPJÁ em produção | `VITE_CNPJA_API_KEY` no Render; considerar proxy servidor no futuro (segredo fora do bundle). |
| `[ ]` CRM / pipeline | Marcos M5–M7 em [PLANEJAMENTO.md](./PLANEJAMENTO.md). |
| `[ ]` RLS checklist | [FLUXO_INICIO_DESENVOLVIMENTO.md](./FLUXO_INICIO_DESENVOLVIMENTO.md) Fase A. |

---

## Histórico (changelog curto)

- **2026-04-22** — Templates de cadastro: persistência em `registration_form_template` (+ campos) com RLS; listagem/edição no admin; convite público via `?tpl=`.
- **2026-04-22** — Backlog e UI de /adm/templates: distinção explícita entre `papel_template` (RBAC) e modelos de formulário de convite (agora em Supabase; `localStorage` só fallback dev).
- **2026-04-22** — Cadastro público: título/eyebrow com contraste; admin templates: compartilhar convite (Resend via Edge) em vez de duplicar.
- **2026-04-22** — Criação do ficheiro; preenchido com o estado conhecido do repositório e do trabalho recente (auth, admin, deploy, gitignore).
- **2026-04-22** — Registado: painel de campanhas sem skeleton fullscreen; componente de loading dedicado.

---

*Mantido em par com a skill `projeto-tasks-dashmidias` em `.cursor/skills/`.*
