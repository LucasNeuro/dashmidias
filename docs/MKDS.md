# MKDS — Manual de UI e layout (Dash Mídias / Painel Obra10)

Documento de referência para **tokens visuais**, **padrões de layout**, **componentes** e **comportamentos** do frontend em `frontend/`. Alinha design e desenvolvimento quando o produto evoluir.

**Stack:** React (Vite), React Router, Tailwind CSS v4 (`@import "tailwindcss"` + `@theme` em `src/index.css`), Supabase Auth, fontes **Inter** e **Material Symbols Outlined** (`index.html`).

---

## 1. Princípios de marca e tom visual

- **Estética:** institucional, alta densidade de informação, bordas retas (sem radius nos tokens do tema), contraste forte entre **primary** (azul escuro) e **tertiary** (verde destaque).
- **Voz:** rótulos frequentes em **maiúsculas**, `font-black`, `tracking` amplo (`tracking-widest` / `tracking-[0.2em]`), evocando relatório executivo e governança.
- **Idioma:** interface em **pt-BR**; números e moeda via `Intl` (`pt-BR`, BRL).

---

## 2. Tokens de design (`src/index.css`)

### 2.1 Cores (CSS variables → classes Tailwind)

| Token Tailwind        | Hex       | Uso principal |
|----------------------|-----------|----------------|
| `primary`            | `#0b1622` | Títulos, bordas fortes, fundos escuros (sidebar/login split), overlays de loading |
| `secondary`          | `#515f74` | (definido no tema; uso pontual no produto) |
| `tertiary`           | `#22c55e` | Acento positivo, ROAS, badges ativos, CTA principal do login |
| `surface`            | `#f7f9fb` | Fundo global do `<body>` (via `index.html`) |
| `surface-container`  | `#eceef0` | Fundos de header de tabela, áreas neutras |
| `surface-container-high` | `#e6e8ea` | Bordas e divisórias de cards |
| `surface-container-low` | `#e2e4e8` | Login/admin background, strip inferior da tabela de campanhas |
| `on-surface`         | `#191c1e` | Texto principal |
| `on-surface-variant` | `#44474c` | Texto secundário, labels |
| `outline`            | `#74777d` | Bordas de inputs |
| `outline-variant`    | `#c4c6cd` | Bordas leves, inputs |

**Cores utilitárias Tailwind adicionais (não no `@theme`, uso local):**

- **Meta:** `text-blue-600`, pills `blue-50` / `blue-700` / `blue-100`.
- **Google / risco:** `text-red-500`, `text-red-600`, `bg-red-50`, `border-red-200`.
- **Neutro ranking:** `slate-*` (2º e 3º lugar no ranking de eficiência).
- **Destaque ranking:** `amber-50`, `border-amber-500` (3º lugar).
- **Banner de erro global:** `bg-red-700 text-white`.

### 2.2 Tipografia

- **Família:** `Inter` (300–900), carregada no `index.html`; fallback `system-ui, sans-serif` no `body`.
- **Hierarquia habitual:**
  - Hero do painel: `text-4xl md:text-5xl font-black tracking-tighter text-primary`.
  - Subtítulo hero: `text-lg text-on-surface-variant font-semibold`.
  - Títulos de seção: `text-xs font-black uppercase tracking-[0.2em] text-primary` + barra vertical `w-1.5 h-6 bg-tertiary`.
  - Labels de métrica: `text-[10px] font-black uppercase tracking-widest text-on-surface-variant`.
  - Corpo em cartões/modal: `text-sm` / `text-[11px]` / `text-[13px]`.
- **Mono:** `font-mono text-xs` em células de auditoria (e-mail, IDs).

### 2.3 Cantos e sombras

