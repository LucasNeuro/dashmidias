# Shell da aplicação autenticada

## Objetivo

Um único layout (`AppShell`) para ecrãs com sessão: barra superior fixa com identidade, utilizador, notificações e saída; minidrawer lateral (rail + gaveta); área principal com cabeçalho de página opcional e conteúdo com scroll.

## Componentes

| Peça | Ficheiro | Notas |
|------|----------|--------|
| Shell completo | `frontend/src/components/AppShell.jsx` | Inclui `AppShellTopBar` (barra global). |
| Itens de navegação | `frontend/src/lib/appNavItems.js` | Hub vs Imóveis; bloco Governança quando aplicável. |
| Governança HUB | `frontend/src/pages/AdminGovernanceLayout.jsx` | Rotas `/adm/*`; tabs no `headerTabs` do `AppShell` (coladas ao título). |

## Governança (`/adm/*`)

- **`headerTabs`:** navegação por módulos (Auditoria, Configurações, …) fica **no cabeçalho branco** do shell, por baixo do subtítulo, com separador — não dentro da área de scroll do `<main>`.
- **`contentClassName` + `mainClassName`:** invólucro mais leve e **padding mais apertado** no conteúdo, para o utilizador não ver “card dentro de card” e ganhar largura útil (menos rolagem horizontal nas tabelas).

## Barra superior global

- **Fixa** no topo da viewport (`shrink-0`), acima do conteúdo e do drawer.
- **Visual:** gradiente `from-primary via-[#1a3050] to-[#24364a]` (alinhado ao cabeçalho `governance` do `AppSideover`), com leve degradê à direita; texto e ícones em branco / branco translúcido.
- **Esquerda:** menu (só mobile) + **marca Obra10+** (a marca não se repete na sidebar).
- **Desktop:** sidebar **colada** à margem esquerda e de topo a fundo abaixo do header (`left-0`, `top: 3.5rem`, `height: calc(100% - 3.5rem)`). O botão da gaveta fica **no topo** da borda direita, **circular compacto** (`h-7 w-7`), `bg-tertiary` (verde limão), centrado na borda; a lista de ícones do rail tem **padding superior** (`pt-10`) para não ficar por baixo do botão.
- **Direita:** e-mail da sessão (md+), **notificações** (placeholder — toast «em breve» até haver backend), **Sair** (`signOut` do `AuthContext`).
- O botão de logout flutuante no canto inferior foi **removido** em favor desta barra.

## Painel HUB (`/painel/campanhas`)

- **Abas de painel** (nível superior): **Imóveis**, **Arquitetura**, **Produtos**, **Serviços** (resumo por mercado com KPIs quando a base estiver ligada); **Desempenho do HUB** mantém o dashboard operacional completo (Meta/Google, funil, tabela de campanhas).
- As **sub-abas** (Visão geral, Meta, Google, Funil) existem **só** dentro da aba «Desempenho do HUB».

## Convenções

- Não duplicar botões «Dashboard» / «Hub» no cabeçalho da página: navegação principal na sidebar e na barra global.
- Títulos longos de página ficam no `header` interno do `AppShell` (`title` / `subtitle`), não na barra global.