- **`--radius-*`:** `0` (visual **sem arredondamento** no tema).
- **Exceções pontuais:** `rounded-sm` em barras de progresso do ranking; checkbox da política; lista de regras de senha no cadastro; badge **“Arqui System”** em HubBrandMark (§4.7.2) — `rounded-full`, tom cinza sobre fundo escuro.
- **Sombras:** `shadow-sm`, `shadow-xl`, `shadow-2xl` em cartões, login e modal.

### 2.4 Ícones

- **Material Symbols Outlined** (`material-symbols-outlined`), opsz 24, wght 400, FILL 0.
- Variável CSS em `.material-symbols-outlined` definida em `index.css`.
- Tamanhos comuns: `text-[12px]` a `text-4xl` conforme contexto.

---

## 3. Layout global

### 3.1 Container do dashboard

- Largura: `w-[96vw] max-w-[1800px] mx-auto`.
- Padding vertical/horizontal: `px-4 py-8 lg:px-6`, blocos internos com `space-y-8`.
- Se existir **banner** (erro/mock): `pt-16` no container principal para não sobrepor o aviso fixo.

### 3.2 Cabeçalho do painel (`DashboardPage`)

- **Estrutura:** `flex flex-col md:flex-row justify-between items-end gap-6 pb-8 border-b-2 border-primary`.
- **Faixa 1:** badge documento (`report.document_badge`) + governança (`report.governance_label` + ícone `security`).
- **Faixa 2:** título fixo do produto + subtítulo de escopo (**obras, imóveis e projetos · Meta e Google**).
- **Faixa direita:** grupo de controles de período (dois `input type="date"`) + caixa informativa **“Dados disponíveis: min até max”** derivada das campanhas filtráveis.

### 3.3 Navegação por abas

- `nav` com `border-b border-outline-variant`, scroll horizontal oculto (`no-scrollbar`).
- Aba ativa: `text-primary border-b-[3px] border-primary`.
- Inativa: `text-on-surface-variant hover:bg-surface-container border-b-2 border-transparent`.
- Texto: `text-[11px] font-black uppercase tracking-[0.2em]`, `px-8 py-4`.

**Abas:** Visão Geral · Meta Ads (FB/IG) · Google Ads · Funil & ROI.

### 3.4 Bloco de filtros

- Card: `bg-white border border-surface-container-high p-4 md:p-5`.
- Grid: `grid-cols-1 md:grid-cols-4 gap-3`; busca ocupa 2 colunas em `md+`.
- Inputs/selects: `bg-surface border border-outline-variant px-3 py-2 text-sm`.
- Contador: `text-[10px] font-bold uppercase tracking-widest` — “N campanha(s) exibida(s)”.
- Link **Limpar filtros:** `text-[10px] font-black uppercase text-primary hover:underline`.

### 3.5 Visibilidade condicional de seções (`Panel.jsx`)

- Componente **`Panel`:** recebe `tabs` (lista de ids separados por espaço) e `activeTab`; só renderiza `children` se `activeTab` estiver na lista.
- Permite **reutilizar** blocos em várias abas sem duplicar markup (ex.: sumário só em `overview`; tabela de campanhas em `overview meta google funnel`).

### 3.6 Rodapé

- `border-t-2 border-primary`, `pt-12 pb-12`, flex column/row.
- Esquerda: **Arqui System** + **Internal Analytics Unit**, aviso de confidencialidade (`text-[10px] uppercase tracking-wider`).
- Direita: indicador **live/sync** (ponto com `animate-ping`), **Políticas de Dados**, **Auditoria** (se admin), **Sair**, label de build **2.4.0-GA**.

### 3.7 Shell autenticado com sidebar (`AppShell.jsx`)

- **Objetivo:** unificar o layout pós-login em toda a aplicação (HUB, auditoria e módulos futuros).
- **Estrutura desktop:** `aside` fixo (`lg:w-64`) com `bg-primary`, navegação vertical e bloco de contexto do tenant no rodapé.
- **Estrutura mobile:** barra superior escura com navegação horizontal e scroll (`no-scrollbar`).
- **Ativação de item:** barra lateral/borda em `tertiary` + fundo sutil (`bg-tertiary/15`).
- **Contratos do componente:** `title`, `subtitle`, `headerActions`, `orgLabel`, `navItems` (já filtrados por permissão/módulo).

---

## 4. Componentes e padrões por área

### 4.1 Cartões do sumário executivo

- Grid responsivo: `grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4`.
- Cartão padrão: `bg-white p-8 border-l-4 border-l-primary` ou borda completa `border surface-container-high shadow-sm`.
- Cartão de destaque ROAS: `bg-primary p-8 border-l-4 border-l-tertiary` com valores em `text-tertiary` e labels em `text-white/60`.
- Valores grandes: `text-4xl` / `text-5xl font-black tracking-tighter`.

### 4.2 Comparativo por canal (três colunas)

- Container: `grid-cols-1 lg:grid-cols-3 divide-y lg:divide-x divide-surface-container-high`.
- Cada canal: `button` full-width `p-8`, hover `hover:bg-surface-container-low/40`.
- Badge de canal: `badgeToneClass` — `blue` / `red` / `slate` mapeados para Tailwind (`bg-blue-600`, etc.).
- Barra de participação: trilho `bg-surface-container h-1.5`, preenchimento `barColor(slug)` — Meta `bg-tertiary`, Google `bg-primary`.

### 4.3 Blocos Meta / Google

- Meta: ícone `facebook` azul, grid 2x2 de mini cards `bg-white p-6 border`.
- Google: ícone `search` vermelho, tabela com `thead bg-surface-container-low`, linhas `divide-surface-container-high`.

### 4.4 Funil

- Fundo hero: `bg-primary text-white p-12 relative overflow-hidden`.
- Decorativo: faixa `bg-tertiary/10 skew-x-[-12deg]`.
- Passos: grid 5 colunas com setas `arrow_forward`; step em destaque usa `text-tertiary`.
- Bloco inferior: oportunidades qualificadas + fechamentos; ícones em caixas `bg-white/5` ou `bg-tertiary`.

### 4.5 Otimização (insights + ranking)

- Duas colunas `lg:grid-cols-2`, **mesma altura** aproximada: `h-[min(62vh,480px)] lg:h-[min(68vh,520px)]`, `overflow-y-auto`.
- **Pills de tipo de insight:** `insightTypeClass` — risco (vermelho), oportunidade (primary), otimização (tertiary).
- **Ranking:** posição 1 `border-l-tertiary bg-tertiary/8`; 2 slate; 3 amber; demais borda transparente. Barra horizontal proporcional ao máximo do filtro atual.

### 4.6 Tabela de campanhas

- Wrapper: `max-h-[650px] overflow-auto`, header sticky `sticky top-0 z-10`, `bg-surface-container`.
- Linha: hover `hover:bg-surface-container-low`; canal com `channelPillClass` (pastéis por `badge_tone`).
- ROAS: `text-tertiary font-black`; status: pill `bg-tertiary/10 border-tertiary/20` + ponto pulsante.
- **Expansão:** segunda linha `bg-surface`, grid 1+2 colunas com resumo e `optimization_hint` + até 2 insights.

### 4.7 Auth — layout partilhado (`AuthSplitLayout`) + login

**`AuthSplitLayout`** ([`src/components/AuthSplitLayout.jsx`](../frontend/src/components/AuthSplitLayout.jsx)): split usado em login, recuperação/redefinição de senha e cadastro `/acesso/governanca-hub`.

- **Grid:** `grid-cols-1 lg:grid-cols-[0.95fr_1.45fr]`; fundo externo `bg-surface-container-low`; no **desktop** o contentor usa altura `100dvh` e `overflow-hidden` para o scroll **não** ser o da página inteira.
- **Coluna esquerda (`aside`):** `bg-primary`, texto claro, componente **HubBrandMark** (§4.7.2) + `heroTitle` / `heroSubtitle` + `buildLabel` opcional. Pode ter scroll próprio só se o conteúdo exceder a viewport.
- **Coluna direita:** `overflow-y-auto` — **só a zona do formulário** rola quando o conteúdo é alto; cartões com `max-w-md mx-auto`.
- **Mobile:** colunas empilhadas; comportamento de scroll da página conforme o ecrã.

**`LoginPage`** ([`src/pages/LoginPage.jsx`](../frontend/src/pages/LoginPage.jsx)):

- Cartão: `w-full max-w-md mx-auto bg-white border-2 border-primary shadow-xl p-8 space-y-6`.
- Título **“Acesso ao painel”**; texto de contexto (organizações habilitadas pelo Administrador HUB); sem duplicar marca no cartão (marca na lateral).
- Campos e-mail e senha (toggle visibilidade); submit **Entrar** `bg-tertiary text-white` (`text-[10px] font-black uppercase tracking-[0.2em]`).
- Links secundários: **Esqueci minha senha** → `/login/recuperar-senha`; **Solicitar perfil administrativo HUB** → `/acesso/governanca-hub`.
- Erro: `text-red-600`.

#### 4.7.2 Marca HUB (`HubBrandMark`)

[`src/components/HubBrandMark.jsx`](../frontend/src/components/HubBrandMark.jsx): ícone Material **home** em `tertiary`, wordmark **Obra10+**, badge **Arqui System** (tons cinza/claros, `rounded-full`, variante `compact` no `AppShell` mobile).

### 4.8 Modal de política (`DataPolicyModal.jsx`)

- Overlay: `fixed inset-0 z-[100] bg-primary/70 backdrop-blur-sm`.
- Diálogo: `bg-white border-2 border-primary shadow-2xl max-w-lg max-h-[min(85vh,640px)] flex flex-col`.
- Rodapé: fundo leve `bg-surface-container-low/30`; CTA obrigatório `bg-tertiary text-primary` quando modo `required`.

### 4.9 Admin / Auditoria (`AdminAuditPage.jsx`)

- Fundo: `min-h-screen bg-surface-container-low`.
- Header fixo de página: `bg-white border-b-2 border-primary`.
- Tabelas em `section` card branco, `thead sticky`, scroll limitado (`max-h-[360px]` / `480px`).
- Badges de papel e `can_access_audit` com cores slate / tertiary / blue.

### 4.10 Hub Core (`HubHomePage.jsx`)

- Primeira tela funcional já usa `AppShell` no mesmo estilo do dashboard.
- Blocos internos em cards brancos com borda leve (`border-surface-container-high`) e tipografia executiva (`font-black`, uppercase).
- Navegação inicial com foco em `Hub`, `Campanhas` e `Auditoria`.

---

## 5. Estados globais da experiência

| Estado | Comportamento visual |
|--------|----------------------|
| Carregamento inicial | Fullscreen `bg-primary text-white`, `text-[10px] font-black uppercase tracking-widest` (“Carregando dados…” / “Verificando sessão…”). |
| Banner | Fixo topo `z-50`, `bg-red-700`, texto erro, mock ou aviso do Supabase. |
| Dados mock | Mesmo layout; mensagem no banner orienta configurar `.env`. |
| Supabase desligado | `App.jsx` exibe `CampaignsDashboardPage` **sem** router de login/HUB; painel direto. |
| Política não aceita | Modal `required` bloqueia até checkbox + “Aceitar e continuar”. |

---

## 6. Formatação de dados (`src/lib/format.js`)

- **`money(n)`:** BRL, frações apenas se necessário.
- **`intFmt(n)`:** inteiro com separador de milhar pt-BR.

---

## 7. Acessibilidade e semântica

- Abas com `role="tablist"`, `role="tab"`, `aria-selected`.
- Modal com `role="dialog"`, `aria-modal`, `aria-labelledby`.
- Loader e overlays com mensagens legíveis; botões de senha com `aria-label`.
- **Scroll:** utilitário `.no-scrollbar` para ocultar barra mantendo scroll por gesto/trackpad.

---

## 8. Mapa rápido arquivo → responsabilidade UI

| Arquivo | Conteúdo principal |
|---------|---------------------|
| `index.html` | Title, favicon, fonts |
| `src/index.css` | `@theme`, body, material-symbols, no-scrollbar |
| `src/modules/campaigns-dashboard/CampaignsDashboardPage.jsx` | Módulo painel de campanhas: abas, filtros, métricas |
| `src/modules/campaigns-dashboard/components/Panel.jsx` | Gate de visibilidade por aba |
| `src/modules/hub-core/HubHomePage.jsx` | Núcleo HUB (shell + docs) |
| `src/modules/crm-core/CrmHomePage.jsx` | CRM global multi-tenant (`negocios`, RLS) |
| `src/components/AuthSplitLayout.jsx` | Split auth: hero + formulário; scroll só na coluna direita (desktop) |
| `src/components/HubBrandMark.jsx` | Marca Obra10+ + badge Arqui System (login lateral e `AppShell`) |
| `src/components/AppShell.jsx` | Shell pós-login com sidebar / navegação mobile |
| `src/components/DataPolicyModal.jsx` | Política obrigatória / informativa (compartilhado) |
| `src/pages/LoginPage.jsx` | Login; links recuperação e solicitação admin HUB |
| `src/pages/ForgotPasswordPage.jsx` / `ResetPasswordPage.jsx` | Recuperação e redefinição de senha |
| `src/pages/HubAdminSolicitacaoPage.jsx` | Cadastro `/acesso/governanca-hub` (signup + `hub_solicitacoes_admin`) |
| `src/pages/HubPendingApprovalPage.jsx` | `/acesso/pendente-hub` — aguardando aprovação owner |
| `src/pages/AdminAuditPage.jsx` | `/adm` — auditoria e fila de aprovação (owner) |
| `src/lib/postLoginPath.js` | Destino pós-login (`/adm`, `/acesso/pendente-hub`, `/crm`) |
| `src/App.jsx` | Router completo (auth, HUB, CRM, campanhas); ver [ACESSOS_AUTH_E_GOVERNANCA.md](./ACESSOS_AUTH_E_GOVERNANCA.md) |

---

## 9. Evolução do MKDS

Ao alterar tokens, **atualize primeiro** `src/index.css` e **depois** este documento. Ao criar novos componentes, prefira reutilizar: labels em `text-[10px] font-black uppercase`, bordas `border-primary` ou `surface-container-high`, e largura máxima `max-w-[1800px]` para consistência com o painel principal.

---

## 9.1 Navegação principal e unificação de dados

- **Hub (shell):** `HubHomePage` em `/` — visão institucional / documentação e acesso aos módulos (rota protegida).
- **CRM (eixo do produto):** `CrmHomePage` em `/crm` — negócios globais; cada organização enxerga só o permitido por RLS; funis/pipeline por tenant são governados pelo HUB.
- **Campanhas:** `/painel/campanhas` — dashboard de mídia (schema de relatórios já existente).
- **Governança / pendência:** `/acesso/governanca-hub` (público, cadastro admin HUB); `/acesso/pendente-hub` (sessão, solicitação pendente sem admin); detalhes em [ACESSOS_AUTH_E_GOVERNANCA.md](./ACESSOS_AUTH_E_GOVERNANCA.md).
- **Unificação Supabase:** projeto `dash-midias` concentra schema de campanhas **e** schema HUB (`organizacoes`, `perfis`, `hub_admins`, `hub_solicitacoes_admin`, `negocios`, etc.).
- **Auth:** leitura de `profiles` (legado) + `perfis` + `hub_admins` + `hub_solicitacoes_admin` (pendente); `identityReady` evita redirect antes de resolver `isAdmin` e fila.
- **Redirecionamento pós-login** (`getPostLoginPath`): administrador → `/adm`; solicitação pendente sem admin → `/acesso/pendente-hub`; caso contrário → `/crm`.

---

## 10. Documentação de produto em `docs/` (contexto Obra10+ HUB)

O repositório inclui a base **estratégica e de arquitetura** do **Obra10+ HUB** (CRM multissegmentado, negócio central, eventos, multi-tenant). O painel React atual (`frontend/`) é um **marco parcial**: leitura de campanhas/relatórios e auth; o SPEC descreve a plataforma completa.

| Documento | Conteúdo |
|-----------|----------|
| [SPEC.md](./SPEC.md) | Visão do produto, princípios, entidades, módulos, eventos, stack React + Supabase |
| [PLANEJAMENTO.md](./PLANEJAMENTO.md) | Fases, marcos M1–M12, MVP auth/governança HUB, riscos, estratégia de APIs |
| [ACESSOS_AUTH_E_GOVERNANCA.md](./ACESSOS_AUTH_E_GOVERNANCA.md) | Rotas, guards, pós-login, tabelas Supabase e env (auth HUB) |
| [ARQUITETURA.md](./ARQUITETURA.md) | Camadas, diagrama Mermaid, RLS, Edge Functions, fluxos |
| [SCHEMA_DADOS_V0.md](./SCHEMA_DADOS_V0.md) | `organizacoes`, `negocios`, `domain_events`, convenções |
| [FLUXO_INICIO_DESENVOLVIMENTO.md](./FLUXO_INICIO_DESENVOLVIMENTO.md) | Ordem: schema + RLS → React → webhooks |
| [UI_LOGIN_E_IDENTIDADE.md](./UI_LOGIN_E_IDENTIDADE.md) | **Identidade Obra10+:** branco, charcoal `#1A1A1A`, **dourado** `#C5A059` em CTA; split login; shell pós-login |
| [MODULOS_PERMISSOES_E_HUB.md](./MODULOS_PERMISSOES_E_HUB.md) | Catálogo de módulos, Administrador HUB vs admin org |
| [MODULOS_E_VISUALIZACOES_POR_PERFIL.md](./MODULOS_E_VISUALIZACOES_POR_PERFIL.md) | Matriz módulo × perfil, telas por papel |
| [FLUXOGRAMA_ENTIDADES.md](./FLUXOGRAMA_ENTIDADES.md) / [FLUXOGRAMA_FEATURES.md](./FLUXOGRAMA_FEATURES.md) | Diagramas e inventário de features |
| [EVENTOS_SERVICO_E_FINTECH.md](./EVENTOS_SERVICO_E_FINTECH.md) | `domain_events`, integrações fintech |
| [GUIA_CAPTACAO_WHATSAPP.md](./GUIA_CAPTACAO_WHATSAPP.md) | Captação WhatsApp (uazapi), webhooks, idempotência |
| [ESTIMATIVA_CUSTOS_GERAIS.md](./ESTIMATIVA_CUSTOS_GERAIS.md), [CRONOGRAMA_E_CUSTOS_INFRA.md](./CRONOGRAMA_E_CUSTOS_INFRA.md) | Orçamento e infra |
| [ONNZE_TECNOLOGIA.md](./ONNZE_TECNOLOGIA.md) | Papel da Onnze na execução técnica |
| [product_requirements_document.md](./product_requirements_document.md) | **Template** genérico de PRD (inglês); preencher ou substituir por PRD Obra10+ |

### 10.1 Alinhamento visual: fonte de verdade

- **Fonte de verdade atual:** `index.css` + este MKDS (paleta navy + verde do dashboard).
- **Diretriz de produto:** todas as telas novas devem herdar o mesmo sistema visual (login, shell autenticado, módulos internos e auditoria).
- **UI_LOGIN_E_IDENTIDADE.md:** referência de UX e linguagem; caso divergir de token, prevalece o padrão implementado no frontend até revisão formal de design system.
